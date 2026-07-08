import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { supportLinkService } from "./supportLink.service";

export const createSupportLink = asyncHandler(async (req: Request, res: Response) => {
  const { link } = req.body;
  if (!link) {
    throw new Error("Link is required");
  }
  const result = await supportLinkService.createOrUpdateLink(link);
  ApiResponse.sendSuccess(res, 200, "Support link updated successfully", result);
});

export const getSupportLink = asyncHandler(async (req: Request, res: Response) => {
  const result = await supportLinkService.getLink();
  ApiResponse.sendSuccess(res, 200, "Support link fetched successfully", result);
});
