import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { paymentType, contractId, userId } = request.body;

    const isMembership = paymentType === "verification";

    const amount = isMembership
      ? 500
      : paymentType === "finalization"
      ? 500
      : 4900;

    const name = isMembership
      ? "ProjectBid $5 Monthly Membership"
      : paymentType === "finalization"
      ? "ProjectBid $5 Contract Finalization Fee"
      : "ProjectBid Advertisement";

    const session = await stripe.checkout.sessions.create({
      mode: isMembership ? "subscription" : "payment",
      payment_method_types: ["card"],
      metadata: {
        paymentType,
        contractId: contractId || "",
        userId: userId || ""
      },
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name
            },
            unit_amount: amount,
            recurring: isMembership
              ? {
                  interval: "month"
                }
              : undefined
          },
          quantity: 1
        }
      ],
      success_url: `${request.headers.origin}/?payment=success`,
      cancel_url: `${request.headers.origin}/?payment=cancelled`
    });

    return response.status(200).json({ url: session.url });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}