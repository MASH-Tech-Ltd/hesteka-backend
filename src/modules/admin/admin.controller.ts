import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { adminService } from "./admin.service";
import { getOnlineUsersCount } from "../../socket/server";

//: get global stats (Admin)
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await adminService.getStats();
  ApiResponse.sendSuccess(
    res,
    200,
    "Global statistics fetched successfully",
    stats,
  );
});

//: get admin config (Admin)
export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await adminService.getConfig();
  ApiResponse.sendSuccess(
    res,
    200,
    "Admin configuration fetched successfully",
    config,
  );
});

//: update admin config (Admin)
export const updateConfig = asyncHandler(
  async (req: Request, res: Response) => {
    const config = await adminService.updateConfig(req.body);
    ApiResponse.sendSuccess(
      res,
      200,
      "Admin configuration updated successfully",
      config,
    );
  },
);



//: approve report points (Admin)
export const approveReportPoints = asyncHandler(
  async (req: Request, res: Response) => {
    const { reportId } = req.params;
    const result = await adminService.approveReportPoints(reportId as string);
    ApiResponse.sendSuccess(
      res,
      200,
      "Report points approved successfully",
      result,
    );
  },
);

//: get user stats (Admin)
export const getUserStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getUserStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "User statistics fetched successfully",
      stats,
    );
  },
);

//: get report stats (Admin)
export const getReportStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getReportStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "Report statistics fetched successfully",
      stats,
    );
  },
);

//: get partner stats (Admin)
export const getPartnerStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getPartnerStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "Partner statistics fetched successfully",
      stats,
    );
  },
);

//: get mission stats (Admin)
export const getMissionStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getMissionStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "Mission statistics fetched successfully",
      stats,
    );
  },
);

//: get donation stats (Admin)
export const getDonationStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getDonationStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "Donation statistics fetched successfully",
      stats,
    );
  },
);

//: get physical item stats (Admin)
export const getPhysicalItemStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getPhysicalItemStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "Physical item statistics fetched successfully",
      stats,
    );
  },
);

//: get collection point stats (Admin)
export const getCollectionPointStats = asyncHandler(
  async (req: Request, res: Response) => {
    const stats = await adminService.getCollectionPointStats();
    ApiResponse.sendSuccess(
      res,
      200,
      "Collection point statistics fetched successfully",
      stats,
    );
  },
);

//: get analytics data (Admin)
export const getAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await adminService.getAnalytics();
    ApiResponse.sendSuccess(
      res,
      200,
      "Analytics data fetched successfully",
      data,
    );
  },
);

//: get online users count (Admin)
export const getOnlineUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const count = getOnlineUsersCount();
    ApiResponse.sendSuccess(
      res,
      200,
      "Online users count fetched successfully",
      { online: count },
    );
  },
);
