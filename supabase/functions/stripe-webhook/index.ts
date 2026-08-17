// supabase/functions/stripe-webhook/index.ts

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const serviceKey = Deno.env.get("LEGACY_SERVICE_ROLE_KEY");
console.log("LEGACY_SERVICE_ROLE_KEY present:", !!serviceKey, "starts with:", serviceKey?.slice(0, 8)); 

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  serviceKey!
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const email = intent.receipt_email;
    if (!email) {
      return new Response("No email on payment intent — cannot provision account", { status: 400 });
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    let userId = created?.user?.id;
    if (createErr) {
      console.error("createUser error:", createErr.message);
      const { data: existing, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) {
        console.error("listUsers error:", listErr.message);
        return new Response(`Could not list users: ${listErr.message}`, { status: 500 });
      }
      userId = existing?.users.find((u) => u.email === email)?.id;
      if (!userId) {
        return new Response(`Could not create or find user: ${createErr.message}`, { status: 500 });
      }
    }

    const { error: upsertErr } = await supabaseAdmin.from("users").upsert({
      id: userId,
      email,
      membership_status: "active",
    });
    if (upsertErr) {
      console.error("users upsert error:", upsertErr.message);
      return new Response(`Could not activate membership: ${upsertErr.message}`, { status: 500 });
    }

    const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) {
      console.error("generateLink error:", linkErr.message);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});