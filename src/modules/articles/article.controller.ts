import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { articleService } from "./article.service";
import ApiResponse from "../../utils/apiResponse";

export const createArticle = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const article = await articleService.createArticle(req.body, file);
  ApiResponse.sendSuccess(res, 201, "Article created successfully", article);
});

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await articleService.getUniqueCategories();
  ApiResponse.sendSuccess(res, 200, "Categories fetched successfully", categories);
});

export const getAllArticles = asyncHandler(async (req: Request, res: Response) => {
  const result = await articleService.getAllArticles(req.query);
  // Send the paginated result properly
  res.status(200).json({
    status: "ok",
    message: "Articles fetched successfully",
    data: result.data,
    meta: result.meta
  });
});

export const getActiveArticles = asyncHandler(async (req: Request, res: Response) => {
  const result = await articleService.getActiveArticles(req.query);
  res.status(200).json({
    status: "ok",
    message: "Articles fetched successfully",
    data: result.data,
    meta: result.meta
  });
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
