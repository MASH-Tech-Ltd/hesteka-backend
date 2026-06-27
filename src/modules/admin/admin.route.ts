import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { updateAdminConfigSchema } from "./admin.validation";
import { 
  getStats, 
  getConfig, 
  updateConfig, 
  getCrowdfundingStats,
  approveReportPoints,
  getUserStats,
  getReportStats,
  getPartnerStats,
  getMissionStats,
  getDonationStats,
  getPhysicalItemStats,
  getCollectionPointStats,
  getAnalytics,
  getOnlineUsers
} from "./admin.controller";

const router = Router();

// Public routes
router.get("/crowdfunding", getCrowdfundingStats);

// Admin routes
router.get("/stats", authGuard, allowRole("admin"), getStats);
router.get("/analytics", authGuard, allowRole("admin"), getAnalytics);
router.get("/config", authGuard, allowRole("admin"), getConfig);
router.patch(
  "/config", 
  authGuard, 
  allowRole("admin"), 
  validateRequest(updateAdminConfigSchema), 
  updateConfig
);

router.patch(
  "/approve-report-points/:reportId",
  authGuard,
  allowRole("admin"),
  approveReportPoints
);

router.get("/stats/users", authGuard, allowRole("admin"), getUserStats);
router.get("/stats/reports", authGuard, allowRole("admin"), getReportStats);
router.get("/stats/partners", authGuard, allowRole("admin"), getPartnerStats);
router.get("/stats/missions", authGuard, allowRole("admin"), getMissionStats);
router.get("/stats/donations", authGuard, allowRole("admin"), getDonationStats);
router.get("/stats/items", authGuard, allowRole("admin"), getPhysicalItemStats);
router.get("/stats/collection-points", authGuard, allowRole("admin"), getCollectionPointStats);

router.get("/online-users", authGuard, allowRole("admin"), getOnlineUsers);

export const adminRoute = router;
