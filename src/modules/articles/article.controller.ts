import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { articleService } from "./article.service";
import ApiResponse from "../../utils/apiResponse";

// POST /articles — Admin
export const createArticle = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const article = await articleService.createArticle(req.body, file);
  ApiResponse.sendSuccess(res, 201, "Article created successfully", article);
});

// GET /articles/home — Public
export const getArticleHomePage = asyncHandler(async (req: Request, res: Response) => {
  const result = await articleService.getArticleHomePage();
  ApiResponse.sendSuccess(res, 200, "Article home page fetched successfully", result);
});

// GET /articles — Admin
export const getAllArticles = asyncHandler(async (req: Request, res: Response) => {
  const result = await articleService.getAllArticles(req.query);
  ApiResponse.sendSuccess(res, 200, "Articles fetched successfully", result.data, result.meta);
});

// GET /articles/get-article-bycategory?category=Advice — Public
export const getArticleByCategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await articleService.getArticleByCategory(req.query);
  ApiResponse.sendSuccess(res, 200, "Articles fetched successfully", result.data, result.meta);
});

// GET /articles/:id — Public (authGuardOptional — admin sees inactive too)
export const getSingleArticle = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = req.user?.role === "admin";
  const result = await articleService.getSingleArticle(req.params.id as string, isAdmin);
  ApiResponse.sendSuccess(res, 200, "Article fetched successfully", result);
});

// PATCH /articles/:id — Admin
export const updateArticle = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const article = await articleService.updateArticle(req.params.id as string, req.body, file);
  ApiResponse.sendSuccess(res, 200, "Article updated successfully", article);
});

// DELETE /articles/:id — Admin
export const deleteArticle = asyncHandler(async (req: Request, res: Response) => {
  const article = await articleService.deleteArticle(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Article deleted successfully", article);
});

// GET /articles/get-article-category — Public
export const getArticleCategory = asyncHandler(async (req: Request, res: Response) => {
  const categories = await articleService.getArticleCategory();
  ApiResponse.sendSuccess(res, 200, "Article categories fetched successfully", categories);
});

// POST /articles/create-article-category — Admin
export const createArticleCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const category = await articleService.createArticleCategory(name);
  ApiResponse.sendSuccess(res, 201, "Category created successfully", category);
});

// DELETE /articles/delete-article-category/:id — Admin
export const deleteArticleCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await articleService.deleteArticleCategory(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Category deleted successfully", category);
});
