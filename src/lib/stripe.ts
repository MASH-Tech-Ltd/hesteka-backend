import Stripe from "stripe";
import config from "../config";

// Make sure config.stripeSecretKey exists in your config
// STRIPE_SECRET_KEY=sk_test_... or sk_live_...

export const stripe = new Stripe((config.stripe.secretKey || "sk_test_placeholder") as string, {
    apiVersion: "2026-02-25.clover",
});

//sensitive doc: https://stripe.com/docs/keys#test-live-modes