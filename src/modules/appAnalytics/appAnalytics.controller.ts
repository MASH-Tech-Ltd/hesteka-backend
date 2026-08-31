import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { appAnalyticsService } from "./appAnalytics.service";
import ApiResponse from "../../utils/apiResponse";

export const logEvent = asyncHandler(async (req: Request, res: Response) => {
  const result = await appAnalyticsService.logEvent(req.body);
  ApiResponse.sendSuccess(res, 201, "Event logged successfully", result);
});

export const getRetentionStats = asyncHandler(async (req: Request, res: Response) => {
  const { timeframe } = req.query;
  const stats = await appAnalyticsService.getRetentionStats(timeframe as string);
  ApiResponse.sendSuccess(res, 200, "Retention stats fetched successfully", stats);
});
