import { Types } from "mongoose";
import { chatLikeModel } from "./chatlike.models";
import { chatModel } from "../chat/chat.models";
import {
  ToggleLikePayload,
  ToggleLikeResult,
  GetLikesQuery,
} from "./chatlike.interface";
import CustomError from "../../../helpers/CustomError";
import { paginationHelper } from "../../../utils/pagination";
import { chatService } from "../chat/chat.service";
import { ChatSocketEvents } from "../../../socket/socket.type";

const toggleLike = async (
  payload: ToggleLikePayload,
): Promise<ToggleLikeResult> => {
  const { user, chatId } = payload;

  if (!Types.ObjectId.isValid(chatId)) {
    throw new CustomError(400, "Invalid chat ID");
  }

  const chat = await chatModel.findById(chatId);
  if (!chat) {
    throw new CustomError(404, "Chat message not found");
  }

  const existingLike = await chatLikeModel.findOne({
    user,
    chat: chatId,
  });

  let result: ToggleLikeResult;

  if (existingLike) {
    await chatLikeModel.findByIdAndDelete(existingLike._id);
    const updated = await chatModel.findByIdAndUpdate(
      chatId,
      { $inc: { likesCount: -1 } },
      { returnDocument: 'after' },
    );

    result = {
      liked: false,
      likesCount: updated?.likesCount ?? 0,
    };
  } else {
    await chatLikeModel.create({ user, chat: chatId });
    const updated = await chatModel.findByIdAndUpdate(
      chatId,
      { $inc: { likesCount: 1 } },
      { returnDocument: 'after' },
    );

    result = {
      liked: true,
      likesCount: updated?.likesCount ?? 0,
    };
  }

  // Broadcast like update to nearby users
  const [lng, lat] = chat.location.coordinates;
  chatService.broadcastToGeohashes(
    lat,
    lng,
    ChatSocketEvents.CHAT_LIKE_UPDATE,
    {
      chatId,
      likesCount: result.likesCount,
      userId: user.toString(),
      liked: result.liked,
    },
  );

  return result;
};

const getLikes = async (query: GetLikesQuery) => {
  const { chatId, page, limit } = query;

  if (!Types.ObjectId.isValid(chatId)) {
    throw new CustomError(400, "Invalid chat ID");
  }

  const pagination = paginationHelper(String(page), String(limit));

  const [likes, total] = await Promise.all([
    chatLikeModel
      .find({ chat: chatId })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    chatLikeModel.countDocuments({ chat: chatId }),
  ]);

  return {
    likes,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

const isLikedByUser = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<boolean> => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new CustomError(400, "Invalid chat ID");
  }

  const like = await chatLikeModel.findOne({
    user: userId,
    chat: chatId,
  });

  return !!like;
};

export const chatLikeService = {
  toggleLike,
  getLikes,
  isLikedByUser,
};
