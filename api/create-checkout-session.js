import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Central server-side Stripe pricing config.
// Amounts are in cents.
const PAYMENT_CONFIG = {
  human_verification: {
    name: "ProjectBid Human Verification",
    amount: 500,
    mode: "payment",
  },

  contractor_pro_monthly: {
    name: "ProjectBid Pro Contractor",
    amount: 1499,
    mode: "subscription",
    interval: "month",
  },

  contractor_verified_monthly: {
    name: "ProjectBid Verified Contractor",
    amount: 1999,
    mode: "subscription",
    interval: "month",
  },

  contractor_universal_monthly: {
    name: "ProjectBid Universal Contractor",
    amount: 2999,
    mode: "subscription",
    interval: "month",
  },

  featured_listing_day: {
    name: "ProjectBid Featured Listing - Daily",
    amount: 500,
    mode: "payment",
  },

  featured_listing_week: {
    name: "ProjectBid Featured Listing - Weekly",
    amount: 1500,
    mode: "payment",
  },

  featured_listing_month: {
    name: "ProjectBid Featured Listing - Monthly",
    amount: 2900,
    mode: "payment",
  },

  lead_unlock_contractor: {
    name: "ProjectBid Contractor Lead Unlock",
    amount: 1500,
    mode: "payment",
  },

  lead_unlock_owner: {
    name: "ProjectBid Owner Lead Unlock",
    amount: 500,
    mode: "payment",
  },

  ad_day: {
    name: "ProjectBid Advertisement - Daily",
    amount: 500,
    mode: "payment",
  },

  ad_week: {
    name: "ProjectBid Advertisement - Weekly",
    amount: 2500,
    mode: "payment",
  },

  ad_month: {
    name: "ProjectBid Advertisement - Monthly",
    amount: 7900,
    mode: "payment",
  },

  finalization: {
    name: "ProjectBid Contract Finalization Fee",
    amount: 500,
    mode: "payment",
  },
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      paymentType,
      contractId,
      userId,
      tier,
      leadRole,
      projectId,
      city,
      category,
    } = request.body;

    const config = PAYMENT_CONFIG[paymentType];

    if (!config) {
      return response.status(400).json({
        error: `Unknown payment type: ${paymentType}`,
      });
    }

    const priceData = {
      currency: "cad",
      product_data: {
        name: config.name,
      },
      unit_amount: config.amount,
    };

    if (config.mode === "subscription") {
      priceData.recurring = {
        interval: config.interval || "month",
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      payment_method_types: ["card"],
      metadata: {
        paymentType,
        contractId: contractId || "",
        userId: userId || "",
        tier: tier || "",
        leadRole: leadRole || "",
        projectId: projectId || "",
        city: city || "",
        category: category || "",
      },
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      success_url: `${request.headers.origin}/?payment=success&type=${paymentType}`,
      cancel_url: `${request.headers.origin}/?payment=cancelled&type=${paymentType}`,
    });

    return response.status(200).json({
      url: session.url,
    });
  } catch (error) {
    return response.status(500).json({
      error: error.message,
    });
  }
}