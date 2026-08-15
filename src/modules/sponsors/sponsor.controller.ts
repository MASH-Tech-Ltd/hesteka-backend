import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sponsorService } from "./sponsor.service";
import ApiResponse from "../../utils/apiResponse";

export const createSponsor = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const sponsor = await sponsorService.createSponsor(req.body, file);
  ApiResponse.sendSuccess(res, 201, "Sponsor created successfully", sponsor);
});

export const getAllSponsors = asyncHandler(async (req: Request, res: Response) => {
  const sponsors = await sponsorService.getAllSponsors();
  ApiResponse.sendSuccess(res, 200, "Sponsors fetched successfully", sponsors);
});

export const searchPartners = asyncHandler(async (req: Request, res: Response) => {
  const { query = "" } = req.query;
  const partners = await sponsorService.searchPartners(query as string);
  ApiResponse.sendSuccess(res, 200, "Partners fetched successfully", partners);
});

export const getSponsorById = asyncHandler(async (req: Request, res: Response) => {
  const sponsor = await sponsorService.getSponsorById(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Sponsor fetched successfully", sponsor);
});

export const updateSponsor = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const sponsor = await sponsorService.updateSponsor(req.params.id as string, req.body, file);
  ApiResponse.sendSuccess(res, 200, "Sponsor updated successfully", sponsor);
});

export const deleteSponsor = asyncHandler(async (req: Request, res: Response) => {
  const sponsor = await sponsorService.deleteSponsor(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Sponsor deleted successfully", sponsor);
});

export const getRandomSponsor = asyncHandler(async (req: Request, res: Response) => {
  const sponsor = await sponsorService.getRandomSponsor();
  if (!sponsor) {
    return ApiResponse.sendSuccess(res, 200, "No active sponsors available", null);
  }
  ApiResponse.sendSuccess(res, 200, "Sponsor fetched successfully", sponsor);
});

export const trackSponsor = asyncHandler(async (req: Request, res: Response) => {
  const { action } = req.query; // 'impression' or 'click'
  if (action !== "impression" && action !== "click") {
    return ApiResponse.sendError(res, 400, "Invalid track action");
  }
  const sponsor = await sponsorService.trackSponsor(req.params.id as string, action as "impression" | "click");
  ApiResponse.sendSuccess(res, 200, "Sponsor tracked successfully", sponsor);
});
