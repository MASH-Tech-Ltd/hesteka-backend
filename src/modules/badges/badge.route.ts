import { Router } from "express";
import { badgeController } from "./badge.controller";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { role } from "../usersAuth/user.interface";
import { upload } from "../../middleware/multer.midleware";
import { contentLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Public or User accessible routes
router.get("/", contentLimiter, badgeController.getAllBadges);
router.get("/:id", contentLimiter, badgeController.getBadgeById);

// Admin only routes
router.use(authGuard, allowRole(role.ADMIN));
router.post("/", upload.single("icon"), badgeController.createBadge);
router.put("/:id", upload.single("icon"), badgeController.updateBadge);
router.delete("/:id", badgeController.deleteBadge);

export const badgeRoute = router;
