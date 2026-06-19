import { Router } from "express";
import { authGuard, authGuardOptional, allowRole } from "../../middleware/auth.middleware";
import { role } from "../usersAuth/user.interface";
import {
  createFaq,
  getAllFaqs,
  getFaqById,
  updateFaq,
  deleteFaq,
  reorderFaqs
} from "./faq.controller";

const router = Router();

// Public route to get FAQs (optional auth to see all if admin)
router.get("/", authGuardOptional, getAllFaqs);
router.get("/:id", authGuardOptional, getFaqById);

// Admin only routes
router.use(authGuard, allowRole(role.ADMIN));
router.post("/", createFaq);
router.patch("/reorder", reorderFaqs);
router.patch("/:id", updateFaq);
router.delete("/:id", deleteFaq);

export const faqRoute = router;
