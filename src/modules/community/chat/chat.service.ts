import { Types } from "mongoose";
import { chatModel } from "./chat.models";
import { chatLikeModel } from "../chatlike/chatlike.models";
import {
  CreateChatPayload,
  GetLocalChatQuery,
  GetGlobalChatQuery,
  IChat,
  IChatMedia,
  MediaType,
} from "./chat.interface";
import CustomError from "../../../helpers/CustomError";
import {
  toGeoPoint,
  encodeGeohash,
  buildGeoWithinQuery,
  fromGeoPoint,
  calculateDistanceKm,
  Coordinates,
} from "../shared/geo.utils";
import { resolveCommunityCoordinates } from "../shared/location-resolver";
import { paginationHelper } from "../../../utils/pagination";
import {
  uploadMediaCloudinary,
  deleteCloudinary,
  CloudinaryResourceType,
} from "../../../helpers/cloudinary";
import { getIo } from "../../../socket/server";
import { ChatSocketEvents } from "../../../socket/socket.type";
import { notificationService } from "../../notifications/notification.service";
import { NotificationType } from "../../notifications/notification.interface";

const getMediaTypeFromMime = (mimetype: string): MediaType => {
  if (mimetype.startsWith("image/")) return MediaType.IMAGE;
  if (mimetype.startsWith("video/")) return MediaType.VIDEO;
  return MediaType.FILE;
};

const getCloudinaryResourceType = (
  mediaType: MediaType,
): CloudinaryResourceType => {
  if (mediaType === MediaType.IMAGE) return "image";
  if (mediaType === MediaType.VIDEO) return "video";
  return "raw";
};

const broadcastToGeohashes = (
  lat: number,
  lng: number,
  event: string,
  data: unknown,
): void => {
  try {
    const io = getIo();
    const geohash = encodeGeohash(lat, lng);
    io.to(`geo:${geohash}`).emit(event, data);
  } catch (error) {
    console.error("Socket broadcast failed:", error);
  }
};

const uploadChatMedia = async (
  files: Express.Multer.File[],
): Promise<IChatMedia[]> => {
  const uploadedMedia: IChatMedia[] = [];

  try {
    for (const file of files) {
      const mediaType = getMediaTypeFromMime(file.mimetype);
      const resourceType = getCloudinaryResourceType(mediaType);
      const result = await uploadMediaCloudinary(file.path, resourceType);

      uploadedMedia.push({
        url: result.secure_url,
        publicId: result.public_id,
        type: mediaType,
      });
    }
    return uploadedMedia;
  } catch (error) {
    for (const media of uploadedMedia) {
      const resourceType = getCloudinaryResourceType(media.type);
      await deleteCloudinary(media.publicId, resourceType).catch(() => null);
    }
    throw error;
  }
};

const createChat = async (
  payload: CreateChatPayload,
  files?: Express.Multer.File[],
): Promise<IChat> => {
  const { user, content, lat, lng, address, replyTo } = payload;

  // ─── Validate replyTo if provided ───────────────────────────────
  let replyToId: Types.ObjectId | undefined;
  let originalOwnerId: string | undefined;

  if (replyTo) {
    if (!Types.ObjectId.isValid(replyTo)) {
      throw new CustomError(400, "Invalid replyTo message ID");
    }

    const originalMessage = await chatModel
      .findById(replyTo)
      .select("user")
      .lean();

    if (!originalMessage) {
      throw new CustomError(404, "Original message not found");
    }

    replyToId = new Types.ObjectId(replyTo);
    originalOwnerId = originalMessage.user.toString();
  }

  const resolvedLocation = await resolveCommunityCoordinates({
    userId: user,
    lat,
    lng,
    address,
    action: "create a community post",
  });

  const location = toGeoPoint(
    resolvedLocation.lat,
    resolvedLocation.lng,
    resolvedLocation.address,
  );
  const geohash = encodeGeohash(resolvedLocation.lat, resolvedLocation.lng);

  let media: IChatMedia[] = [];
  if (files && files.length > 0) {
    media = await uploadChatMedia(files);
  }

  const chat = await chatModel.create({
    user,
    content,
    media,
    location,
    geohash,
    ...(replyToId && { replyTo: replyToId }),
  });

  // ─── Populate full data for broadcast ───────────────────────────
  const populatedChat = await chatModel
    .findById(chat._id)
    .populate("user", "firstName lastName profileImage")
    .populate({
      path: "replyTo",
      select: "content user",
      populate: {
        path: "user",
        select: "firstName lastName profileImage",
      },
    })
    .lean();

  // ─── Broadcast to nearby users ───────────────────────────────────
  broadcastToGeohashes(
    resolvedLocation.lat,
    resolvedLocation.lng,
    ChatSocketEvents.CHAT_NEW_MESSAGE,
    populatedChat,
  );

  // ─── Notify original message owner if this is a reply ───────────
  if (replyToId && originalOwnerId) {
    const isSelfReply = originalOwnerId === user.toString();

    if (!isSelfReply) {
      const replierName = (populatedChat?.user as any)
        ? `${(populatedChat?.user as any).firstName} ${(populatedChat?.user as any).lastName}`
        : "Quelqu'un";

      const preview =
        content.length > 60 ? `${content.slice(0, 60)}...` : content;

      // DB save + socket emit via existing notificationService
      await notificationService.notifySingleUser(
        originalOwnerId,
        "Nouvelle réponse à votre message",
        `${replierName} a répondu : "${preview}"`,
        NotificationType.CHAT_REPLY,
      );
    }
  }

  return chat;
};

