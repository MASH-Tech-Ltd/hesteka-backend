import mongoose from "mongoose";
import { Request } from "express";
import { commentModel } from "./comment.models";
import CustomError from "../../helpers/CustomError";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import { IComment } from "./comment.interface";
import { reportModel } from "../reports/report.models";
import { notificationService } from "../notifications/notification.service";
import { NotificationType } from "../notifications/notification.interface";
import { userModel } from "../usersAuth/user.models";

const getCommentReportId = (comment: IComment): string => comment.report.toString();

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;

  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

export const commentService = {
  // Create a new comment or reply
  async createComment(req: Request) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const publicIdsToDelete: string[] = [];
    try {
      const authorId = req.user?._id;
      if (!authorId) throw new CustomError(401, "Unauthorized");
      const { content, reportId, parentId } = req.body;
      const image = req.file;

      // Verify report exists
      const report = await reportModel.findById(reportId).session(session);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }

      let imageData = undefined;
      if (image) {
        const result = await uploadCloudinary(image.path);
        if (result) {
          imageData = result;
        }
      }

      const commentData: any = {
        content,
        author: authorId,
        report: reportId,
        image: imageData,
      };

      if (parentId) {
        const parentComment = await commentModel.findById(parentId).session(session);
        if (!parentComment || parentComment.isDeleted) {
          throw new CustomError(404, "Parent comment not found");
        }
        if (getCommentReportId(parentComment) !== reportId) {
          throw new CustomError(400, "Parent comment does not belong to this report");
        }
        commentData.parent = parentId;
      }

      const [newComment] = await commentModel.create([commentData], { session });

      if (!newComment) {
        throw new CustomError(500, "Failed to create comment");
      }

      // Push ID to report
      await reportModel.findByIdAndUpdate(
        reportId,
        { $push: { comments: newComment._id } },
        { session }
      );

      await session.commitTransaction();

      // Populate author before returning (after commit is fine)
      await newComment.populate("author", "firstName lastName profileImage");

      // Notifications
      if (report.author.toString() !== authorId.toString()) {
        const commenter = await userModel.findById(authorId).select("firstName lastName").lean();
        const commenterName = commenter ? `${commenter.firstName} ${commenter.lastName}`.trim() : "Quelqu'un";
        const title = "Nouveau commentaire";
        const bodyMsg = `${commenterName} a commenté votre signalement "${report.title || report.animalName || 'sans titre'}".`;
        
        notificationService.notifySingleUser(
          report.author.toString(),
          title,
          bodyMsg,
          NotificationType.NEW_COMMENT
        ).catch(err => console.error("Comment notification error:", err));
      }

      return newComment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  // Create a reply specifically via commentId from params
  async createReply(req: Request) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const authorId = req.user?._id;
      if (!authorId) throw new CustomError(401, "Unauthorized");
      const { commentId: parentId } = req.params;
      const { content, reportId } = req.body;
      const image = req.file;

      // Verify parent comment exists
      const parentComment = await commentModel.findById(parentId).session(session);
      if (!parentComment || parentComment.isDeleted) {
        throw new CustomError(404, "Parent comment not found");
      }

      // Verify report exists
      const report = await reportModel.findById(reportId).session(session);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }
      if (getCommentReportId(parentComment) !== reportId) {
        throw new CustomError(400, "Parent comment does not belong to this report");
      }

      let imageData = undefined;
      if (image) {
        const result = await uploadCloudinary(image.path);
        if (result) {
          imageData = result;
        }
      }

      const replyData: any = {
        content,
        author: authorId,
        report: reportId,
        parent: parentId,
        image: imageData,
      };

      const [newReply] = await commentModel.create([replyData], { session });

      if (!newReply) {
        throw new CustomError(500, "Failed to create reply");
      }

      // We DO NOT push reply ID to report.comments
      // Replies are tracked dynamically via the "replies" virtual on the parent comment.

      await session.commitTransaction();

      // Populate author before returning
      await newReply.populate("author", "firstName lastName profileImage");

      // Notifications
      if (parentComment.author.toString() !== authorId.toString()) {
        const replier = await userModel.findById(authorId).select("firstName lastName").lean();
        const replierName = replier ? `${replier.firstName} ${replier.lastName}`.trim() : "Quelqu'un";
        const title = "Nouvelle réponse";
        const bodyMsg = `${replierName} a répondu à votre commentaire.`;
        
        notificationService.notifySingleUser(
          parentComment.author.toString(),
          title,
          bodyMsg,
          NotificationType.NEW_REPLY
        ).catch(err => console.error("Reply notification error:", err));
      }

      return newReply;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  // Update a specific reply (with author check)
  async updateReply(req: Request) {
    const authorId = req.user?._id;
    const { replyId } = req.params;
    const { content } = req.body;
    const image = req.file;
    let oldPublicIdToDelete: string | undefined;
    let newPublicIdToDeleteOnFailure: string | undefined;

    const reply = await commentModel.findById(replyId);
    if (!reply || reply.isDeleted) {
      throw new CustomError(404, "Reply not found");
    }

    // Authorization check: "cant edit/delete others"
    if (reply.author.toString() !== authorId?.toString()) {
      throw new CustomError(403, "You can only edit your own replies");
    }

    if (content) {
      reply.content = content;
    }

    if (image) {
      oldPublicIdToDelete = reply.image?.public_id;
      const result = await uploadCloudinary(image.path);
      if (result) {
        reply.image = result;
        newPublicIdToDeleteOnFailure = result.public_id;
      }
    }

    try {
      await reply.save();
    } catch (error) {
      await deleteCloudinaryQuietly(newPublicIdToDeleteOnFailure);
      throw error;
    }

    await deleteCloudinaryQuietly(oldPublicIdToDelete);
    return reply;
  },

  // Delete a specific reply (with cascade for nested replies and author check)
  async deleteReply(replyId: string, userId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const publicIdsToDelete: string[] = [];
    try {
      const reply = await commentModel.findById(replyId).session(session);
      if (!reply || reply.isDeleted) {
        throw new CustomError(404, "Reply not found");
      }

      // Authorization check
      if (reply.author.toString() !== userId) {
        throw new CustomError(403, "You can only delete your own replies");
      }

      // 1. Recursive Cascade: Delete any replies to this reply
      const childReplies = await commentModel.find({ parent: replyId }).session(session);
      for (const child of childReplies) {
        if (child.image?.public_id) {
          publicIdsToDelete.push(child.image.public_id);
        }
        await child.deleteOne({ session });
        
        // We do not pull child from report because child replies are not in report.comments
      }

      // 2. Delete this reply's image from Cloudinary (Happens outside DB transaction, but safe enough)
      if (reply.image?.public_id) {
        publicIdsToDelete.push(reply.image.public_id);
      }

      // 3. Delete this reply document
      await reply.deleteOne({ session });

      // We do not pull this reply from report because replies are not in report.comments

      await session.commitTransaction();
      await Promise.all(publicIdsToDelete.map(deleteCloudinaryQuietly));
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  // Get all comments for a report (nested)
  async getCommentsByReport(reportId: string) {
    const comments = await commentModel.find({ report: reportId, parent: null, isDeleted: false })
      .populate("author", "firstName lastName profileImage")
      .populate({
        path: "replies",
        match: { isDeleted: false },
        populate: { path: "author", select: "firstName lastName profileImage" }
      })
      .sort({ createdAt: -1 });

    return comments;
  },

  // Get single comment
  async getCommentById(commentId: string) {
    const comment = await commentModel.findById(commentId)
      .populate("author", "firstName lastName profileImage")
      .populate({
        path: "replies",
        match: { isDeleted: false },
        populate: { path: "author", select: "firstName lastName profileImage" }
      });

    if (!comment || comment.isDeleted) {
      throw new CustomError(404, "Comment not found");
    }

    return comment;
  },

  // Toggle like
  async toggleLike(commentId: string, userId: string) {
    const comment = await commentModel.findById(commentId);
    if (!comment || comment.isDeleted) {
      throw new CustomError(404, "Comment not found");
    }

    const isLiked = comment.likes.some(id => id.toString() === userId);
    if (isLiked) {
      comment.likes = comment.likes.filter(id => id.toString() !== userId);
    } else {
      comment.likes.push(userId);
    }

    await comment.save();
    return comment;
  },

  // Update comment
  async updateComment(req: Request) {
    const authorId = req.user?._id;
    const { commentId } = req.params;
    const { content } = req.body;
    const image = req.file;
    let oldPublicIdToDelete: string | undefined;
    let newPublicIdToDeleteOnFailure: string | undefined;

    const comment = await commentModel.findById(commentId);
    if (!comment || comment.isDeleted) {
      throw new CustomError(404, "Comment not found");
    }

    if (comment.author.toString() !== authorId?.toString()) {
      throw new CustomError(403, "You are not authorized to update this comment");
    }

    if (content) {
      comment.content = content;
    }

    if (image) {
      oldPublicIdToDelete = comment.image?.public_id;
      const result = await uploadCloudinary(image.path);
      if (result) {
        comment.image = result;
        newPublicIdToDeleteOnFailure = result.public_id;
      }
    }

    try {
      await comment.save();
    } catch (error) {
      await deleteCloudinaryQuietly(newPublicIdToDeleteOnFailure);
      throw error;
    }

    await deleteCloudinaryQuietly(oldPublicIdToDelete);
    return comment;
  },

  // Delete comment (with cascade for replies)
  async deleteComment(commentId: string, userId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const publicIdsToDelete: string[] = [];
    try {
      const comment = await commentModel.findById(commentId).session(session);
      if (!comment || comment.isDeleted) {
        throw new CustomError(404, "Comment not found");
      }

      if (comment.author.toString() !== userId) {
        throw new CustomError(403, "You are not authorized to delete this comment");
      }

      // 1. Find and delete all replies (Cascade)
      const replies = await commentModel.find({ parent: commentId }).session(session);
      for (const reply of replies) {
        // Delete reply image from Cloudinary
        if (reply.image?.public_id) {
          publicIdsToDelete.push(reply.image.public_id);
        }
        // Delete the reply document
        await reply.deleteOne({ session });
        
        // Pull each reply from report comments array? No, replies are not in report.comments
      }

      // 2. Delete parent comment image
      if (comment.image?.public_id) {
        publicIdsToDelete.push(comment.image.public_id);
      }

      // 3. Delete parent comment document
      await comment.deleteOne({ session });

      // 4. Remove parent from report
      await reportModel.findByIdAndUpdate(
        comment.report,
        { $pull: { comments: commentId } },
        { session }
      );

      await session.commitTransaction();
      await Promise.all(publicIdsToDelete.map(deleteCloudinaryQuietly));
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  // Delete all comments for a report (internal use)
  async deleteAllCommentsByReport(reportId: string, session?: mongoose.ClientSession) {
    const comments = await commentModel.find({ report: reportId }).session(session || null);
    const publicIdsToDelete = comments
      .map((comment) => comment.image?.public_id)
      .filter((publicId): publicId is string => Boolean(publicId));

    await commentModel.deleteMany(
      { report: reportId },
      session ? { session } : undefined,
    );
    if (!session) {
      await Promise.all(publicIdsToDelete.map(deleteCloudinaryQuietly));
    }
    return publicIdsToDelete;
  },
};
