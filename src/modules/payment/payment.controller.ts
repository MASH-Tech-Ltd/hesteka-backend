import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { paymentService } from "./payment.service";
import {
  CreatePayPalOrderPayload,
  CreateStripePaymentIntentPayload,
  CapturePayPalOrderPayload,
  PaymentCurrency,
} from "./payment.interface";

const createStripePaymentIntent = asyncHandler(
  async (req: Request, res: Response) => {
    const payload: CreateStripePaymentIntentPayload = req.body;

    const result = await paymentService.createStripePaymentIntent({
      ...payload,
      userId: req.user?._id as string,
    });

    return ApiResponse.sendSuccess(
      res,
      200,
      "Payment intent created successfully",
      result,
    );
  },
);

const createPayPalOrder = asyncHandler(async (req: Request, res: Response) => {
  const payload: CreatePayPalOrderPayload = req.body;

  const result = await paymentService.createPayPalOrder({
    ...payload,
    userId: req.user?._id as string,
  });

  return ApiResponse.sendSuccess(
    res,
    200,
    "PayPal order created successfully",
    result,
  );
});

const capturePayPalOrder = asyncHandler(async (req: Request, res: Response) => {
  const payload: CapturePayPalOrderPayload = req.body;

  const result = await paymentService.capturePayPalOrder(payload);

  return ApiResponse.sendSuccess(
    res,
    200,
    "PayPal payment captured successfully",
    result,
  );
});

const createStripeSetupIntent = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await paymentService.createStripeSetupIntent(
      req.user?._id as string,
    );
    return ApiResponse.sendSuccess(
      res,
      200,
      "Setup intent created successfully",
      result,
    );
  },
);

const getPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.getPaymentMethods(
    req.user?._id as string,
  );
  return ApiResponse.sendSuccess(
    res,
    200,
    "Payment methods fetched successfully",
    result,
  );
});

const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  await paymentService.deletePaymentMethod(req.params.id as string);
  return ApiResponse.sendSuccess(
    res,
    200,
    "Payment method deleted successfully",
  );
});

const setDefaultPaymentMethod = asyncHandler(
  async (req: Request, res: Response) => {
    await paymentService.setDefaultPaymentMethod(
      req.user?._id as string,
      req.params.id as string,
    );
    return ApiResponse.sendSuccess(
      res,
      200,
      "Default payment method updated successfully",
    );
  },
);

export const paymentController = {
  createStripePaymentIntent,
  createPayPalOrder,
  capturePayPalOrder,
  createStripeSetupIntent,
  getPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
};
