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

// Stripe
paymentRoute.post(
  "/stripe/create-payment-intent",
  paymentLimiter,
  validateRequest(createStripePaymentIntentSchema),
  paymentController.createStripePaymentIntent,
);

paymentRoute.post(
  "/stripe/create-setup-intent",
  authGuard,
  paymentLimiter,
  paymentController.createStripeSetupIntent,
);

// PayPal
paymentRoute.post(
  "/paypal/create-order",
  paymentLimiter,
  validateRequest(createPayPalOrderSchema),
  paymentController.createPayPalOrder,
);

paymentRoute.post(
  "/paypal/capture-order",
  paymentLimiter,
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
