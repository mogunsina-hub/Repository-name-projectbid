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
    console.error("Stripe webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentType = session.metadata?.paymentType || "unknown";
    const contractId = session.metadata?.contractId || null;

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
      console.error("Supabase payment insert error:", paymentError.message);
      return res.status(500).json({
        error: paymentError.message,
      });
    }

    if (paymentType === "finalization" && contractId) {
      const finalizedAt = new Date().toISOString();

      const { data: contract, error: contractFindError } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();

      if (contractFindError) {
        console.error("Contract lookup error:", contractFindError.message);
        return res.status(500).json({
          error: contractFindError.message,
        });
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
          console.error("Contract update error:", contractUpdateError.message);
          return res.status(500).json({
            error: contractUpdateError.message,
          });
        }

        const { error: projectUpdateError } = await supabase
          .from("projects")
          .update({
            status: "Finalized",
            finalized_at: finalizedAt,
          })
          .eq("id", contract.project_id);

        if (projectUpdateError) {
          console.error("Project update error:", projectUpdateError.message);
          return res.status(500).json({
            error: projectUpdateError.message,
          });
        }
      }
    }
  }

  return res.status(200).json({
    received: true,
  });
}