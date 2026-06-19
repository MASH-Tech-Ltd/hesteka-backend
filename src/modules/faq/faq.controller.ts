import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { faqService } from "./faq.service";

export const createFaq = asyncHandler(async (req: Request, res: Response) => {
  const result = await faqService.createFaq(req.body);
  ApiResponse.sendSuccess(res, 201, "FAQ created successfully", result);
});

export const getAllFaqs = asyncHandler(async (req: Request, res: Response) => {
  const result = await faqService.getAllFaqs(req.query, req.user);
  ApiResponse.sendSuccess(res, 200, "FAQs fetched successfully", result);
});

export const getFaqById = asyncHandler(async (req: Request, res: Response) => {
  const result = await faqService.getFaqById(req.params.id as string, req.user);
  ApiResponse.sendSuccess(res, 200, "FAQ fetched successfully", result);
});

export const updateFaq = asyncHandler(async (req: Request, res: Response) => {
  const result = await faqService.updateFaq(req.params.id as string, req.body);
  ApiResponse.sendSuccess(res, 200, "FAQ updated successfully", result);
});

export const deleteFaq = asyncHandler(async (req: Request, res: Response) => {
  await faqService.deleteFaq(req.params.id  as string);
  ApiResponse.sendSuccess(res, 200, "FAQ deleted successfully");
});

export const reorderFaqs = asyncHandler(async (req: Request, res: Response) => {
  await faqService.reorderFaqs(req.body.orders);
  ApiResponse.sendSuccess(res, 200, "FAQs reordered successfully");
});
