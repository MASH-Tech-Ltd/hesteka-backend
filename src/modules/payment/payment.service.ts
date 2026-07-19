import { stripe } from "../../lib/stripe";
import { paymentModel } from "./payment.models";
import { userModel } from "../usersAuth/user.models";
import {
  CapturePayPalOrderPayload,
  CreatePayPalOrderPayload,
  CreateStripePaymentIntentPayload,
  IPayment,
  PaymentCurrency,
  PaymentProvider,
  PaymentStatus,
} from "./payment.interface";
import CustomError from "../../helpers/CustomError";
import config from "../../config";

/* ================= Stripe ================= */

const getOrCreateStripeCustomer = async (userId: string): Promise<string> => {
  const user = await userModel.findById(userId);
  if (!user) throw new CustomError(404, "User not found");

  if (user.stripeCustomerId) {
    try {
      // Verify the customer exists in the current Stripe account
      await stripe.customers.retrieve(user.stripeCustomerId);
      return user.stripeCustomerId;
    } catch (error: any) {
      // If customer is not found, we'll clear it and create a new one
      if (
        error.code === "resource_missing" ||
        error.message.includes("No such customer")
      ) {
        (user as any).stripeCustomerId = undefined;
        // Continue to creation logic below
      } else {
        throw error;
      }
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user._id.toString(),
    },
  });

  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
};

const createStripeSetupIntent = async (
  userId: string,
): Promise<{
  clientSecret: string;
  customerId: string;
  customerEphemeralKeySecret: string;
}> => {
  const customerId = await getOrCreateStripeCustomer(userId);

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: "2026-02-25.clover" },
  );

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
  });

  if (!setupIntent.client_secret || !ephemeralKey.secret) {
    throw new CustomError(500, "Failed to create setup intent");
  }

  return {
    clientSecret: setupIntent.client_secret,
    customerId,
    customerEphemeralKeySecret: ephemeralKey.secret,
  };
};

const getPaymentMethods = async (userId: string) => {
  const customerId = await getOrCreateStripeCustomer(userId);

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  const customer = await stripe.customers.retrieve(customerId);
  const defaultMethod = (customer as any).invoice_settings
    ?.default_payment_method;

  return paymentMethods.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "",
    last4: pm.card?.last4 ?? "",
    cardholderName: pm.billing_details.name || null,
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    isDefault: pm.id === defaultMethod,
  }));
};

const deletePaymentMethod = async (paymentMethodId: string) => {
  await stripe.paymentMethods.detach(paymentMethodId);
};

const setDefaultPaymentMethod = async (
  userId: string,
  paymentMethodId: string,
) => {
  const customerId = await getOrCreateStripeCustomer(userId);

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
};

