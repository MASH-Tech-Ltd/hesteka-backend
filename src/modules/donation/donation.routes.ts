import express from "express";
import { donationController } from "./donation.controller";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  createStripeDonationSchema,
  createPayPalDonationSchema,
  capturePayPalDonationSchema,
} from "./donation.validation";

export const donationRoute = express.Router();

// Stripe
donationRoute.post(
  "/stripe/initiate",
  validateRequest(createStripeDonationSchema),
  donationController.initiateStripeDonation,
);
donationRoute.post(
  "/stripe/cancel",
  donationController.cancelStripeDonation,
);

// PayPal
donationRoute.post(
  "/paypal/initiate",
  // validateRequest(createPayPalDonationSchema),
  donationController.initiatePayPalDonation,
);

donationRoute.post(
  "/paypal/cancel",
  donationController.cancelPayPalDonation,
);

donationRoute.post(
  "/paypal/capture",
  // validateRequest(capturePayPalDonationSchema),
  donationController.capturePayPalDonation,
);

donationRoute.get(
  "/get-all-donation",
  authGuard,
  allowRole("admin"),
  donationController.getAllDonations,
);
donationRoute.get(
  "/stats",
  authGuard,
  allowRole("admin"),
  donationController.getDonationStats,
);

donationRoute.get(
  "/my-donations",
  authGuard,
  donationController.getMyDonations,
);

donationRoute.get(
  "/:donationId",
  authGuard,
  allowRole("admin"),
  donationController.getSingleDonation,
);

donationRoute.get(
  "/receipt/:receiptId",
  authGuard,
  allowRole("admin"),
  donationController.getDonationByReceiptId,
);

donationRoute.delete(
  "/:donationId",
  authGuard,
  allowRole("admin"),
  donationController.deleteDonation,
);

donationRoute.post(
  "/:donationId/send-receipt",
  authGuard,
  allowRole("admin"),
  donationController.sendReceiptEmail,
);
