import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false
  }
};

async function buffer(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).send("Method not allowed");
  }

  const signature = request.headers["stripe-signature"];
  const rawBody = await buffer(request);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return response.status(400).send(`Webhook error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const paymentType = session.metadata?.paymentType || "unknown";

    await supabaseAdmin.from("payments").insert([
      {
        stripe_session_id: session.id,
        payment_type: paymentType,
        amount: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details?.email || null,
        status: session.payment_status
      }
    ]);
  }

  return response.status(200).json({ received: true });
}