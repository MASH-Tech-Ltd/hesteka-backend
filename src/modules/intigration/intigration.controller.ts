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
    throw new CustomError(500, "API Key is not configured");
  }

  try {
    const decryptedKey = decrypt(settings.shopifyApiKey);
    if (providedKey !== decryptedKey) {
      throw new CustomError(401, "Invalid API Key");
    }
  } catch (err) {
    throw new CustomError(401, "Invalid API Key");
  }

  // Validate allowed domain if one is configured
  if (settings.shopifyAllowedDomain) {
    const requestOrigin = req.headers.origin || req.headers.referer || "";
    
    try {
      // Use URL parsing to ensure exact origin matching (prevents bypasses like domain.com.evil.com)
      const configuredUrl = new URL(settings.shopifyAllowedDomain.trim());
      const incomingUrl = new URL(requestOrigin.trim());

      // Enforce HTTPS on the incoming origin (unless running in local development mode for testing)
      if (incomingUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
        throw new CustomError(403, "Origin domain must be secured.");
      }

      if (configuredUrl.origin !== incomingUrl.origin) {
        throw new CustomError(403, "Origin domain is not allowed.");
      }
    } catch (error: any) {
      // If CustomError was thrown inside try, rethrow it
      if (error instanceof CustomError) throw error;
      // Otherwise, URL parsing failed meaning it's an invalid origin
      throw new CustomError(403, "Origin domain is not allowed. Check your Shopify Integration settings.");
    }
  }

  // Fetch users
  const result = await intigrationService.getShopifyUsersEmails(req.query);

  res.status(200).json({
    status: "ok",
    message: "Users fetched successfully",
    data: result.data,
    meta: result.meta
  });
});
