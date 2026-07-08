import { Request, Response } from "express";
import { DonationCategory, RefusalReason } from "./donationProof.interface";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { donationProofService } from "./donationProof.service";

import { pointConfigModel } from "../points/pointConfig.models";

export const getAcceptedValues = asyncHandler(async (req: Request, res: Response) => {
  const categories = Object.values(DonationCategory);
  const refusalReasons = Object.values(RefusalReason);
  
  const config = await pointConfigModel.findOne();
  const pointsPerDonation = config ? (config.isDoublePointsActive ? config.pointsPerDonation * 2 : config.pointsPerDonation) : 15;
  
  ApiResponse.sendSuccess(res, 200, "Accepted values fetched successfully", {
    categories,
    refusalReasons,
    pointsPerDonation
  });
});

//: submit donation proof
export const submitProof = asyncHandler(async (req: Request, res: Response) => {
  const result = await donationProofService.submitProof(req);
  ApiResponse.sendSuccess(res, 201, "Donation proof submitted successfully. Pending admin approval.", result);
});

//: get pending proofs (Admin)
export const getPendingProofs = asyncHandler(async (req: Request, res: Response) => {
  const { proofs, meta } = await donationProofService.getPendingProofs(req);
  ApiResponse.sendSuccess(res, 200, "Pending donation proofs fetched successfully", proofs, meta);
});

//: get all proofs (Admin)
export const getAllProofs = asyncHandler(async (req: Request, res: Response) => {
  const { proofs, meta } = await donationProofService.getAllProofs(req);
  ApiResponse.sendSuccess(res, 200, "All donation proofs fetched successfully", proofs, meta);
});

//: validate/approve proof (Admin)
export const validateProof = asyncHandler(async (req: Request, res: Response) => {
  const { donationProofId } = req.params;
  const result = await donationProofService.validateProof(donationProofId as string, req.body);
  ApiResponse.sendSuccess(res, 200, "Donation proof approved and points awarded", result);
});

//: reject proof (Admin)
export const rejectProof = asyncHandler(async (req: Request, res: Response) => {
  const { donationProofId } = req.params;
  const { adminNote, refusalReason } = req.body;
  const result = await donationProofService.rejectProof(donationProofId as string, adminNote, refusalReason);
  ApiResponse.sendSuccess(res, 200, "Donation proof rejected", result);
});

//: validate all pending proofs (Admin)
export const validateAll = asyncHandler(async (req: Request, res: Response) => {
  const result = await donationProofService.validateAll();
  ApiResponse.sendSuccess(res, 200, result.message, result);
});

//: get validation stats (Admin)
export const getValidationStats = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as string) || "monthly";
  const result = await donationProofService.getValidationStats(period);
  ApiResponse.sendSuccess(res, 200, "Validation stats fetched successfully", result);
});

//: get partner proofs (Partner)
export const getPartnerProofs = asyncHandler(async (req: Request, res: Response) => {
  const { proofs, meta } = await donationProofService.getPartnerProofs(req);
  ApiResponse.sendSuccess(res, 200, "Partner donation proofs fetched successfully", proofs, meta);
});

//: get partner validation stats (Partner)
export const getPartnerValidationStats = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as string) || "monthly";
  const result = await donationProofService.getPartnerValidationStats(req, period);
  ApiResponse.sendSuccess(res, 200, "Partner validation stats fetched successfully", result);
});

//: get collection point donations count (Public)
export const getCollectionPointDonationsCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await donationProofService.getCollectionPointDonationsCount();
  ApiResponse.sendSuccess(
    res,
    200,
    "Collection point donations count fetched successfully",
    { count },
  );
});

