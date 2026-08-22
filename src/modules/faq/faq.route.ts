import { Router } from "express";
import { authGuard, authGuardOptional, allowRole } from "../../middleware/auth.middleware";
import { role } from "../usersAuth/user.interface";
import { contentLimiter } from "../../middleware/rateLimiter.middleware";
import {
  createFaq,
  getAllFaqs,
  getFaqById,
  updateFaq,
  deleteFaq,
  reorderFaqs
} from "./faq.controller";
import { upload } from "../../middleware/multer.midleware";

const router = Router();

// Public route to get FAQs (optional auth to see all if admin)
router.get("/", contentLimiter, authGuardOptional, getAllFaqs);
router.get("/:id", contentLimiter, authGuardOptional, getFaqById);

// Admin only routes
router.use(authGuard, allowRole(role.ADMIN));
router.post("/", upload.single("image"), createFaq);
router.patch("/reorder", reorderFaqs);
router.patch("/:id", upload.single("image"), updateFaq);
router.delete("/:id", deleteFaq);

export const faqRoute = router;
