import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { settingsService } from "./settings.service";
import { runBackup } from "../../database/backup.cron";
import { BackupLogModel } from "../../database/backupLog.models";

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.getSettings();
  ApiResponse.sendSuccess(res, 200, "Settings fetched successfully", result);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.updateSettings(req.body);
  ApiResponse.sendSuccess(res, 200, "Settings updated successfully", result);
});

export const syncDatabaseData = asyncHandler(async (req: Request, res: Response) => {
  const result = await runBackup("manual");
  if (result && !result.success) {
    ApiResponse.sendSuccess(res, 200, result.message || "Sync bypassed due to safety checks", result);
  } else {
    ApiResponse.sendSuccess(res, 200, "Database synchronized successfully", result);
  }
});

export const getBackupLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await BackupLogModel.find().sort({ timestamp: -1 }).limit(100);
  ApiResponse.sendSuccess(res, 200, "Backup history logs fetched successfully", result);
});
