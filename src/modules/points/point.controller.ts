import { Request, Response } from "express";
import ApiResponse from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { pointService } from "./point.service";

export const getMyPoints = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.getMyPoints(req);
  return ApiResponse.sendSuccess(res, 200, "Points fetched successfully", result);
});

const redeemPoints = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.redeemPoints(req);
  return ApiResponse.sendSuccess(res, 200, "Points redeemed successfully", result);
});

const getPointConfig = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.getConfig();
  return ApiResponse.sendSuccess(res, 200, "Point config fetched successfully", result);
});

const updatePointConfig = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.updateConfig(req.body);
  return ApiResponse.sendSuccess(res, 200, "Point config updated successfully", result);
});

const getPointStats = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.getAdminStats();
  return ApiResponse.sendSuccess(res, 200, "Point stats fetched successfully", result);
});

const assignCustomPoints = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.assignCustomPoints(req);
  return ApiResponse.sendSuccess(res, 200, "Custom points assigned successfully", result);
});

const getAllPointHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await pointService.getAllPointHistory(req);
  return ApiResponse.sendSuccess(res, 200, "Point history fetched successfully", result);
});

export const pointController = {
  getMyPoints,
  redeemPoints,
  getPointConfig,
  updatePointConfig,
  getPointStats,
  assignCustomPoints,
  getAllPointHistory,
};
