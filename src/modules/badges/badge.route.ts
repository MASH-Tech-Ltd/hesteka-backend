import { Router } from "express";
import { badgeController } from "./badge.controller";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { role } from "../usersAuth/user.interface";
import { upload } from "../../middleware/multer.midleware";

const router = Router();

// Public or User accessible routes (if needed)
router.get("/", badgeController.getAllBadges);
router.get("/:id", badgeController.getBadgeById);

// Admin only routes
router.use(authGuard, allowRole(role.ADMIN));
router.post("/", upload.single("icon"), badgeController.createBadge);
router.put("/:id", upload.single("icon"), badgeController.updateBadge);
router.delete("/:id", badgeController.deleteBadge);

export const badgeRoute = router;
