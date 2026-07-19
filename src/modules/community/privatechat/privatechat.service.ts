import { Types } from "mongoose";
import { conversationModel, privateMessageModel } from "./privatechat.models";
import {
  GetMessagesQuery,
  MarkAsReadPayload,
  PrivateMessageStatus,
  SendPrivateMessagePayload,
  StartConversationPayload,
} from "./privatechat.interface";
import { IChatMedia, MediaType } from "../chat/chat.interface";
import CustomError from "../../../helpers/CustomError";
import { userModel } from "../../usersAuth/user.models";
import { paginationHelper } from "../../../utils/pagination";
import {
  uploadMediaCloudinary,
  deleteCloudinary,
  CloudinaryResourceType,
} from "../../../helpers/cloudinary";
import { getIo } from "../../../socket/server";
import { PrivateChatSocketEvents } from "../../../socket/socket.type";
import { notificationService } from "../../notifications/notification.service";
import { NotificationType } from "../../notifications/notification.interface";

// ─── Media helpers ────────────────────────────────────────────────────────────

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

const uploadPrivateMedia = async (
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

// ─── Block check helper ───────────────────────────────────────────────────────

const checkBlocked = async (
  userAId: string,
  userBId: string,
): Promise<void> => {
  const users = await userModel
    .find({ _id: { $in: [userAId, userBId] } })
    .select("blockedUsers")
    .lean();

  for (const user of users) {
    const isBlocked = user.blockedUsers
      ?.map((id: Types.ObjectId) => id.toString())
      .includes(user._id.toString() === userAId ? userBId : userAId);

    if (isBlocked) {
      throw new CustomError(403, "You cannot message this user");
    }
  }
};

// ─── Conversation ─────────────────────────────────────────────────────────────

const startOrGetConversation = async (payload: StartConversationPayload) => {
  const { senderId, receiverId } = payload;

  if (!Types.ObjectId.isValid(receiverId)) {
    throw new CustomError(400, "Invalid receiver ID");
  }

  if (senderId.toString() === receiverId) {
    throw new CustomError(400, "You cannot start a conversation with yourself");
  }

  // Block check before starting conversation
  await checkBlocked(senderId.toString(), receiverId);

  const receiver = await userModel
    .findById(receiverId)
    .select("_id firstName lastName profileImage status")
    .lean();

  if (!receiver) {
    throw new CustomError(404, "User not found");
  }

  if (receiver.status === "blocked" || receiver.status === "banned") {
    throw new CustomError(403, "Cannot start a conversation with this user");
  }

  const receiverObjectId = new Types.ObjectId(receiverId);

  const existing = await conversationModel
    .findOne({ participants: { $all: [senderId, receiverObjectId] } })
    .populate("participants", "firstName lastName profileImage")
    .populate({
      path: "lastMessage",
      select: "content media createdAt sender",
    })
    .lean();

  if (existing) return existing;

  const conversation = await conversationModel.create({
    participants: [senderId, receiverObjectId],
    unreadCounts: {
      [senderId.toString()]: 0,
      [receiverId]: 0,
    },
  });

  return conversationModel
    .findById(conversation._id)
    .populate("participants", "firstName lastName profileImage")
    .lean();
};

const getConversations = async (userId: Types.ObjectId) => {
  const conversations = await conversationModel
    .find({ participants: userId })
    .populate("participants", "firstName lastName profileImage")
    .populate({
      path: "lastMessage",
      select: "content media createdAt sender status",
    })
    .sort({ lastMessageAt: -1 })
    .lean();

  return conversations.map((conv) => ({
    ...conv,
    myUnreadCount: (conv.unreadCounts as any)?.[userId.toString()] ?? 0,
  }));
};

// ─── Messages ─────────────────────────────────────────────────────────────────

const sendMessage = async (
  payload: SendPrivateMessagePayload,
  files?: Express.Multer.File[],
) => {
  const { conversationId, sender, content, replyTo } = payload;

  if (!Types.ObjectId.isValid(conversationId)) {
    throw new CustomError(400, "Invalid conversation ID");
  }

  const conversation = await conversationModel.findById(conversationId);
  if (!conversation) {
    throw new CustomError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants
    .map((p) => p.toString())
    .includes(sender.toString());

  if (!isParticipant) {
    throw new CustomError(403, "You are not part of this conversation");
  }

  // Find receiver
  const receiverId = conversation.participants
    .find((p) => p.toString() !== sender.toString())
    ?.toString();

  if (!receiverId) {
    throw new CustomError(400, "Conversation participants are invalid");
  }

  // Block check before sending
  await checkBlocked(sender.toString(), receiverId);

  if (!content?.trim() && (!files || files.length === 0)) {
    throw new CustomError(400, "Message must have content or media");
  }

  // ─── Validate replyTo ────────────────────────────────────────────
  let replyToId: Types.ObjectId | undefined;

  if (replyTo) {
    if (!Types.ObjectId.isValid(replyTo)) {
      throw new CustomError(400, "Invalid replyTo message ID");
    }

    const originalMessage = await privateMessageModel
      .findById(replyTo)
      .select("conversation")
      .lean();

    if (!originalMessage) {
      throw new CustomError(404, "Original message not found");
    }

    // Make sure the reply is within the same conversation
    if (originalMessage.conversation.toString() !== conversationId) {
      throw new CustomError(
        400,
        "Cannot reply to a message from another conversation",
      );
    }

    replyToId = new Types.ObjectId(replyTo);
  }

  let media: IChatMedia[] = [];
  if (files && files.length > 0) {
    media = await uploadPrivateMedia(files);
  }

  const message = await privateMessageModel.create({
    conversation: conversationId,
    sender,
    content: content?.trim() ?? "",
    media,
    status: PrivateMessageStatus.SENT,
    ...(replyToId && { replyTo: replyToId }),
  });

  // Update conversation
  const unreadKey = `unreadCounts.${receiverId}`;
  await conversationModel.findByIdAndUpdate(conversationId, {
    lastMessage: message._id,
    lastMessageAt: message.createdAt,
    $inc: { [unreadKey]: 1 },
  });

  const populatedMessage = await privateMessageModel
    .findById(message._id)
    .populate("sender", "firstName lastName profileImage")
    .populate({
      path: "replyTo",
      select: "content sender media",
      populate: {
        path: "sender",
        select: "firstName lastName profileImage",
      },
    })
    .lean();

  // ─── Socket emit to receiver ─────────────────────────────────────
  try {
    const io = getIo();
    io.to(receiverId).emit(PrivateChatSocketEvents.PRIVATE_NEW_MESSAGE, {
      conversationId,
      message: populatedMessage,
    });
  } catch (_) {
    // silent fail
  }

  // ─── Notification ────────────────────────────────────────────────
  const senderUser = await userModel
    .findById(sender)
    .select("firstName lastName profileImage")
    .lean();

  const senderName = senderUser
    ? `${senderUser.firstName} ${senderUser.lastName}`
    : "Quelqu'un";

  const preview =
    content?.length > 60
      ? `${content.slice(0, 60)}...`
      : content || "A envoyé une pièce jointe";

  await notificationService.notifySingleUser(
    receiverId,
    `Nouveau message de ${senderName}`,
    preview,
    NotificationType.SYSTEM,
    {
      type: "private_message",
      conversationId: conversationId.toString(),
      senderId: sender.toString(),
      senderName,
      senderImage: senderUser?.profileImage?.secure_url || "",
    },
    false // Do not save notification to DB for private messages
  );

  return populatedMessage;
};

const getMessages = async (query: GetMessagesQuery) => {
  const { conversationId, page, limit } = query;

  if (!Types.ObjectId.isValid(conversationId)) {
    throw new CustomError(400, "Invalid conversation ID");
  }

  const pagination = paginationHelper(String(page), String(limit));

  const [messages, total] = await Promise.all([
    privateMessageModel
      .find({ conversation: conversationId })
      .populate("sender", "firstName lastName profileImage")
      .populate({
        path: "replyTo",
        select: "content sender media",
        populate: {
          path: "sender",
          select: "firstName lastName profileImage",
        },
      })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    privateMessageModel.countDocuments({ conversation: conversationId }),
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

const markAsRead = async (payload: MarkAsReadPayload) => {
  const { conversationId, userId } = payload;

  if (!Types.ObjectId.isValid(conversationId)) {
    throw new CustomError(400, "Invalid conversation ID");
  }

  const now = new Date();

  await privateMessageModel.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: userId },
      status: { $ne: PrivateMessageStatus.READ },
    },
    {
      status: PrivateMessageStatus.READ,
      readAt: now,
    },
  );

  const unreadKey = `unreadCounts.${userId.toString()}`;
  await conversationModel.findByIdAndUpdate(conversationId, {
    [unreadKey]: 0,
  });

  const conversation = await conversationModel.findById(conversationId).lean();
  if (conversation) {
    const senderId = conversation.participants
      .find((p) => p.toString() !== userId.toString())
      ?.toString();

    if (senderId) {
      try {
        const io = getIo();
        io.to(senderId).emit(PrivateChatSocketEvents.PRIVATE_MESSAGES_READ, {
          conversationId,
          readBy: userId,
          readAt: now,
        });
      } catch (_) {
        // silent fail
      }
    }
  }
};

export const privateChatService = {
  startOrGetConversation,
  getConversations,
  sendMessage,
  getMessages,
  markAsRead,
};
