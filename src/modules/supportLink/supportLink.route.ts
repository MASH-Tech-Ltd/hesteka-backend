import { Router } from "express";
import { createSupportLink, getSupportLink } from "./supportLink.controller";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Admin only route
router.post(
  "/create-support-link",
  authGuard,
  allowRole("admin"),
  createSupportLink
);

// Public route
router.get("/get-support-link", rateLimiter(15, 30), getSupportLink);

export const supportLinkRoute = router;
