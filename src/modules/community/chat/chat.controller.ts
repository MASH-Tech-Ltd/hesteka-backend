import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import ApiResponse from "../../../utils/apiResponse";
import { chatService } from "./chat.service";
import CustomError from "../../../helpers/CustomError";
import { Types } from "mongoose";

const createChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new CustomError(401, "Unauthorized");
  }

  const { content, lat, lng, address, replyTo } = req.body;

  const files = Array.isArray(req.files)
    ? (req.files as Express.Multer.File[])
    : [];

  const chat = await chatService.createChat(
    {
      user: userId as Types.ObjectId,
      content,
      lat: lat !== undefined ? Number(lat) : undefined,
      lng: lng !== undefined ? Number(lng) : undefined,
      address,
      replyTo: replyTo || undefined, // optional — only if replying
    },
    files,
  );

  return ApiResponse.sendSuccess(res, 201, "Message sent successfully", chat);
});

const getLocalChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new CustomError(401, "Unauthorized");
  }

  const { lat, lng, radiusKm, page, limit } = req.query as any;

  const result = await chatService.getLocalChat({
    user: userId as Types.ObjectId,
    lat: lat !== undefined ? Number(lat) : undefined,
    lng: lng !== undefined ? Number(lng) : undefined,
    radiusKm: radiusKm ? Number(radiusKm) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return ApiResponse.sendSuccess(
    res,
    200,
    "Local chat fetched successfully",
    result.messages,
    result.meta,
  );
});

const getGlobalChat = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as any;

  const result = await chatService.getGlobalChat({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return ApiResponse.sendSuccess(
    res,
    200,
    "Global chat fetched successfully",
    result.messages,
    result.meta,
  );
});

const getChatById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const chat = await chatService.getChatById(id as string);

  return ApiResponse.sendSuccess(res, 200, "Chat fetched successfully", chat);
});

const deleteChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new CustomError(401, "Unauthorized");
  }

  const { id } = req.params;
  await chatService.deleteChat(id as string, userId as Types.ObjectId);

  return ApiResponse.sendSuccess(res, 200, "Message deleted successfully");
});

const adminDeleteChat = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await chatService.adminDeleteChat(id as string);

  return ApiResponse.sendSuccess(res, 200, "Message deleted successfully by admin");
});

const updateChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new CustomError(401, "Unauthorized");
  }

  const { id } = req.params;
  const { content, removeMediaIds } = req.body;

  let splitRemoveMediaIds: string[] | undefined;
  if (removeMediaIds) {
    splitRemoveMediaIds = typeof removeMediaIds === "string"
      ? removeMediaIds.split(",").map(item => item.trim()).filter(Boolean)
      : removeMediaIds;
  }

  const files = Array.isArray(req.files)
    ? (req.files as Express.Multer.File[])
    : [];

  const payload: { content?: string; removeMediaIds?: string[] } = {};
  if (content !== undefined) {
    payload.content = content;
  }
  if (splitRemoveMediaIds !== undefined) {
    payload.removeMediaIds = splitRemoveMediaIds;
  }

  const updatedChat = await chatService.updateChat(
    id as string,
    userId as Types.ObjectId,
    payload,
    files,
  );

  return ApiResponse.sendSuccess(res, 200, "Post updated successfully", updatedChat);
});

export const chatController = {
  createChat,
  getLocalChat,
  getGlobalChat,
  getChatById,
  deleteChat,
  adminDeleteChat,
  updateChat,
};
