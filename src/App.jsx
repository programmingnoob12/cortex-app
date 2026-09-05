import { useState, useRef, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// ---------------------------------------------------------------------
// 1. Config
// ---------------------------------------------------------------------
const STRIPE_PUBLISHABLE_KEY = "pk_test_51LWmPKIUM9SdKsj1bdD2uLndjdet0b306mTFPXNXRw9lPt6swwW8Ab5F2dLwmvku3jcGL2ur5pHfl6rryakxEmT000QkCO4SuI";
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Where a returning member is sent to sign in. Anyone who already has an
// account must go here rather than buying again: the subscription is
// provisioned against whatever email is typed on this page, so a second
// address silently creates a second account and strands their streak,
// scores and history on the first one.
const APP_URL = "https://cortex-game-git-main-cortex-85e4.vercel.app/";

const CREATE_SUBSCRIPTION_URL =
  "https://sdvfacmhljkwojvmtflr.supabase.co/functions/v1/create-payment-intent";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oeUIhMq6Wg9ElS6gCzbIZw_djTvdsLm";

// These must match the currency_options on the Stripe Price exactly. The
// page only displays them; the server decides what is charged, and it
// whitelists the same six. Anything else is billed in NZD.
// Monthly figures are the rounded ones (up, to a number ending in 0, 5 or
// 9). Annual is then exactly monthly x 12 x 0.85, unrounded, so the saving
// is a true 15% rather than something that has to be described as "about"
// 15%. GBP is the only one that lands on cents.
const PRICES = {
  nzd: { code: "NZD", symbol: "$", monthly: 40, annual: 408 },
  aud: { code: "AUD", symbol: "$", monthly: 35, annual: 357 },
  usd: { code: "USD", symbol: "$", monthly: 25, annual: 255 },
  // 228 x 0.85 is 193.80. Rounded DOWN to a whole number so the price does
  // not read as a conversion, and because anything below 193.80 saves at
  // least 15%. Rounding up would break the badge's claim.
  gbp: { code: "GBP", symbol: "£", monthly: 19, annual: 193 },
  eur: { code: "EUR", symbol: "€", monthly: 25, annual: 255 },
  cad: { code: "CAD", symbol: "$", monthly: 35, annual: 357 },
};

// Country to currency. Anything not listed falls through to NZD, matching
// the server's fallback so the displayed price is always the charged one.
const COUNTRY_CURRENCY = {
  NZ: "nzd",
  AU: "aud",
  US: "usd",
  GB: "gbp",
  CA: "cad",
  IE: "eur", AT: "eur", BE: "eur", CY: "eur", EE: "eur", FI: "eur",
  FR: "eur", DE: "eur", GR: "eur", IT: "eur", LV: "eur", LT: "eur",
  LU: "eur", MT: "eur", NL: "eur", PT: "eur", SK: "eur", SI: "eur", ES: "eur",
};

// Timezone is checked BEFORE locale, and that ordering is the whole point.
// A locale is the language someone reads in, not where they are: macOS
// hands New Zealanders en-GB by default, which billed them in pounds.
// A timezone is set from the actual clock on the machine.
const ZONE_CURRENCY = {
  "Pacific/Auckland": "nzd",
  "Pacific/Chatham": "nzd",
  "Europe/London": "gbp",
  "Europe/Belfast": "gbp",
  "Europe/Dublin": "eur",
};

const ZONE_PREFIX_CURRENCY = {
  "Australia/": "aud",
  "Europe/": "eur",
};

const US_ZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "America/Adak", "America/Detroit", "America/Boise", "America/Juneau",
  "America/Honolulu", "Pacific/Honolulu",
];

const CA_ZONES = [
  "America/Toronto", "America/Vancouver", "America/Edmonton",
  "America/Winnipeg", "America/Halifax", "America/St_Johns",
  "America/Regina", "America/Montreal",
];

function currencyFromZone(zone) {
  if (!zone) return null;
  if (ZONE_CURRENCY[zone]) return ZONE_CURRENCY[zone];
  if (US_ZONES.includes(zone)) return "usd";
  if (CA_ZONES.includes(zone)) return "cad";
  if (zone.startsWith("America/Indiana/") || zone.startsWith("America/Kentucky/")) {
    return "usd";
  }
  for (const [prefix, cur] of Object.entries(ZONE_PREFIX_CURRENCY)) {
    if (zone.startsWith(prefix)) return cur;
  }
  return null;
}

