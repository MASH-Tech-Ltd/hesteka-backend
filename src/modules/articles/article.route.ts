import { Router } from "express";
import {
  createArticle,
  getAllArticles,
  getActiveArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
} from "./article.controller";
import {
  createArticleSchema,
  updateArticleSchema,
} from "./article.validation";
import { allowRole, authGuard } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";

const router = Router();

// Public Routes (for Mobile App)
router.get("/active", getActiveArticles);
router.get("/:id", getArticleById);

// Admin Routes
router.use(authGuard);
router.use(allowRole("admin"));

router.post(
  "/",
  upload.single("image"),
  validateRequest(createArticleSchema),
  createArticle
);
router.get("/", getAllArticles);
router.patch(
  "/:id",
  upload.single("image"),
  validateRequest(updateArticleSchema),
  updateArticle
);
router.delete("/:id", deleteArticle);

export const articleRoutes = router;
