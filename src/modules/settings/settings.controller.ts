import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { settingsService } from "./settings.service";
import { runBackup } from "../../database/backup.cron";
import { BackupLogModel } from "../../database/backupLog.models";
import { settingsModel } from "./settings.models";

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

export const getBackupFiles = asyncHandler(async (req: Request, res: Response) => {
  const backupsDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) {
    return ApiResponse.sendSuccess(res, 200, "Backup files fetched successfully", []);
  }
  const files = fs.readdirSync(backupsDir).filter(f => f.endsWith(".json.gz") || f.endsWith(".jsonl.gz"));
  const fileList = files.map(filename => {
    const filePath = path.join(backupsDir, filename);
    const stats = fs.statSync(filePath);
    return {
      filename,
      sizeBytes: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2),
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      createdAt: stats.mtime
    };
  });
  fileList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  ApiResponse.sendSuccess(res, 200, "Backup files fetched successfully", fileList);
});

export const downloadBackupFile = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!filename || typeof filename !== "string" || filename.includes("..") || !(filename.endsWith(".json.gz") || filename.endsWith(".jsonl.gz"))) {
    res.status(400).json({ status: "error", message: "Invalid backup filename" });
    return;
  }
  const backupsDir = path.join(process.cwd(), "backups");
  const filePath = path.join(backupsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ status: "error", message: "Backup file not found on server disk" });
    return;
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error("[Backup Download] Error sending file:", err);
    }
  });
});

export const generateShopifyApiKey = asyncHandler(async (req: Request, res: Response) => {
  const crypto = require("crypto");
  const { encrypt, decrypt } = require("../../utils/encryption");

  const newKey = crypto.randomBytes(32).toString("hex");
  const encryptedKey = encrypt(newKey);
  
  await settingsModel.findOneAndUpdate({}, { shopifyApiKey: encryptedKey }, { upsert: true });

  ApiResponse.sendSuccess(res, 200, "API Key generated successfully", { apiKey: newKey });
});

export const getShopifyApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { decrypt } = require("../../utils/encryption");
  const settings = await settingsModel.findOne();
  
  if (!settings || !settings.shopifyApiKey) {
    return ApiResponse.sendSuccess(res, 200, "No API Key configured", { apiKey: null });
  }

  try {
    const decryptedKey = decrypt(settings.shopifyApiKey);
    ApiResponse.sendSuccess(res, 200, "API Key retrieved successfully", { apiKey: decryptedKey });
  } catch (err) {
    ApiResponse.sendSuccess(res, 200, "Failed to decrypt API Key", { apiKey: null });
  }
});
