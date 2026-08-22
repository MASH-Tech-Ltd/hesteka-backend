import { z } from "zod";

// ─── Create Article (multipart/form-data body) ────────────────────────────────
export const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  mainCategory: z.string().min(1, "Category is required").max(100, "Category too long"),
  tag: z.string().min(1, "Tag is required").max(100, "Tag too long"),
  author: z.string().max(100, "Author name too long").optional().default("Team Hesteka"),
  readTime: z.coerce.number().int().min(1, "Read time must be at least 1 minute").optional().default(2),
  isFeatured: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional().default(false),
  isActive: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional().default(true),
  externalLink: z.union([z.literal(""), z.string().url()]).optional(),
  contentBlocks: z.string().min(1, "Content blocks are required"),
}).strict();

// ─── Update Article (all fields optional) ─────────────────────────────────────
export const updateArticleSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(200, "Title too long").optional(),
  mainCategory: z.string().min(1).max(100).optional(),
  tag: z.string().min(1).max(100).optional(),
  author: z.string().max(100).optional(),
  readTime: z.coerce.number().int().min(1).optional(),
  isFeatured: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
  externalLink: z.union([z.literal(""), z.string().url()]).optional(),
  isActive: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
  contentBlocks: z.string().optional(),
}).strict();

// ─── Get Articles By Category (query params) ──────────────────────────────────
export const getArticleByCategorySchema = z.object({
  category: z.string().min(1, "Category query param is required"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

// ─── Get All Articles — Admin (query params) ──────────────────────────────────
export const getAllArticlesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().max(200).optional(),
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
  category: z.string().max(100).optional(),
  sortBy: z.enum(["date", "title", "category", "author"]).optional().default("date"),
  sort: z.enum(["ascending", "descending"]).optional().default("descending"),
});

// ─── Create Article Category ──────────────────────────────────────────────────
export const createArticleCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Category name too long")
    .transform((v) => v.trim()),
}).strict();
