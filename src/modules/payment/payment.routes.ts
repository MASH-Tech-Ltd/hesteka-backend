import express from "express";
import { paymentController } from "./payment.controller";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { authGuard } from "../../middleware/auth.middleware";
import {
  createStripePaymentIntentSchema,
  createPayPalOrderSchema,
  capturePayPalOrderSchema,
} from "./payment.validation";
import { paymentLimiter } from "../../middleware/rateLimiter.middleware";

export const paymentRoute = express.Router();

// Apply payment rate limiter to all payment endpoints
paymentRoute.use(paymentLimiter);

// Stripe
paymentRoute.post(
  "/stripe/create-payment-intent",
  validateRequest(createStripePaymentIntentSchema),
  paymentController.createStripePaymentIntent,
);

paymentRoute.post(
  "/stripe/create-setup-intent",
  authGuard,
  paymentController.createStripeSetupIntent,
);

// PayPal
paymentRoute.post(
  "/paypal/create-order",
  validateRequest(createPayPalOrderSchema),
  paymentController.createPayPalOrder,
);

paymentRoute.post(
  "/paypal/capture-order",
  validateRequest(capturePayPalOrderSchema),
  paymentController.capturePayPalOrder,
);

// Payment Methods
paymentRoute.get("/", authGuard, paymentController.getPaymentMethods);
paymentRoute.delete("/:id", authGuard, paymentController.deletePaymentMethod);
paymentRoute.post(
  "/:id/default",
  authGuard,
  paymentController.setDefaultPaymentMethod,
);
