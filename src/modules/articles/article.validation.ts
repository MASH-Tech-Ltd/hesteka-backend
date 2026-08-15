import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  mainCategory: z.string().min(1, "Category is required"),
  tag: z.string().min(1, "Tag is required"),
  author: z.string().optional().default("Team Hesteka"),
  readTime: z.coerce.number().optional().default(2),
  isFeatured: z.union([z.boolean(), z.string().transform(val => val === "true")]).optional(),
  isActive: z.union([z.boolean(), z.string().transform(val => val === "true")]).optional(),
  contentBlocks: z.string().min(1, "Content Blocks are required"),
}).strict();

export const updateArticleSchema = z.object({
  title: z.string().optional(),
  mainCategory: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  readTime: z.coerce.number().optional(),
  isFeatured: z.union([z.boolean(), z.string().transform(val => val === "true")]).optional(),
  isActive: z.union([z.boolean(), z.string().transform(val => val === "true")]).optional(),
  contentBlocks: z.string().optional(),
}).strict();
