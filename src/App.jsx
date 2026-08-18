import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const STRIPE_PUBLISHABLE_KEY = "pk_test_51LWmPKIUM9SdKsj1bdD2uLndjdet0b306mTFPXNXRw9lPt6swwW8Ab5F2dLwmvku3jcGL2ur5pHfl6rryakxEmT000QkCO4SuI";
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

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

function CheckoutForm({ priceLabel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!email) {
      setErrorMsg("Please enter your email.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
        receipt_email: email,
      },
    });

    if (error) {
      setErrorMsg(error.message || "Something went wrong — please try again.");
      setSubmitting(false);
    }
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
      </div>
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
        By subscribing, you authorise us to charge you {priceLabel} according to the terms until
        you cancel.
      </p>
    </form>
  );
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] = useState(null);
  const [loadError, setLoadError] = useState("");

  const PRICE_LABEL = "$40.00 NZD";

  useEffect(() => {
    fetch("https://sdvfacmhljkwojvmtflr.supabase.co/functions/v1/create-payment-intent", {
      method: "POST",
      headers: {
        Authorization: "Bearer sb_publishable_oeUIhMq6Wg9ElS6gCzbIZw_djTvdsLm"
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setLoadError("Could not start checkout — please refresh.");
      })
      .catch(() => setLoadError("Could not start checkout — please refresh."));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-16 items-center">
        <div className="text-center md:text-left space-y-4">
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Train your working memory.
            <br />
            Every day, from anywhere.
          </h1>
          <p className="text-zinc-400 text-base">
            One membership, every exercise, your progress synced everywhere.
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Total due today</h2>
              <span className="text-lg font-semibold">{PRICE_LABEL}</span>
            </div>
          </div>
          <div className="border-t border-zinc-800" />

          {loadError && <p className="text-sm text-red-400">{loadError}</p>}

          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <CheckoutForm priceLabel={PRICE_LABEL} />
            </Elements>
          ) : (
            !loadError && <p className="text-sm text-zinc-500">Loading checkout…</p>
          )}
        </div>
      </div>
    </div>
  );
}