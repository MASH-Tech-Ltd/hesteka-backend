import { Router } from "express";
import {
  createArticle,
  getArticleHomePage,
  getAllArticles,
  getArticleByCategory,
  getSingleArticle,
  updateArticle,
  deleteArticle,
  getArticleCategory,
  createArticleCategory,
  deleteArticleCategory,
} from "./article.controller";
import {
  createArticleSchema,
  updateArticleSchema,
  getArticleByCategorySchema,
  getAllArticlesSchema,
  createArticleCategorySchema,
} from "./article.validation";
import { allowRole, authGuard, authGuardOptional } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest, validateQuery } from "../../middleware/validateRequest.middleware";
import { articleLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────
// IMPORTANT: Named routes MUST come before /:id params to avoid Express capture.

// GET /articles/article-home-page
router.get(
  "/article-home-page",
  articleLimiter,
  getArticleHomePage
);

// GET /articles/get-article-category
router.get(
  "/get-article-category",
  articleLimiter,
  getArticleCategory
);

// GET /articles/get-article-bycategory?category=Advice&page=1&limit=10
router.get(
  "/get-article-bycategory",
  articleLimiter,
  validateQuery(getArticleByCategorySchema),
  getArticleByCategory
);

// GET /articles/get-single-article/:id
// authGuardOptional → admin token sees inactive articles; public sees active only
router.get(
  "/get-single-article/:id",
  articleLimiter,
  authGuardOptional,
  getSingleArticle
);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// All routes below require a valid admin JWT.
// Admin requests already skip the articleLimiter via the role check inside rateLimiter().
router.use(authGuard);
router.use(allowRole("admin"));

// POST /articles  — create new article
router.post(
  "/",
  upload.single("image"),
  validateRequest(createArticleSchema),
  createArticle
);

// GET /articles/get-all-article?page=1&limit=10&status=all&search=...&sortBy=date&sort=descending
router.get(
  "/get-all-article",
  validateQuery(getAllArticlesSchema),
  getAllArticles
);

// POST /articles/create-article-category — create a new category
router.post(
  "/create-article-category",
  validateRequest(createArticleCategorySchema),
  createArticleCategory
);

// DELETE /articles/delete-article-category/:id — delete a category
router.delete("/delete-article-category/:id", deleteArticleCategory);

// PATCH /articles/update-article/:id
router.patch(
  "/update-article/:id",
  upload.single("image"),
  validateRequest(updateArticleSchema),
  updateArticle
);

// DELETE /articles/delete-article/:id
router.delete("/delete-article/:id", deleteArticle);

export const articleRoutes = router;