function currencyFromLocale() {
  const tags = [...(navigator.languages || []), navigator.language || ""].filter(
    Boolean
  );
  for (const tag of tags) {
    const region = tag.split("-")[1];
    if (region && COUNTRY_CURRENCY[region.toUpperCase()]) {
      return COUNTRY_CURRENCY[region.toUpperCase()];
    }
  }
  return null;
}

// No IP lookup: no third-party request on the page that takes payments,
// and no added latency.
function detectCurrency() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) {
      // A known timezone is trusted completely, mapped or not. Falling back
      // to locale for an unmapped zone reintroduces the exact bug this
      // replaced: a Tokyo visitor reading en-GB would be billed in pounds.
      // Unmapped means NZD, which is the server's fallback too.
      return currencyFromZone(zone) || "nzd";
    }
    // Only reached when the browser reports no timezone at all.
    return currencyFromLocale() || "nzd";
  } catch {
    return "nzd";
  }
}

const CURRENCY = detectCurrency();
const P = PRICES[CURRENCY];

const PLANS = {
  monthly: {
    label: `${P.symbol}${P.monthly.toFixed(2)}`,
    period: "per month",
    amount: P.monthly,
    months: 1,
  },
  annual: {
    label: `${P.symbol}${P.annual.toFixed(2)}`,
    period: "per year",
    amount: P.annual,
    months: 12,
  },
};

// Floor, not round: the badge must never claim a bigger saving than the
// numbers deliver. 15.6% shows as 15%.
// Floor, so the badge can never claim a bigger saving than the numbers
// deliver. The epsilon is load-bearing: 193.8 / 228 evaluates to
// 14.999999999999998, and flooring that raw would advertise 14% on a plan
// that genuinely saves 15%.
const ANNUAL_SAVING_PCT = Math.floor(
  (1 - PLANS.annual.amount / (PLANS.monthly.amount * 12)) * 100 + 1e-9
);

// The app's palette, so checkout and the product look like one thing.
const C = {
  bg: "#08090A",
  surface: "#101112",
  raised: "#18191B",
  border: "#23252A",
  borderStrong: "#2E3138",
  text: "#F7F8F8",
  muted: "#8A8F98",
  dim: "#6E7178",
  accent: "#4CB9D8",
  accentHover: "#5FC5E0",
  accentText: "#8FD8EC",
  danger: "#EB5757",
};

// Stripe's Elements are rendered inside an iframe, so they cannot inherit
// the page's CSS. The Appearance API is the only way to make the card
// fields match, and every value here mirrors the palette above.
const appearance = {
  theme: "night",
  variables: {
    colorPrimary: C.accent,
    colorBackground: C.surface,
    colorText: C.text,
    colorTextSecondary: C.muted,
    colorTextPlaceholder: C.dim,
    colorDanger: C.danger,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
    fontSizeBase: "15px",
  },
  rules: {
    ".Tab": { border: `1px solid ${C.border}`, backgroundColor: C.raised },
    ".Tab:hover": { backgroundColor: C.borderStrong },
    ".Tab--selected": { border: `1px solid ${C.accent}`, backgroundColor: C.raised },
    ".Input": { border: `1px solid ${C.border}`, backgroundColor: C.raised },
    ".Input:focus": { border: `1px solid ${C.accent}`, boxShadow: `0 0 0 1px ${C.accent}` },
    ".Label": { color: C.muted, fontSize: "13px", fontWeight: "400" },
    ".Block": { backgroundColor: C.raised, border: `1px solid ${C.border}` },
  },
};

