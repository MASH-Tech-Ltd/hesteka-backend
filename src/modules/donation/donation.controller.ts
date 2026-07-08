import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { donationService } from "./donation.service";
import { DonationType } from "./donation.interface";

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

    return ApiResponse.sendSuccess(
      res,
      200,
      "Stripe donation initiated successfully",
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

    return ApiResponse.sendSuccess(
      res,
      200,
      "PayPal donation initiated successfully",
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
  const result = await donationService.getDonationStats();
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
  initiatePayPalDonation,
  capturePayPalDonation,
  getAllDonations,
  getSingleDonation,
  getDonationStats,
  getDonationByReceiptId,
  getMyDonations,
  sendReceiptEmail,
};
