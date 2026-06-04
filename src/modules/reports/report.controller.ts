import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { reportService } from "./report.service";

export const createReport = asyncHandler(async (req: Request, res: Response) => {
  const authorId = req.user?._id;
  if (!authorId) {
    throw new Error("User ID not found in request");
  }

  const report = await reportService.createReport(req);
  ApiResponse.sendSuccess(res, 201, "Report created successfully", report);
});

export const getAllReports = asyncHandler(async (req: Request, res: Response) => {
  const { reports, meta } = await reportService.getAllReports(req);
  ApiResponse.sendSuccess(res, 200, "Reports fetched successfully", reports, meta);
});

export const getMyReports = asyncHandler(async (req: Request, res: Response) => {
  const { reports, meta } = await reportService.getMyReports(req);
  ApiResponse.sendSuccess(res, 200, "My reports fetched successfully", reports, meta);
});

export const getReportById = asyncHandler(async (req: Request, res: Response) => {
  const { reportId } = req.params as { reportId: string };
  const report = await reportService.getReportById(reportId);
  ApiResponse.sendSuccess(res, 200, "Report fetched successfully", report);
});

export const updateReport = asyncHandler(async (req: Request, res: Response) => {
  const authorId = req.user?._id;
  if (!authorId) {
    throw new Error("User ID not found in request");
  }

  const updatedReport = await reportService.updateReport(req);
  ApiResponse.sendSuccess(res, 200, "Report updated successfully", updatedReport);
});

export const deleteReport = asyncHandler(async (req: Request, res: Response) => {
  const authorId = req.user?._id;
  const userRole = req.user?.role;
  if (!authorId) {
    throw new Error("User ID not found in request");
  }

  const { reportId } = req.params as { reportId: string };
  await reportService.deleteReport(authorId.toString(), reportId, userRole);
  ApiResponse.sendSuccess(res, 200, "Report deleted successfully");
});

export const addImage = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.addImage(req);
  ApiResponse.sendSuccess(res, 200, "Image added successfully", result);
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.removeImage(req);
  ApiResponse.sendSuccess(res, 200, "Image removed successfully", result);
});
