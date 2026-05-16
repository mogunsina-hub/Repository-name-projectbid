import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getTierFromPaymentType(paymentType) {
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
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
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
    const tier = session.metadata?.tier || getTierFromPaymentType(paymentType);
    const leadRole = session.metadata?.leadRole || null;
    const projectId = session.metadata?.projectId || null;
    const city = session.metadata?.city || null;
    const category = session.metadata?.category || null;

    const { error: paymentError } = await supabase.from("payments").insert({
      stripe_session_id: session.id,
      payment_type: paymentType,
      amount: session.amount_total || 0,
      currency: session.currency || "cad",
      customer_email:
        session.customer_details?.email || session.customer_email || null,
      status: session.payment_status || "paid",
    });

    if (paymentError) {
      return res.status(500).json({ error: paymentError.message });
    }

    if (paymentType === "human_verification" && userId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    if (
      [
        "contractor_pro_monthly",
        "contractor_verified_monthly",
        "contractor_universal_monthly",
      ].includes(paymentType) &&
      userId &&
      tier
    ) {
      const { error } = await supabase
        .from("profiles")
        .update({
          contractor_tier: tier,
          subscription_status: "active",
          subscription_payment_type: paymentType,
          stripe_customer_id: session.customer || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    if (
      [
        "featured_listing_day",
        "featured_listing_week",
        "featured_listing_month",
        "ad_day",
        "ad_week",
        "ad_month",
        "lead_unlock_contractor",
        "lead_unlock_owner",
      ].includes(paymentType)
    ) {
      await supabase.from("payments").update({
        status: "paid",
      }).eq("stripe_session_id", session.id);
    }

    if (paymentType === "finalization" && contractId) {
      const finalizedAt = new Date().toISOString();

      const { data: contract, error: contractFindError } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();

      if (contractFindError) {
        return res.status(500).json({ error: contractFindError.message });
      }

      if (contract) {
        const { error: contractUpdateError } = await supabase
          .from("contracts")
          .update({
            status: "finalized",
            finalized_at: finalizedAt,
          })
          .eq("id", contract.id);

        if (contractUpdateError) {
          return res.status(500).json({ error: contractUpdateError.message });
        }

        const { error: projectUpdateError } = await supabase
          .from("projects")
          .update({
            status: "Finalized",
            finalized_at: finalizedAt,
          })
          .eq("id", contract.project_id);

        if (projectUpdateError) {
          return res.status(500).json({ error: projectUpdateError.message });
        }
      }
    }
  }

  return res.status(200).json({ received: true });
}