const getLocalChat = async (query: GetLocalChatQuery) => {
  const { user, lat, lng, radiusKm, page, limit } = query;
  const pagination = paginationHelper(String(page), String(limit));

  const resolvedLocation = await resolveCommunityCoordinates({
    userId: user,
    lat,
    lng,
    action: "fetch local community posts",
  });

  const geoFilter = buildGeoWithinQuery(
    resolvedLocation.lat,
    resolvedLocation.lng,
    radiusKm!,
  );

  const filter = user ? { $or: [geoFilter, { user }] } : geoFilter;

  const [messages, total] = await Promise.all([
    chatModel
      .find(filter)
      .populate("user", "firstName lastName profileImage")
      .populate({
        path: "replyTo",
        select: "content user",
        populate: {
          path: "user",
          select: "firstName lastName profileImage",
        },
      })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    chatModel.countDocuments(filter),
  ]);

  const chatIds = messages.map((msg) => msg._id);
  const userLikes = user
    ? await chatLikeModel
        .find({
          user: user,
          chat: { $in: chatIds },
        })
        .select("chat")
        .lean()
    : [];

  const likedChatIds = new Set(
    userLikes.map((like) => (like.chat as any).toString()),
  );

  const userCoords = {
    lat: resolvedLocation.lat,
    lng: resolvedLocation.lng,
  };
  const messagesWithDistance = messages.map((msg) => {
    const msgCoords = fromGeoPoint(msg.location);
    const distanceKm = calculateDistanceKm(
      userCoords as Coordinates,
      msgCoords,
    );
    return {
      ...msg,
      distanceKm: Number(distanceKm.toFixed(2)),
      liked: user ? likedChatIds.has(msg._id.toString()) : false,
    };
  });

  return {
    messages: messagesWithDistance,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

const getGlobalChat = async (query: GetGlobalChatQuery) => {
  const { page, limit } = query;
  const pagination = paginationHelper(String(page), String(limit));

  const [messages, total] = await Promise.all([
    chatModel
      .find()
      .populate("user", "firstName lastName email profileImage")
      .populate({
        path: "replyTo",
        select: "content user",
        populate: {
          path: "user",
          select: "firstName lastName email profileImage",
        },
      })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    chatModel.countDocuments(),
  ]);

  return {
    messages,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

const getChatById = async (chatId: string): Promise<IChat> => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new CustomError(400, "Invalid chat ID");
  }

  const chat = await chatModel
    .findById(chatId)
    .populate("user", "firstName lastName profileImage")
    .populate({
      path: "replyTo",
      select: "content user",
      populate: {
        path: "user",
        select: "firstName lastName profileImage",
      },
    });

  if (!chat) {
    throw new CustomError(404, "Chat message not found");
  }

  return chat;
};

const deleteChat = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<void> => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new CustomError(400, "Invalid chat ID");
  }

  const chat = await chatModel.findById(chatId);

  if (!chat) {
    throw new CustomError(404, "Chat message not found");
  }

  if (chat.user.toString() !== userId.toString()) {
    throw new CustomError(403, "You can only delete your own messages");
  }

  for (const media of chat.media) {
    const resourceType = getCloudinaryResourceType(media.type);
    await deleteCloudinary(media.publicId, resourceType).catch(() => null);
  }

  const [lng, lat] = chat.location.coordinates;

  await chatModel.findByIdAndDelete(chatId);

  broadcastToGeohashes(lat, lng, ChatSocketEvents.CHAT_MESSAGE_DELETED, {
    chatId,
  });
};

const adminDeleteChat = async (chatId: string): Promise<void> => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new CustomError(400, "Invalid chat ID");
  }

  const chat = await chatModel.findById(chatId);

  if (!chat) {
    throw new CustomError(404, "Chat message not found");
  }

  for (const media of chat.media) {
    const resourceType = getCloudinaryResourceType(media.type);
    await deleteCloudinary(media.publicId, resourceType).catch(() => null);
  }

  const [lng, lat] = chat.location.coordinates;

  await chatModel.findByIdAndDelete(chatId);

  broadcastToGeohashes(lat, lng, ChatSocketEvents.CHAT_MESSAGE_DELETED, {
    chatId,
  });
};

export const chatService = {
  createChat,
  getLocalChat,
  getGlobalChat,
  getChatById,
  deleteChat,
  adminDeleteChat,
  broadcastToGeohashes,
};
