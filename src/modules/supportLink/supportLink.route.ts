import { Router } from "express";
import { createSupportLink, getSupportLink } from "./supportLink.controller";
import { authGuard, allowRole } from "../../middleware/auth.middleware";

const router = Router();

// Admin only route
router.post(
  "/create-support-link",
  authGuard,
  allowRole("admin"),
  createSupportLink
);

// Public route
router.get("/get-support-link", getSupportLink);

export const supportLinkRoute = router;
