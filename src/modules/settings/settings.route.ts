import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { role } from "../usersAuth/user.interface";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";
import { getSettings, updateSettings, syncDatabaseData, getBackupLogs, getBackupFiles, downloadBackupFile, generateShopifyApiKey, getShopifyApiKey } from "./settings.controller";

const router = Router();

// Public route to get settings (e.g. support email)
router.get("/", rateLimiter(15, 30, "Too many settings requests from this IP."), getSettings);

// Admin only routes
router.patch("/", authGuard, allowRole(role.ADMIN), updateSettings);
router.post("/sync", authGuard, allowRole(role.ADMIN), syncDatabaseData);
router.get("/backup-logs", authGuard, allowRole(role.ADMIN), getBackupLogs);
router.get("/backup-files", authGuard, allowRole(role.ADMIN), getBackupFiles);
router.get("/download-backup/:filename", authGuard, allowRole(role.ADMIN), downloadBackupFile);

router.post("/shopify-key", authGuard, allowRole(role.ADMIN), generateShopifyApiKey);
router.get("/shopify-key", authGuard, allowRole(role.ADMIN), getShopifyApiKey);

export const settingsRoute = router;
