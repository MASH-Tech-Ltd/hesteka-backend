import { Router } from "express";
import { logEvent, getRetentionStats } from "./appAnalytics.controller";
import { allowRole, authGuard } from "../../middleware/auth.middleware";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Public route for mobile app — limited to 30 events/15 min per IP to prevent spam
router.post("/event", rateLimiter(15, 30, "Too many analytics events. Please slow down."), logEvent);

// Protected admin route
router.get("/admin/retention", authGuard, allowRole("admin"), getRetentionStats);

export const appAnalyticsRoutes = router;
