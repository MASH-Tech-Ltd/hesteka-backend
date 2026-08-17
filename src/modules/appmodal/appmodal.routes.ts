import express from "express";
import {
  getAllModals,
  updateModal,
  checkUpdateModal,
  checkRegionDepartmentModal,
  checkAnnouncementModal,
} from "./appmodal.controller";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { createAppModalSchema } from "./appmodal.validation";
import { authGuard, allowRole } from "../../middleware/auth.middleware";

const router = express.Router();

// Public route for mobile app
router.get("/check/update", checkUpdateModal);
router.get("/check/region-department", checkRegionDepartmentModal);
router.get("/check/announcement", checkAnnouncementModal);

// Admin routes
router.use(authGuard);
router.use(allowRole("admin"));
router.get("/get-all-modals", getAllModals);
router.patch(
  "/update-modal/:id",
  validateRequest(createAppModalSchema),
  updateModal,
);

export const appModalRoute = router;
