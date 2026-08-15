import { Router } from "express";
import { logEvent, getRetentionStats } from "./appAnalytics.controller";
import { allowRole, authGuard } from "../../middleware/auth.middleware";

const router = Router();

// Public route for mobile app
router.post("/event", logEvent);

// Protected admin route
router.get("/admin/retention", authGuard, allowRole("admin"), getRetentionStats);

export const appAnalyticsRoutes = router;
