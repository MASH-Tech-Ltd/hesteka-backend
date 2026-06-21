import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { FriendModel } from "./friend.models";
import { FriendStatus } from "./friend.interface";
import { userModel } from "../usersAuth/user.models";
import { Types } from "mongoose";
import { getIo } from "../../socket/server";

export const friendService = {
  async sendFriendRequest(req: Request) {
    const requesterId = req.user?._id as string;
    const recipientId = req.params.userId as string;

    if (requesterId.toString() === recipientId) {
      throw new CustomError(400, "You cannot send a friend request to yourself");
    }

    const recipient = await userModel.findById(recipientId);
    if (!recipient) {
      throw new CustomError(404, "User not found");
    }

    const existingRelation = await FriendModel.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ]
    });

    if (existingRelation) {
      if (existingRelation.status === FriendStatus.PENDING) {
        throw new CustomError(400, "Friend request already pending");
      }
      if (existingRelation.status === FriendStatus.ACCEPTED) {
        throw new CustomError(400, "You are already friends");
      }
      if (existingRelation.status === FriendStatus.BLOCKED) {
        throw new CustomError(400, "Cannot send request, blocked relationship exists");
      }
      if (existingRelation.status === FriendStatus.REJECTED) {
        existingRelation.requester = new Types.ObjectId(requesterId);
        existingRelation.recipient = new Types.ObjectId(recipientId);
        existingRelation.status = FriendStatus.PENDING;
        await existingRelation.save();
        
        getIo().to(recipientId).emit("friend_request_received", existingRelation);
        return existingRelation;
      }
    }

    const newRequest = await FriendModel.create({
      requester: requesterId,
      recipient: recipientId,
      status: FriendStatus.PENDING,
    });

    getIo().to(recipientId).emit("friend_request_received", newRequest);
    return newRequest;
  },

  async acceptFriendRequest(req: Request) {
    const userId = req.user?._id as string;
    const requestId = req.params.requestId as string;

    const request = await FriendModel.findOne({
      _id: requestId,
      recipient: userId,
      status: FriendStatus.PENDING,
    });

    if (!request) {
      throw new CustomError(404, "Pending friend request not found");
    }

    request.status = FriendStatus.ACCEPTED;
    await request.save();
    
    getIo().to(request.requester.toString()).emit("friend_request_accepted", request);
    return request;
  },

  async rejectFriendRequest(req: Request) {
    const userId = req.user?._id as string;
    const requestId = req.params.requestId as string;

    const request = await FriendModel.findOne({
      _id: requestId,
      recipient: userId,
      status: FriendStatus.PENDING,
    });

    if (!request) {
      throw new CustomError(404, "Pending friend request not found");
    }

    request.status = FriendStatus.REJECTED;
    await request.save();
    
    getIo().to(request.requester.toString()).emit("friend_request_rejected", request);
    return request;
  },

  async blockUser(req: Request) {
    const userId = req.user?._id as string;
    const targetUserId = req.params.userId as string;

    if (userId.toString() === targetUserId) {
      throw new CustomError(400, "You cannot block yourself");
    }

    let relation = await FriendModel.findOne({
      $or: [
        { requester: userId, recipient: targetUserId },
        { requester: targetUserId, recipient: userId },
      ]
    });

    if (relation) {
      relation.status = FriendStatus.BLOCKED;
      relation.requester = new Types.ObjectId(userId);
      relation.recipient = new Types.ObjectId(targetUserId);
      await relation.save();
    } else {
      relation = await FriendModel.create({
        requester: userId,
        recipient: targetUserId,
        status: FriendStatus.BLOCKED,
      });
    }

    return relation;
  },

  async unblockUser(req: Request) {
    const userId = req.user?._id as string;
    const targetUserId = req.params.userId as string;

    const relation = await FriendModel.findOne({
      requester: userId,
      recipient: targetUserId,
      status: FriendStatus.BLOCKED,
    });

    if (!relation) {
      throw new CustomError(404, "Blocked relationship not found");
    }

    await relation.deleteOne();
    return true;
  },

  async removeFriend(req: Request) {
    const userId = req.user?._id as string;
    const targetUserId = req.params.userId as string;

    const relation = await FriendModel.findOne({
      $or: [
        { requester: userId, recipient: targetUserId },
        { requester: targetUserId, recipient: userId },
      ],
      status: { $in: [FriendStatus.ACCEPTED, FriendStatus.PENDING] },
    });

    if (!relation) {
      throw new CustomError(404, "Relationship not found");
    }

    await relation.deleteOne();
    
    getIo().to(targetUserId).emit("friend_removed", { friendId: userId });
    return true;
  },

  async getMyFriends(req: Request) {
    const userId = req.user?._id as string;
    const friends = await FriendModel.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: FriendStatus.ACCEPTED,
    }).populate("requester recipient", "firstName lastName email image profileImage");

    return friends.map((f: any) => {
      const friend = f.requester._id.toString() === userId.toString() ? f.recipient : f.requester;
      return { relationId: f._id, friend };
    });
  },

  async getPendingRequests(req: Request) {
    const userId = req.user?._id as string;
    return await FriendModel.find({
      recipient: userId,
      status: FriendStatus.PENDING,
    }).populate("requester", "firstName lastName email image profileImage");
  },

  async searchUsers(req: Request) {
    const userId = req.user?._id as string;
    const search = req.query.q as string || "";
    
    const searchRegex = new RegExp(search, "i");
    const users = await userModel.find({
      _id: { $ne: userId },
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ]
    }).select("firstName lastName email image profileImage").limit(20);

    const relations = await FriendModel.find({
      $or: [{ requester: userId }, { recipient: userId }]
    });

    return users.map(user => {
      const rel = relations.find(r => 
        r.requester.toString() === user._id.toString() || 
        r.recipient.toString() === user._id.toString()
      );
      
      return {
        user,
        relationStatus: rel ? rel.status : "none",
        relationId: rel ? rel._id : null,
        isRequester: rel ? rel.requester.toString() === userId.toString() : false
      };
    });
  }
};
