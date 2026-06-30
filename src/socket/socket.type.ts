import { Socket } from "socket.io";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  currentGeohashes?: string[];
}

export interface SocketLocationPayload {
  lat: number;
  lng: number;
}

export interface SocketTypingPayload {
  lat: number;
  lng: number;
  isTyping: boolean;
}

export interface PrivateTypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export enum ChatSocketEvents {
  // Client → Server
  LOCATION_UPDATE = "location:update",
  CHAT_TYPING = "chat:typing",

  // Server → Client (Global Chat)
  CHAT_NEW_MESSAGE = "chat:newMessage",
  CHAT_MESSAGE_UPDATED = "chat:messageUpdated",
  CHAT_LIKE_UPDATE = "chat:likeUpdate",
  CHAT_MESSAGE_DELETED = "chat:messageDeleted",
  CHAT_USER_TYPING = "chat:userTyping",
  CHAT_ERROR = "chat:error",

  // Server → Client (Reply)
  CHAT_REPLY_RECEIVED = "chat:replyReceived",
}

export enum PrivateChatSocketEvents {
  // Client → Server
  PRIVATE_TYPING = "privateChat:typing",

  // Server → Client
  PRIVATE_NEW_MESSAGE = "privateChat:newMessage",
  PRIVATE_MESSAGES_READ = "privateChat:messagesRead",
  PRIVATE_USER_TYPING = "privateChat:userTyping",
}
