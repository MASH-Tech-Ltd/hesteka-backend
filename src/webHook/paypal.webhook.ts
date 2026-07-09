import { Request, Response } from "express";
import { notificationService } from "../modules/notifications/notification.service";
import { NotificationType } from "../modules/notifications/notification.interface";
import { pointService } from "../modules/points/point.service";
import config from "../config";
import { paymentModel } from "../modules/payment/payment.models";
import { donationModel } from "../modules/donation/donation.models";
import {
  PaymentProvider,
  PaymentStatus,
  PaymentCurrency,
} from "../modules/payment/payment.interface";
import { getIo } from "../socket/server";
import mongoose from "mongoose";

const verifyPayPalWebhook = async (
  headers: Record<string, string>,
  rawBody: string,
): Promise<boolean> => {
  const { clientId, clientSecret, mode, webhookId } = config.paypal;
  const baseUrl =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return false;

  const verifyPayload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: String(webhookId || ""),
    webhook_event: JSON.parse(rawBody),
  };

  const verifyRes = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(verifyPayload),
    },
  );

  const verifyData = await verifyRes.json();

  if (verifyData.verification_status !== "SUCCESS") {
    console.error("PayPal Webhook Signature Verification Failed!", {
      status: verifyData.verification_status,
      transmissionId: headers["paypal-transmission-id"],
      debug_id: verifyData.debug_id,
    });
  }

  return verifyData.verification_status === "SUCCESS";
};

export const paypalWebhookHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const rawBody =
    req.body instanceof Buffer
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);

  const isValid = await verifyPayPalWebhook(
    req.headers as Record<string, string>,
    rawBody,
  );

  if (!isValid) {
    res.status(400).json({ message: "PayPal webhook verification failed" });
    return;
  }

  const event = req.body instanceof Buffer ? JSON.parse(rawBody) : req.body;

  console.log(`PayPal Webhook Received: ${event.event_type}`);

  try {
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const capture = event.resource;
          const captureId = capture.id;

          // ✅ Find payment by captureId
          // PayPal payment was previously created using orderId,
          // captureId is set after the capture
          let payment = await paymentModel.findOneAndUpdate(
            {
              provider: PaymentProvider.PAYPAL,
              captureId,
            },
            { $set: { status: PaymentStatus.COMPLETED } },
            { returnDocument: 'after', session },
          );

          // fallback — if not found by captureId (Race condition), search by orderId
          if (!payment) {
            const orderId = capture.supplementary_data?.related_ids?.order_id;
            console.log(
              `Payment not found by captureId ${captureId}, trying orderId: ${orderId}`,
            );

            if (orderId) {
              payment = await paymentModel.findOneAndUpdate(
                {
                  provider: PaymentProvider.PAYPAL,
                  providerTransactionId: orderId,
                },
                {
                  $set: { status: PaymentStatus.COMPLETED, captureId: captureId },
                },
                { returnDocument: 'after', session },
              );
            }
          }

          if (!payment) {
            console.error(`PayPal Payment not found for Capture: ${captureId}`);
            await session.abortTransaction();
            session.endSession();
            break;
          }

          // ✅ donation update
          await donationModel.updateOne(
            { payment: payment._id },
            { $set: { status: "completed" } }, // Lowercase matches schema enum
            { session },
          );

          // 🎁 Award points for donation if user ID is available
          if (payment.user) {
            try {
              await pointService.awardPointsForDonation(
                payment.user.toString(),
                payment.amount,
              );
            } catch (err) {
              console.error("Error awarding points for donation:", err);
              // Don't fail the webhook if points awarding fails
            }
          }

          notificationService.notifyAdmins(
            "Payment Received",
            `A new payment of ${payment.amount} ${payment.currency.toUpperCase()} was received from ${payment.payerEmail} via PayPal.`,
            NotificationType.NEW_PAYMENT
          ).catch((err) => console.error("Admin Notification Error:", err));

          console.log(
            `Donation and Payment completed for: ${payment.payerEmail}`,
          );

          // ✅ Socket emit similar to Stripe
          const io = getIo();
          io.to(payment.payerEmail).emit("payment:update", {
            orderId: payment.providerTransactionId,
            captureId,
            status: "COMPLETED",
          });

          // Notify admins to refresh their lists
          io.emit("donation_new", { 
            method: "paypal", 
            amount: payment.amount, 
            donor: payment.payerEmail 
          });

          await session.commitTransaction();
          session.endSession();
        } catch (err) {
          await session.abortTransaction();
          session.endSession();
          throw err;
        }

        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const capture = event.resource;

          const payment = await paymentModel.findOneAndUpdate(
            { provider: PaymentProvider.PAYPAL, captureId: capture.id },
            { $set: { status: PaymentStatus.FAILED } },
            { returnDocument: 'after', session },
          );

          if (payment) {
            await donationModel.updateOne(
              { payment: payment._id },
              { $set: { status: "cancelled" } },
              { session },
            );

            const io = getIo();
            io.to(payment.payerEmail).emit("payment:update", {
              captureId: capture.id,
              status: "FAILED",
            });
          }

          await session.commitTransaction();
          session.endSession();
        } catch (err) {
          await session.abortTransaction();
          session.endSession();
          throw err;
        }

        break;
      }
      //TODO: no need to refund  right now just commneted
      // case "PAYMENT.CAPTURE.REFUNDED": {
      //   const capture = event.resource;

      //   await paymentModel.findOneAndUpdate(
      //     { provider: PaymentProvider.PAYPAL, captureId: capture.id },
      //     { $set: { status: PaymentStatus.REFUNDED } },
      //   );

      //   break;
      // }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ message: "Webhook processing failed" });
  }
};
