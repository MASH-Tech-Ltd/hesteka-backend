import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { supportMessageController } from "./supportMessage.controller";
import { supportMessageValidation } from "./supportMessage.validation";

const router = Router();

// User route - create support message
router.post(
  "/",
  authGuard,
  validateRequest(supportMessageValidation.createSupportMessageSchema),
  supportMessageController.createSupportMessage
);

// Admin routes
router.get(
  "/",
  authGuard,
  allowRole("admin"),
  supportMessageController.getAllSupportMessages
);

router.get(
  "/:id",
  authGuard,
  allowRole("admin"),
  supportMessageController.getSupportMessageById
);

router.post(
  "/:id/reply",
  authGuard,
  allowRole("admin"),
  validateRequest(supportMessageValidation.replySupportMessageSchema),
  supportMessageController.replyToSupportMessage
);

router.delete(
  "/:id",
  authGuard,
  allowRole("admin"),
  supportMessageController.deleteSupportMessage
);

export const supportMessageRoute = router;
