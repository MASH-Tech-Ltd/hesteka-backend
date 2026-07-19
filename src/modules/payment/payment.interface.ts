import { Document, Types } from "mongoose";

export enum PaymentProvider {
  STRIPE = "stripe",
  PAYPAL = "paypal",
}

export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
}

export enum PaymentCurrency {
  EUR = "eur",
  USD = "usd",
}

export interface IPayment extends Document {
  provider: PaymentProvider;
  providerTransactionId: string;
  amount: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  payerEmail: string;
  payerName: string;
  metadata?: Record<string, any>;
  user?: Types.ObjectId | null;
  captureId?: string;
}

export interface CreateStripePaymentIntentPayload {
  amount: number;
  currency: PaymentCurrency;
  payerEmail: string;
  payerName: string;
  userId?: string | null;
}

export interface CreatePayPalOrderPayload {
  amount: number ;
  currency: PaymentCurrency;
  payerEmail: string;
  payerName: string;
}

export interface CapturePayPalOrderPayload {
  orderId: string;
  payerEmail: string;
  payerName: string;
}
