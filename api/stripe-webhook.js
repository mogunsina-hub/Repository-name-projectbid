import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getTier(paymentType) {
  if (paymentType === "contractor_pro_monthly") return "pro";
  if (paymentType === "contractor_verified_monthly") return "verified";
  if (paymentType === "contractor_universal_monthly") return "universal";
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentType = session.metadata?.paymentType || "unknown";
    const contractId = session.metadata?.contractId || null;
    const userId = session.metadata?.userId || null;
    const tier = session.metadata?.tier || getTier(paymentType);

    await supabase.from("payments").insert({
      stripe_session_id: session.id,
      payment_type: paymentType,
      amount: session.amount_total || 0,
      currency: session.currency || "cad",
      customer_email:
        session.customer_details?.email || session.customer_email || null,
      status: session.payment_status || "paid",
    });

    if (paymentType === "human_verification" && userId) {
      await supabase
        .from("profiles")
        .update({
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    if (tier && userId) {
      await supabase
        .from("profiles")
        .update({
          contractor_tier: tier,
          subscription_status: "active",
          subscription_payment_type: paymentType,
          stripe_customer_id: session.customer || null,
          subscription_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    if (paymentType === "finalization" && contractId) {
      const finalizedAt = new Date().toISOString();

      const { data: contract } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();

      if (contract) {
        await supabase
          .from("contracts")
          .update({
            status: "finalized",
            finalized_at: finalizedAt,
          })
          .eq("id", contract.id);

        await supabase
          .from("projects")
          .update({
            status: "Finalized",
            finalized_at: finalizedAt,
          })
          .eq("id", contract.project_id);
      }
    }
  }

  return res.status(200).json({ received: true });
}