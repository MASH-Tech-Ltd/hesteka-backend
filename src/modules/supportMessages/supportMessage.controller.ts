import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { supportMessageService } from "./supportMessage.service";

export const createSupportMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await supportMessageService.createSupportMessage(req);
  ApiResponse.sendSuccess(res, 201, "Support message sent successfully", message);
});

export const getAllSupportMessages = asyncHandler(async (req: Request, res: Response) => {
  const { messages, meta } = await supportMessageService.getAllSupportMessages(req);
  ApiResponse.sendSuccess(res, 200, "Support messages fetched successfully", messages, meta);
});

export const getSupportMessageById = asyncHandler(async (req: Request, res: Response) => {
  const message = await supportMessageService.getSupportMessageById(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Support message fetched successfully", message);
});

export const deleteSupportMessage = asyncHandler(async (req: Request, res: Response) => {
  await supportMessageService.deleteSupportMessage(req.params.id as string);
  ApiResponse.sendSuccess(res, 200, "Support message deleted successfully");
});

export const supportMessageController = {
  createSupportMessage,
  getAllSupportMessages,
  getSupportMessageById,
  deleteSupportMessage,
};
