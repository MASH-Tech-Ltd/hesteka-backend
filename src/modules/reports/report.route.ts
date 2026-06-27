import { Router } from "express";
import {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
  addImage,
  removeImage,
  getMyReports,
} from "./report.controller";
import { authGuard, authGuardOptional } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  createReportSchema,
  updateReportSchema,
} from "./report.validation";
import { upload } from "../../middleware/multer.midleware";

const router = Router();

// Public routes (or authentication required based on your app's needs)
// If you want everyone to see reports:
router.get("/get-all-reports", authGuardOptional, getAllReports);
router.get("/get-single-report/:reportId", authGuardOptional, getReportById);

// Protected routes (requires login)
router.use(authGuard);

router.get("/get-my-reports", getMyReports);

router.post(
  "/create-report",
  upload.fields([{ name: "images", maxCount: 3 }]),
  validateRequest(createReportSchema),
  createReport
);

router.patch(
  "/update-report/:reportId",
  upload.fields([{ name: "images", maxCount: 3 }]),
  validateRequest(updateReportSchema),
  updateReport
);

router.delete("/delete-report/:reportId", authGuard,   deleteReport);

router.post("/add-image/:reportId", authGuard, upload.single("image"), addImage);

router.delete("/remove-image/:reportId", authGuard, removeImage);

export const reportRoute = router;
