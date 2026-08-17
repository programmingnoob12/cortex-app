// supabase/functions/create-payment-intent/index.ts

import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const MEMBERSHIP_PRICE_NZD_CENTS = 4000; // $40.00 NZD — the source of truth for amount

// CORS headers — without these, browsers block the response before your
// checkout page ever sees it, which is exactly the error you just hit.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Browsers send a preflight OPTIONS request before the real POST, to ask
  // "am I allowed to do this?" — this must be answered before the actual
  // request will even be attempted.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json().catch(() => ({}));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: MEMBERSHIP_PRICE_NZD_CENTS,
      currency: "nzd",
      receipt_email: email || undefined,
      metadata: { product: "nback-membership" },
      automatic_payment_methods: { enabled: true },
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});