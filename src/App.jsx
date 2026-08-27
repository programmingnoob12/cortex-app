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
        style={{ backgroundColor: C.accent, color: "#06181F" }}
      >
        {submitting ? "Processing…" : "Start membership"}
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
        style={{ backgroundColor: C.accent, color: "#06181F" }}
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
              "Dual and Quad N-Back",
              "Relational Reasoning Training",
              "3D Motion Tracking",
              "Streaks, ranks and full history",
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