const createStripePaymentIntent = async (
  payload: CreateStripePaymentIntentPayload & { userId?: string },
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  const { amount, currency, payerEmail, payerName, userId } = payload;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata: {
      payerEmail,
      payerName,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new CustomError(500, "Failed to create payment intent");
  }

  // ✅ PAYMENT PENDING
  await paymentModel.create({
    provider: PaymentProvider.STRIPE,
    providerTransactionId: paymentIntent.id,
    amount,
    currency,
    status: PaymentStatus.PENDING,
    payerEmail,
    payerName,
    user: userId || null,
    metadata: paymentIntent.metadata,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
};

const cancelStripePaymentIntent = async (paymentIntentId: string): Promise<any> => {
  try {
    const canceledIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    
    await paymentModel.findOneAndUpdate(
      { providerTransactionId: paymentIntentId },
      { status: PaymentStatus.CANCELLED }
    );
    
    return canceledIntent;
  } catch (error) {
    throw new CustomError(500, "Failed to cancel payment intent");
  }
};

const handleStripeWebhook = async (
  paymentIntentId: string,
  status: PaymentStatus,
  metadata: Record<string, any>,
  amount: number,
  currency: string,
): Promise<IPayment> => {
  const existing = await paymentModel.findOne({
    provider: PaymentProvider.STRIPE,
    providerTransactionId: paymentIntentId,
  });

  if (existing) {
    existing.status = status;
    await existing.save();
    return existing;
  }

  const payment = await paymentModel.create({
    provider: PaymentProvider.STRIPE,
    providerTransactionId: paymentIntentId,
    amount: amount / 100, // convert back from cents
    currency: currency as PaymentCurrency,
    status,
    payerEmail: metadata.payerEmail,
    payerName: metadata.payerName,
    metadata,
  });

  return payment;
};

/* ================= PayPal ================= */

const getPayPalAccessToken = async (): Promise<string> => {
  const { clientId, clientSecret, mode } = config.paypal;
  const baseUrl =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new CustomError(500, "Failed to get PayPal access token");
  }

  return data.access_token;
};

const createPayPalOrder = async (
  payload: CreatePayPalOrderPayload & { userId?: string | null },
): Promise<{ orderId: string; approvalUrl: string }> => {
  const { amount, currency, payerEmail, payerName, userId } = payload;
  const { mode } = config.paypal;

  const baseUrl =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      application_context: {
        return_url: `${config.frontendUrl}/payment-success`,
        cancel_url: `${config.frontendUrl}/payment-cancel`,
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: amount.toFixed(2),
          },
          custom_id: JSON.stringify({ payerEmail, payerName }),
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new CustomError(500, "Failed to create PayPal order");
  }

  // ✅ approval URL বের করো
  const approvalUrl = data.links?.find(
    (link: any) => link.rel === "approve",
  )?.href;

  if (!approvalUrl) {
    throw new CustomError(500, "PayPal approval URL not found");
  }

  // PENDING payment create
  await paymentModel.create({
    provider: PaymentProvider.PAYPAL,
    providerTransactionId: data.id,
    amount,
    currency,
    status: PaymentStatus.PENDING,
    payerEmail,
    payerName,
    user: userId || null,
    metadata: { payerEmail, payerName },
  });

  return { orderId: data.id, approvalUrl }; // ✅ approvalUrl return
};

// ✅ শুধু PayPal side capture করবে — DB তে লিখবে না
const capturePayPalOrder = async (
  payload: CapturePayPalOrderPayload,
): Promise<{ captureId: string; orderId: string }> => {
  const { orderId } = payload;
  const { mode } = config.paypal;

  const baseUrl =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new CustomError(500, "Failed to capture PayPal order");
  }

  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;

  if (!captureId) {
    throw new CustomError(500, "PayPal capture ID not found");
  }

  // ✅ captureId টা orderId এর সাথে link করতে payment record update
  await paymentModel.findOneAndUpdate(
    {
      provider: PaymentProvider.PAYPAL,
      providerTransactionId: orderId,
    },
    {
      $set: {
        captureId,
        status: PaymentStatus.COMPLETED, // API capture সাকসেস হলে সাথে সাথেই স্ট্যাটাস আপডেট করে দিচ্ছি
      },
    },
  );

  return { captureId, orderId };
};

const handleWebhookPayment = async (
  provider: PaymentProvider,
  providerTransactionId: string,
  status: PaymentStatus,
  metadata: Record<string, any>,
  amount: number,
  currency: PaymentCurrency,
): Promise<IPayment> => {
  const existing = await paymentModel.findOne({
    provider,
    providerTransactionId,
  });

  if (existing) {
    existing.status = status;
    await existing.save();
    return existing;
  }

  const payment = await paymentModel.create({
    provider,
    providerTransactionId,
    amount,
    currency,
    status,
    payerEmail: metadata.payerEmail ?? "",
    payerName: metadata.payerName ?? "",
    metadata,
  });

  return payment;
};

export const paymentService = {
  createStripePaymentIntent,
  cancelStripePaymentIntent,
  createStripeSetupIntent,
  getPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  handleStripeWebhook,
  createPayPalOrder,
  capturePayPalOrder,
  handleWebhookPayment,
};
