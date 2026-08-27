import { useState } from "react";
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

const PRICE_LABEL = "$40.00 NZD";
const PRICE_PERIOD = "per month";

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
      className="mx-auto md:mx-0 block"
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
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.16" />
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

      <g clipPath="url(#hm-clip)">
        <path d="M40 60 L96 60 L58 300 L20 300 Z" fill="url(#hm-sheen)" opacity="0.5" />
        <path d="M108 60 L124 60 L86 300 L70 300 Z" fill="url(#hm-sheen)" opacity="0.28" />
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
// 2. Step 2: the payment form, mounted once we have a clientSecret
// ---------------------------------------------------------------------
function CheckoutForm({ email }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMsg("");

    const { error } = await stripe.confirmPayment({
      elements,
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
        By subscribing you authorise us to charge {PRICE_LABEL} {PRICE_PERIOD} until you
        cancel. Cancel any time from inside the app.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------
// 3. Step 1: email entry. Submitting this creates the Stripe Customer and
//    Subscription server-side and returns a clientSecret.
// ---------------------------------------------------------------------
function readEmailFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("email") || "";
  } catch {
    return "";
  }
}

function EmailForm({ onSubmit, loading, errorMsg }) {
  const [email, setEmail] = useState(readEmailFromUrl);

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
          onChange={(e) => setEmail(e.target.value)}
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
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleEmailSubmit = async (enteredEmail) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(CREATE_SUBSCRIPTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ email: enteredEmail, plan: "monthly" }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setEmail(enteredEmail);
        setClientSecret(data.clientSecret);
      } else if (data.alreadySubscribed) {
        setErrorMsg("That email already has a membership. Sign in instead.");
      } else {
        setErrorMsg(data.error || "Could not start checkout. Please try again.");
      }
    } catch {
      setErrorMsg("Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-5 text-center md:text-left">
          <HeroMark />
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
            Sharpen your mind,
            <br />
            a few minutes a day.
          </h1>
          <p className="text-base leading-relaxed" style={{ color: C.muted }}>
            One membership. Every exercise. Your progress, wherever you go.
          </p>
          <ul className="space-y-2.5 text-base inline-block text-left" style={{ color: C.muted }}>
            {[
              "Sharper focus that holds for longer",
              "Clearer thinking under pressure",
              "Built for minds that wander",
              "A few minutes a day, tracked and measured",
            ].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span style={{ color: C.accent }}>✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-2xl p-7 space-y-6"
          style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
        >
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium">Total due today</h2>
              <span className="text-2xl font-semibold">{PRICE_LABEL}</span>
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
                  <span>{PRICE_LABEL}</span>
                </div>
                <div className="flex justify-between">
                  <span>Billed</span>
                  <span>Monthly</span>
                </div>
                <div
                  className="flex justify-between pt-2 font-medium"
                  style={{ borderTop: `1px solid ${C.border}`, color: C.text }}
                >
                  <span>Due today</span>
                  <span>{PRICE_LABEL}</span>
                </div>
                <p className="pt-1 leading-relaxed" style={{ color: C.dim }}>
                  Renews automatically. Cancel, pause or switch to annual any time from
                  inside the app.
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}` }} />

          {!clientSecret ? (
            <EmailForm onSubmit={handleEmailSubmit} loading={loading} errorMsg={errorMsg} />
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <CheckoutForm email={email} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
