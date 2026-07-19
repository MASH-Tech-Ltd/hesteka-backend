import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { donationService } from "./donation.service";
import { DonationType } from "./donation.interface";
import { emitToAdmin } from "../../socket/server";

const initiateStripeDonation = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      amount,
      type,
      donorEmail,
      donorName,
      isCompanyDonation,
      companyInfo,
    } = req.body;

    const result = await donationService.initiateStripeDonation({
      amount,
      type,
      donorEmail,
      donorName,
      isCompanyDonation,
      companyInfo,
      payerEmail: donorEmail,
      payerName: donorName,
    });

    try {
      emitToAdmin("donation_new", { 
        method: "stripe", 
        amount: amount, 
        donor: donorEmail,
        status: "pending" 
      });
    } catch (err) {
      console.error("Socket emit failed", err);
    }

    return ApiResponse.sendSuccess(
      res,
      200,
      "Stripe donation initiated successfully",
      result,
    );
  },
);

const cancelStripeDonation = asyncHandler(
  async (req: Request, res: Response) => {
    const { paymentIntentId } = req.body;

    const result = await donationService.cancelStripeDonation(paymentIntentId);

    return ApiResponse.sendSuccess(
      res,
      200,
      "Stripe donation cancelled successfully",
      result,
    );
  },
);

const initiatePayPalDonation = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      amount,
      type,
      donorEmail,
      donorName,
      isCompanyDonation,
      companyInfo,
    } = req.body;

    const result = await donationService.initiatePayPalDonation({
      amount,
      type,
      donorEmail,
      donorName,
      isCompanyDonation,
      companyInfo,
      payerEmail: donorEmail,
      payerName: donorName,
    });

    try {
      emitToAdmin("donation_new", { 
        method: "paypal", 
        amount: amount, 
        donor: donorEmail,
        status: "pending" 
      });
    } catch (err) {
      console.error("Socket emit failed", err);
    }

    return ApiResponse.sendSuccess(
      res,
      200,
      "PayPal donation initiated successfully",
      result,
    );
  },
);

const cancelPayPalDonation = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.body;

    const result = await donationService.cancelPayPalDonation(orderId);

    return ApiResponse.sendSuccess(
      res,
      200,
      "PayPal donation cancelled successfully",
      result,
    );
  },
);

const capturePayPalDonation = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.body;

    // শুধু orderId দরকার এখন
    const result = await donationService.capturePayPalDonation({ orderId });

    return ApiResponse.sendSuccess(
      res,
      200,
      "PayPal payment captured, waiting for webhook confirmation",
      result,
    );
  },
);

const getAllDonations = asyncHandler(async (req: Request, res: Response) => {
  const { donations, meta } = await donationService.getAllDonations(req);
  return ApiResponse.sendSuccess(
    res,
    200,
    "Donations fetched successfully",
    donations,
    meta,
  );
});

const getSingleDonation = asyncHandler(async (req: Request, res: Response) => {
  const result = await donationService.getSingleDonation(
    req.params.donationId as string,
  );
  return ApiResponse.sendSuccess(
    res,
    200,
    "Donation fetched successfully",
    result,
  );
});

const getDonationStats = asyncHandler(async (req: Request, res: Response) => {
  const { period } = req.query;
  const result = await donationService.getDonationStats(period as string);
  return ApiResponse.sendSuccess(
    res,
    200,
    "Donation stats fetched successfully",
    result,
  );
});

const getDonationByReceiptId = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await donationService.getDonationByReceiptId(
      req.params.receiptId as string,
    );
    return ApiResponse.sendSuccess(
      res,
      200,
      "Donation fetched successfully",
      result,
    );
  },
);

const sendReceiptEmail = asyncHandler(async (req: Request, res: Response) => {
  const { donationId } = req.params;
  const { isFiscal } = req.body;
  await donationService.sendReceiptEmail(donationId as string, !!isFiscal);
  return ApiResponse.sendSuccess(
    res,
    200,
    "Receipt sent successfully to donor",
  );
});

const deleteDonation = asyncHandler(async (req: Request, res: Response) => {
  const { donationId } = req.params;
  await donationService.deleteDonation(donationId as string);
  return ApiResponse.sendSuccess(
    res,
    200,
    "Donation deleted successfully",
  );
});

const getMyDonations = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user?.email;
  if (!email) {
    return ApiResponse.sendError(res, 401, "Unauthorized: No email found");
  }
  const donations = await donationService.getMyDonations(email);
  return ApiResponse.sendSuccess(
    res,
    200,
    "My donations fetched successfully",
    donations,
  );
});

export const donationController = {
  initiateStripeDonation,
  cancelStripeDonation,
  initiatePayPalDonation,
  cancelPayPalDonation,
  capturePayPalDonation,
  getAllDonations,
  getSingleDonation,
  getDonationStats,
  getDonationByReceiptId,
  getMyDonations,
  sendReceiptEmail,
  deleteDonation,
};
