import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { pointController } from "./point.controller";
import { pointValidation } from "./point.validation";

const router = Router();

router.get("/get-my-points", authGuard, allowRole("user"), pointController.getMyPoints);

router.post(
  "/redeem-points",
  authGuard,
  allowRole("user"),
  validateRequest(pointValidation.redeemPointsSchema),
  pointController.redeemPoints,
);

router.get("/admin/config", authGuard, allowRole("admin"), pointController.getPointConfig);
router.patch("/admin/config", authGuard, allowRole("admin"), pointController.updatePointConfig);
router.get("/admin/stats", authGuard, allowRole("admin"), pointController.getPointStats);
router.get("/admin/history", authGuard, allowRole("admin"), pointController.getAllPointHistory);
router.post(
  "/admin/assign-custom-points",
  authGuard,
  allowRole("admin"),
  validateRequest(pointValidation.assignCustomPointsSchema),
  pointController.assignCustomPoints
);

export const pointRoute = router;
