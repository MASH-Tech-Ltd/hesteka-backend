import { Server, Socket } from "socket.io";
import http from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import CustomError from "../helpers/CustomError";
import config from "../config";
import { AuthenticatedSocket } from "./socket.type";
import { registerChatHandlers } from "./chat.handler";
import { userModel } from "../modules/usersAuth/user.models";
import { role } from "../modules/usersAuth/user.interface";
let io: Server | null = null;
const onlineSockets = new Set<string>(); // For total raw connection count if needed
const activeUsers = new Map<string, Set<string>>(); // userId -> Set<socket.id>


interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
}

interface JoinChatPayload {
  chatId: string;
}

export const initSocket = (httpServer: http.Server): Server => {
  if (io) return io;

  const allowedOrigins = [
    config.frontendUrl,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Auth middleware: JWT preferred, query userId as fallback
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split("Bearer ")[1];

      // If token provided — verify it (secure path)
      if (token) {
        const decoded = jwt.verify(
          token,
          config.jwt.accessTokenSecret,
        ) as TokenPayload;

        console.log("Decoded, ", decoded);
        if (!decoded || !decoded.userId) {
          return next(new Error("Invalid token"));
        }

        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        return next();
      }
      
      // Fallback — legacy userId in query (for notification client)
      const queryUserId = socket.handshake.query?.userId as string | undefined;
      const queryEmail = socket.handshake.query?.email as string | undefined;

      if (queryUserId) {
        socket.userId = queryUserId;
        if (queryEmail) {
          socket.userEmail = queryEmail;
        }
        return next();
      }

      // Neither token nor userId — reject
      return next(new Error("Authentication required"));
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId}, email: ${socket.userEmail})`);

    // Track active connection instances (tabs/windows)
    onlineSockets.add(socket.id);
    
    // Track unique users
    if (socket.userId) {
      if (!activeUsers.has(socket.userId)) {
        activeUsers.set(socket.userId, new Set());
        io?.emit("user:status", { userId: socket.userId, isOnline: true });
      }
      activeUsers.get(socket.userId)!.add(socket.id);
    }

    io?.emit("onlineUsersCount", { count: activeUsers.size });

    // Personal room for direct user notifications
    if (socket.userId) {
      socket.join(socket.userId);
    }

    // Email-based room for payment notifications
    if (socket.userEmail) {
      socket.join(socket.userEmail);
      console.log(`📧 Joined email room: ${socket.userEmail}`);
    }

    // Legacy chat room support (for 1-on-1 chats if needed later)
    socket.on("joinChat", ({ chatId }: JoinChatPayload) => {
      if (!chatId) return;
      socket.join(chatId);
      console.log(`💬 Joined chat room: ${chatId}`);
    });

    socket.on("leaveChat", ({ chatId }: JoinChatPayload) => {
      if (!chatId) return;
      socket.leave(chatId);
    });

    // Register community chat handlers
    registerChatHandlers(socket);

    socket.on("disconnect", async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      
      onlineSockets.delete(socket.id);
      
      if (socket.userId && activeUsers.has(socket.userId)) {
        const userSockets = activeUsers.get(socket.userId)!;
        userSockets.delete(socket.id);
        
        // If no more sockets for this user, they are fully offline
        if (userSockets.size === 0) {
          activeUsers.delete(socket.userId);
          io?.emit("user:status", { userId: socket.userId, isOnline: false });
        }
      }

      io?.emit("onlineUsersCount", { count: activeUsers.size });
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) throw new CustomError(500, "Socket not initialized");
  return io;
};

export const getOnlineUsersCount = (): number => {
  return activeUsers.size;
};

export const getOnlineUserIds = (): string[] => {
  return Array.from(activeUsers.keys());
};

export const emitToAdmin = async (event: string, data: any) => {
  try {
    if (!io) return;
    const admins = await userModel.find({ role: role.ADMIN }).select("_id");
    console.log(`[Socket] Found ${admins.length} admins to notify for event: ${event}`);
    admins.forEach((admin) => {
      io!.to(admin._id.toString()).emit(event, data);
    });
  } catch (error) {
    console.error(`Failed to emit event ${event} to admins:`, error);
  }
};

