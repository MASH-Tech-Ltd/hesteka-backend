import { Router } from "express";
import {
  createComment,
  getCommentsByReport,
  getCommentById,
  updateComment,
  deleteComment,
  createReply,
  updateReply,
  deleteReply,
  toggleLike,
} from "./comment.controller";
import { authGuard } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { commentValidation } from "./comment.validation";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { communityLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Public routes
router.get("/get-comments-by-report/:reportId", getCommentsByReport);
router.get("/get-single-comment/:commentId", getCommentById);

// Protected routes
router.use(authGuard);

router.post(
  "/create-comment",
  communityLimiter,
  upload.single("image"),
  validateRequest(commentValidation.createCommentSchema),
  createComment
);

router.patch(
  "/update-comment/:commentId",
  upload.single("image"),
  validateRequest(commentValidation.updateCommentSchema),
  updateComment
);

router.delete("/delete-comment/:commentId", deleteComment);
router.post("/toggle-like/:commentId", toggleLike);

// APIs for reply
router.post(
  "/create-reply/:commentId",
  communityLimiter,
  upload.single("image"),
  validateRequest(commentValidation.createReplySchema),
  createReply
);

router.patch(
  "/update-reply/:replyId",
  upload.single("image"),
  validateRequest(commentValidation.updateReplySchema),
  updateReply
);

router.delete("/delete-reply/:replyId", deleteReply);

export const commentRoute = router;
