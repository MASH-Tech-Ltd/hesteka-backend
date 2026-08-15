import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { articleService } from "./article.service";
import ApiResponse from "../../utils/apiResponse";

export const createArticle = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const article = await articleService.createArticle(req.body, file);
  ApiResponse.sendSuccess(res, 201, "Article created successfully", article);
});

export const getAllArticles = asyncHandler(async (req: Request, res: Response) => {
  const articles = await articleService.getAllArticles();
  ApiResponse.sendSuccess(res, 200, "Articles fetched successfully", articles);
});

export const getActiveArticles = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;
  const articles = await articleService.getActiveArticles(category as string);
  ApiResponse.sendSuccess(res, 200, "Articles fetched successfully", articles);
});

export const getArticleById = asyncHandler(async (req: Request, res: Response) => {
  const article = await articleService.getArticleById(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Article fetched successfully", article);
});

export const updateArticle = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const article = await articleService.updateArticle(req.params.id as string, req.body, file);
  ApiResponse.sendSuccess(res, 200, "Article updated successfully", article);
});

export const deleteArticle = asyncHandler(async (req: Request, res: Response) => {
  const article = await articleService.deleteArticle(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Article deleted successfully", article);
});
