import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// ---------------------------------------------------------------------
// 1. Stripe init + appearance
// ---------------------------------------------------------------------
const STRIPE_PUBLISHABLE_KEY = "pk_test_51LWmPKIUM9SdKsj1bdD2uLndjdet0b306mTFPXNXRw9lPt6swwW8Ab5F2dLwmvku3jcGL2ur5pHfl6rryakxEmT000QkCO4SuI";
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Where a returning member is sent to sign in. Anyone who already has an
// account must go here rather than buying again: the subscription is
// provisioned against whatever email is typed on this page, so a second
// address silently creates a second account and strands their streak,
// scores and history on the first one.
const APP_URL = "https://cortex-game-git-main-cortex-85e4.vercel.app/";

const appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#10b981",
    colorBackground: "#0a0a0a",
    colorText: "#f5f5f5",
    colorTextSecondary: "#a1a1aa",
    colorDanger: "#f87171",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Tab": { border: "1px solid #27272a", backgroundColor: "#111113" },
    ".Tab:hover": { backgroundColor: "#18181b" },
    ".Tab--selected": { border: "1px solid #10b981", backgroundColor: "#111113" },
    ".Input": { border: "1px solid #27272a", backgroundColor: "#111113" },
    ".Input:focus": { border: "1px solid #10b981", boxShadow: "0 0 0 1px #10b981" },
    ".Label": { color: "#a1a1aa", fontSize: "13px" },
  },
};

// ---------------------------------------------------------------------
// 2. Step 2: the actual payment form, only mounted once we have a
//    clientSecret from create-subscription (which needed the email first).
// ---------------------------------------------------------------------
function CheckoutForm({ priceLabel, email }) {
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
      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg py-3.5 text-base font-medium text-white"
      >
        {submitting ? "Processing…" : "Subscribe now"}
      </button>
      <p className="text-xs text-zinc-500 text-center leading-relaxed">
        You're joining for {priceLabel}. Cancel any time, no questions asked.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------
// 3. Step 1: email entry. Submitting this is what actually creates the
//    Stripe Customer + Subscription server-side and gets us a clientSecret.
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
        <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
        />
        <p className="text-xs text-zinc-500 mt-1.5">
          Already had a membership? Use the same email so your streak and scores
          carry over.
        </p>
      </div>
      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors rounded-lg py-3.5 text-base font-medium text-white"
      >
        {loading ? "Loading…" : "Continue"}
      </button>
      <p className="text-sm text-zinc-500 text-center">
        Already a member?{" "}
        <a href={APP_URL} className="text-emerald-400 hover:underline">
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

  const PRICE_LABEL = "$40.00 NZD/month";

  // Runs once the person has entered an email, so the Stripe Customer can
  // be created with that address attached.
  const handleEmailSubmit = async (enteredEmail) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        // create-payment-intent is the deployed function. It now creates a
        // real Customer + Subscription and returns { clientSecret }, so this
        // page needs no other change. create-subscription was never deployed.
        "https://sdvfacmhljkwojvmtflr.supabase.co/functions/v1/create-payment-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sb_publishable_oeUIhMq6Wg9ElS6gCzbIZw_djTvdsLm",
          },
          body: JSON.stringify({ email: enteredEmail, plan: "monthly" }),
        }
      );
      const data = await res.json();
      if (data.clientSecret) {
        setEmail(enteredEmail);
        setClientSecret(data.clientSecret);
      } else {
        setErrorMsg(data.error || "Could not start checkout. Please try again.");
      }
    } catch (err) {
      setErrorMsg("Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-16 items-center">
        <div className="text-center md:text-left space-y-4">
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Sharpen your mind,
            <br />
            a few minutes a day.
          </h1>
          <p className="text-zinc-400 text-base">
            One membership. Every exercise. Your progress, wherever you go.
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Your membership</h2>
              <span className="text-lg font-semibold">{PRICE_LABEL}</span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">Full access, cancel whenever you like.</p>
          </div>
          <div className="border-t border-zinc-800" />

          {!clientSecret ? (
            <EmailForm onSubmit={handleEmailSubmit} loading={loading} errorMsg={errorMsg} />
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <CheckoutForm priceLabel={PRICE_LABEL} email={email} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