// ---------------------------------------------------------------------
// Hero mark. Drawn inline rather than loaded as an image so it inherits the
// palette, stays crisp at any size, and adds no network request to the page
// that takes payments.
//
// The geometry is the same faceted gem the app already uses for rank
// emblems, scaled up with richer gradients. Reusing it means checkout and
// the product read as one thing rather than two designs bolted together.
// ---------------------------------------------------------------------
function HeroMark() {
  const SIL = "60.1,68.3 178.9,68.3 237.7,102.6 254.9,144.3 149.5,281.5 44.2,144.3 61.3,102.6";
  const TABLE = "60.1,68.3 178.9,68.3 215.7,112.4 83.4,112.4";
  const CROWN_L = "61.3,102.6 60.1,68.3 83.4,112.4";
  const CROWN_R = "178.9,68.3 237.7,102.6 215.7,112.4";
  const CROWN_LL = "44.2,144.3 61.3,102.6 83.4,112.4";
  const CROWN_RR = "254.9,144.3 237.7,102.6 215.7,112.4";
  const PAV_L = "44.2,144.3 83.4,112.4 149.5,281.5";
  const PAV_R = "254.9,144.3 215.7,112.4 149.5,281.5";
  const PAV_C = "83.4,112.4 215.7,112.4 149.5,281.5";

  return (
    <svg
      viewBox="0 0 300 340"
      width="272"
      height="308"
      role="img"
      aria-label="A faceted cyan gem"
      className="mx-auto block"
    >
      <defs>
        <radialGradient id="hm-halo" cx="50%" cy="40%" r="54%">
          <stop offset="0%" stopColor="#5FC5E0" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#4CB9D8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#8B7FE8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hm-body" x1="0.12" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#DFF7FF" />
          <stop offset="18%" stopColor="#96DCEF" />
          <stop offset="42%" stopColor="#4CB9D8" />
          <stop offset="72%" stopColor="#256F8C" />
          <stop offset="100%" stopColor="#3B3A72" />
        </linearGradient>
        <linearGradient id="hm-table" x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="hm-shade" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#06202B" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#08121F" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="hm-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="45%" stopColor="#CFEFFA" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B7FE8" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="hm-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="hm-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4CB9D8" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#4CB9D8" stopOpacity="0" />
        </radialGradient>
        <filter id="hm-soft" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id="hm-clip">
          <polygon points={SIL} />
        </clipPath>
      </defs>

      <circle cx="150" cy="146" r="142" fill="url(#hm-halo)" />
      <ellipse cx="150" cy="290" rx="82" ry="13" fill="url(#hm-floor)" />

      <g filter="url(#hm-soft)" opacity="0.5">
        <polygon points={SIL} fill="#4CB9D8" />
      </g>

      <polygon points={SIL} fill="url(#hm-body)" />
      <polygon points={PAV_L} fill="url(#hm-shade)" />
      <polygon points={PAV_C} fill="#08121F" fillOpacity="0.12" />
      <polygon points={PAV_R} fill="#FFFFFF" fillOpacity="0.06" />
      <polygon points={CROWN_LL} fill="#FFFFFF" fillOpacity="0.12" />
      <polygon points={CROWN_RR} fill="#08121F" fillOpacity="0.14" />
      <polygon points={CROWN_L} fill="#FFFFFF" fillOpacity="0.24" />
      <polygon points={CROWN_R} fill="#FFFFFF" fillOpacity="0.08" />
      <polygon points={TABLE} fill="url(#hm-table)" />

      {/* One narrow streak, angled across the pavilion. The two wide vertical
          bands this replaces crossed the flat table facet and read as a pale
          square in the top-left of the stone. */}
      <g clipPath="url(#hm-clip)">
        <path
          d="M96 118 L118 118 L74 292 L58 292 Z"
          fill="url(#hm-sheen)"
          opacity="0.3"
        />
      </g>

      <polygon points={SIL} fill="none" stroke="url(#hm-rim)" strokeWidth="2" strokeLinejoin="round" />

      <path
        d="M248 60 L253 79 L272 84 L253 89 L248 108 L243 89 L224 84 L243 79 Z"
        fill="#F2FDFF"
        opacity="0.95"
      />
      <path
        d="M267 120 L269.5 129 L278 131.5 L269.5 134 L267 143 L264.5 134 L256 131.5 L264.5 129 Z"
        fill="#BDEBF7"
        opacity="0.7"
      />
      <circle cx="231" cy="126" r="2.4" fill="#F2FDFF" opacity="0.75" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// 2. Step 2: the payment form.
//
// Uses Stripe's deferred intent flow: <Elements> is given mode, amount and
// currency instead of a clientSecret, so the card fields render with no
// server round trip at all. The subscription is created when Pay is
// pressed, where a moment's wait is expected, rather than in front of an
// empty card form where it read as the page being broken.
// ---------------------------------------------------------------------
function CheckoutForm({ email, priceLabel, pricePeriod, currencyCode, getClientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMsg("");

    // Validates the card fields before anything is created server-side, so
    // a typo in the card number never leaves an orphan subscription behind.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMsg(submitError.message || "Please check your card details.");
      setSubmitting(false);
      return;
    }

    let clientSecret;
    try {
      clientSecret = await getClientSecret();
    } catch (err) {
      setErrorMsg(err?.message || "Could not start checkout. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/welcome.html`,
        receipt_email: email,
      },
    });

    if (error) {
      setErrorMsg(error.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {errorMsg && (
        <p className="text-sm" style={{ color: C.danger }}>
          {errorMsg}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg py-4 text-base font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, ${C.accent}, ${C.accentHover})`,
          color: "#FFFFFF",
        }}
      >
        {submitting ? "Processing…" : "Start training"}
      </button>
      <p className="text-xs text-center leading-relaxed" style={{ color: C.dim }}>
        {/* The currency code stays on this one line and nowhere else. "$40.00"
            is ambiguous across NZ, AU, US and CA, and this is the sentence a
            card dispute would be judged on. */}
        By subscribing you authorise us to charge {priceLabel} {currencyCode} {pricePeriod}{" "}
        until you cancel. Cancel any time from inside the app.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------
// 3. Step 1: email entry. Submitting this only moves to the card step; the
//    Customer and Subscription are created when Pay is pressed.
// ---------------------------------------------------------------------
function PlanToggle({ plan, onChange }) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl"
      style={{ backgroundColor: C.raised, border: `1px solid ${C.border}` }}
      role="group"
      aria-label="Billing period"
    >
      {[
        { key: "monthly", text: "Monthly" },
        { key: "annual", text: "Yearly" },
      ].map((opt) => {
        const active = plan === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-sm font-medium transition-colors"
            style={
              active
                ? { backgroundColor: C.surface, color: C.text, border: `1px solid ${C.borderStrong}` }
                : { background: "none", color: C.muted, border: "1px solid transparent" }
            }
          >
            {opt.text}
            {opt.key === "annual" && (
              <span
                className="text-[11px] font-semibold rounded-full px-2 py-0.5"
                style={{ backgroundColor: C.accent, color: "#06181F" }}
              >
                SAVE {ANNUAL_SAVING_PCT}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function readEmailFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("email") || "";
  } catch {
    return "";
  }
}

function EmailForm({ onSubmit, loading, errorMsg, onFirstInput }) {
  const [email, setEmail] = useState(readEmailFromUrl);
  const warmed = useRef(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm mb-2" style={{ color: C.muted }}>
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // Fires once, on the first character typed. By the time an
            // address is finished, Stripe has usually answered.
            if (!warmed.current) {
              warmed.current = true;
              onFirstInput?.();
            }
          }}
          placeholder="you@example.com"
          className="w-full rounded-lg px-4 py-3.5 text-base focus:outline-none transition-colors"
          style={{
            backgroundColor: C.raised,
            border: `1px solid ${C.border}`,
            color: C.text,
          }}
          onFocus={(e) => (e.target.style.border = `1px solid ${C.accent}`)}
          onBlur={(e) => (e.target.style.border = `1px solid ${C.border}`)}
        />
        <p className="text-xs mt-2 leading-relaxed" style={{ color: C.dim }}>
          Had a membership before? Use the same email so your streak and scores carry
          over.
        </p>
      </div>
      {errorMsg && (
        <p className="text-sm" style={{ color: C.danger }}>
          {errorMsg}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg py-4 text-base font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, ${C.accent}, ${C.accentHover})`,
          color: "#FFFFFF",
        }}
      >
        {loading ? "Loading…" : "Continue"}
      </button>
      <p className="text-sm text-center" style={{ color: C.dim }}>
        Already a member?{" "}
        <a
          href={APP_URL}
          className="hover:underline"
          style={{ color: C.accentText }}
        >
          Sign in instead
        </a>
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------
// 4. Page shell
// ---------------------------------------------------------------------
export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [showCard, setShowCard] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [plan, setPlan] = useState("monthly");

  // A client secret per plan, fetched the moment someone starts typing an
  // address rather than when they press Continue. Creating the Stripe
  // customer and subscription takes about a second, and that second used to
  // sit in front of the card form as a spinner.
  //
  // Warming deliberately sends NO email. The address is not needed to make
  // the subscription, it can still change while they type, and the webhook
  // provisions the account from receipt_email at confirm time regardless.
  const secretsRef = useRef({});
  const warmingRef = useRef({});

  const requestSecret = useCallback(async (targetPlan) => {
    const res = await fetch(CREATE_SUBSCRIPTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ plan: targetPlan, currency: CURRENCY }),
    });
    return res.json();
  }, []);

  const warmSecret = useCallback(
    (targetPlan) => {
      if (secretsRef.current[targetPlan] || warmingRef.current[targetPlan]) return;
      warmingRef.current[targetPlan] = requestSecret(targetPlan)
        .then((data) => {
          if (data?.clientSecret) secretsRef.current[targetPlan] = data.clientSecret;
          return data;
        })
        .catch(() => null);
    },
    [requestSecret]
  );

  // Purely local now. Moving to the card step involves no network call at
  // all, because <Elements> renders from mode/amount/currency rather than a
  // clientSecret, so Continue is instant by construction rather than by
  // winning a race against a slow request.
  const handleEmailSubmit = (enteredEmail) => {
    setErrorMsg("");
    setEmail(enteredEmail);
    setShowCard(true);
  };

  // Called by the pay button. Reuses whatever the warm request produced, and
  // falls back to a fresh call if it never landed or the plan changed.
  const getClientSecret = useCallback(async () => {
    const ready = secretsRef.current[plan];
    if (ready) return ready;

    const data = (await warmingRef.current[plan]) || (await requestSecret(plan));
    if (data?.clientSecret) {
      secretsRef.current[plan] = data.clientSecret;
      return data.clientSecret;
    }
    if (data?.alreadySubscribed) {
      throw new Error("That email already has a membership. Sign in instead.");
    }
    throw new Error(data?.error || "Could not start checkout. Please try again.");
  }, [plan, requestSecret]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-16 items-center">
        {/* Mark and one line of copy, nothing else. A feature list here
            competes with the payment form for attention and makes the page
            read as a brochure rather than a checkout. */}
        <div className="text-center">
          <HeroMark />
          <h1 className="text-3xl md:text-4xl font-semibold leading-snug tracking-tight mt-2">
            Sharpen your mind.
            <br />
            A few minutes a day.
          </h1>
        </div>

        <div
          className="rounded-2xl p-7 space-y-6"
          style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
        >
          {/* Top-left of the card, above everything, so it is reachable
              without sitting in the middle of the payment flow. Only shown
              on the card step, where the plan toggle is hidden and there is
              otherwise no way back to change plan or fix the email. */}
          {showCard && (
            <button
              type="button"
              onClick={() => {
                setShowCard(false);
                setErrorMsg("");
              }}
              className="text-sm font-medium transition-colors"
              style={{ color: C.muted, marginBottom: "-0.5rem" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
            >
              &lsaquo; Back
            </button>
          )}

          <div>
            {/* Hidden on the card step. The amount is baked into the Elements
                options there, so changing plan behind the card fields would
                show one figure and charge another. */}
            {!showCard && (
              <div className="mb-5">
                <PlanToggle
                  plan={plan}
                  onChange={(next) => {
                    setPlan(next);
                    // Only warms if typing has already started, since
                    // warmSecret is a no-op until then.
                    if (warmingRef.current.monthly || warmingRef.current.annual) {
                      warmSecret(next);
                    }
                  }}
                />
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium">Total due today</h2>
              <span className="text-2xl font-semibold">{PLANS[plan].label}</span>
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="text-sm mt-2 hover:underline"
              style={{ color: C.muted }}
            >
              {detailsOpen ? "Hide details" : "Show details"}
            </button>
            {detailsOpen && (
              <div
                className="mt-4 space-y-2 text-sm rounded-lg p-4"
                style={{ backgroundColor: C.raised, color: C.muted }}
              >
                <div className="flex justify-between">
                  <span>Cortex membership</span>
                  <span>{PLANS[plan].label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Billed</span>
                  <span>{plan === "annual" ? "Yearly" : "Monthly"}</span>
                </div>
                {plan === "annual" && (
                  <div className="flex justify-between" style={{ color: C.accentText }}>
                    <span>You save</span>
                    <span>
                      {P.symbol}
                      {(PLANS.monthly.amount * 12 - PLANS.annual.amount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div
                  className="flex justify-between pt-2 font-medium"
                  style={{ borderTop: `1px solid ${C.border}`, color: C.text }}
                >
                  <span>Due today</span>
                  <span>{PLANS[plan].label}</span>
                </div>
                <p className="pt-1 leading-relaxed" style={{ color: C.dim }}>
                  Renews automatically. Cancel, pause or switch plans any time from
                  inside the app.
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}` }} />

          {!showCard ? (
            <EmailForm
              onSubmit={handleEmailSubmit}
              loading={false}
              errorMsg={errorMsg}
              onFirstInput={() => warmSecret(plan)}
            />
          ) : (
            <>
              <Elements
                stripe={stripePromise}
                options={{
                  mode: "subscription",
                  amount: Math.round(PLANS[plan].amount * 100),
                  currency: CURRENCY,
                  appearance,
                }}
              >
                <CheckoutForm
                  email={email}
                  priceLabel={PLANS[plan].label}
                  pricePeriod={PLANS[plan].period}
                  currencyCode={P.code}
                  getClientSecret={getClientSecret}
                />
              </Elements>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
