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

function getTier(paymentType) {
  if (paymentType === "contractor_pro_monthly") return "pro";
  if (paymentType === "contractor_verified_monthly") return "verified";
  if (paymentType === "contractor_universal_monthly") return "universal";
  return null;
}

async function recordPayment(session, paymentType) {
  const { error } = await supabase.from("payments").insert({
    stripe_session_id: session.id,
    payment_type: paymentType,
    amount: session.amount_total || 0,
    currency: session.currency || "cad",
    customer_email:
      session.customer_details?.email || session.customer_email || null,
    status: session.payment_status || "paid",
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

async function updateLeadUnlock(session, paymentType, leadUnlockId, leadRole) {
  if (!leadUnlockId) return;

  const updateData = {
    updated_at: new Date().toISOString(),
  };

  if (paymentType === "lead_unlock_owner" || leadRole === "owner") {
    updateData.owner_paid = true;
    updateData.owner_payment_session_id = session.id;
  }

  if (paymentType === "lead_unlock_contractor" || leadRole === "contractor") {
    updateData.contractor_paid = true;
    updateData.contractor_payment_session_id = session.id;
  }

  const { data: updatedUnlock, error: updateError } = await supabase
    .from("lead_unlocks")
    .update(updateData)
    .eq("id", leadUnlockId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  if (updatedUnlock.owner_paid && updatedUnlock.contractor_paid) {
    const { error: statusError } = await supabase
      .from("lead_unlocks")
      .update({
        status: "unlocked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadUnlockId);

    if (statusError) {
      throw statusError;
    }
  }
}

async function finalizeContract(contractId) {
  if (!contractId) return;

  const finalizedAt = new Date().toISOString();

  const { data: contract, error: contractFindError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (contractFindError) {
    throw contractFindError;
  }

  if (!contract) return;

  const { error: contractUpdateError } = await supabase
    .from("contracts")
    .update({
      status: "finalized",
      finalized_at: finalizedAt,
    })
    .eq("id", contract.id);

  if (contractUpdateError) {
    throw contractUpdateError;
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({
      status: "Finalized",
      finalized_at: finalizedAt,
    })
    .eq("id", contract.project_id);

  if (projectUpdateError) {
    throw projectUpdateError;
  }
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const paymentType = session.metadata?.paymentType || "unknown";
      const contractId = session.metadata?.contractId || null;
      const userId = session.metadata?.userId || null;
      const tier = session.metadata?.tier || getTier(paymentType);
      const leadUnlockId = session.metadata?.leadUnlockId || null;
      const leadRole = session.metadata?.leadRole || null;

      await recordPayment(session, paymentType);

      if (paymentType === "human_verification" && userId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            is_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) throw error;
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
            subscription_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) throw error;
      }

      if (paymentType === "finalization" && contractId) {
        await finalizeContract(contractId);
      }

      if (
        paymentType === "lead_unlock_owner" ||
        paymentType === "lead_unlock_contractor"
      ) {
        await updateLeadUnlock(
          session,
          paymentType,
          leadUnlockId,
          leadRole
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
}