import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { intigrationService } from "./intigration.service";
import { settingsModel } from "../settings/settings.models";
import { decrypt } from "../../utils/encryption";
import CustomError from "../../helpers/CustomError";

export const getShopifyUsers = asyncHandler(async (req: Request, res: Response) => {
  // Enforce HTTPS
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (!isHttps && process.env.NODE_ENV === "production") {
    throw new CustomError(403, "HTTPS is required for this endpoint");
  }

  // Verify API Key
  const providedKey = req.headers["x-api-key"] as string;
  if (!providedKey) {
    throw new CustomError(401, "Missing API Key");
  }

  const settings = await settingsModel.findOne();
  if (!settings || !settings.shopifyApiKey) {
    throw new CustomError(500, "Shopify API Key is not configured on the server");
  }

  try {
    const decryptedKey = decrypt(settings.shopifyApiKey);
    if (providedKey !== decryptedKey) {
      throw new CustomError(401, "Invalid API Key");
    }
  } catch (err) {
    throw new CustomError(401, "Invalid API Key");
  }

  // Fetch users
  const users = await intigrationService.getShopifyUsersEmails();

  ApiResponse.sendSuccess(res, 200, "Users fetched successfully", users);
});
