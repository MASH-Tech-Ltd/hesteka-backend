import { Types } from "mongoose";
import { chatReportModel } from "./chatreport.models";
import {
  ChatReportStatus,
  CreateChatReportPayload,
  UpdateChatReportStatusPayload,
} from "./chatreport.interface";
import {
  privateMessageModel,
  conversationModel,
} from "../privatechat/privatechat.models";
import CustomError from "../../../helpers/CustomError";
import { paginationHelper } from "../../../utils/pagination";

const createReport = async (payload: CreateChatReportPayload) => {
  const { reporter, messageId, reason, details } = payload;

  if (!Types.ObjectId.isValid(messageId)) {
    throw new CustomError(400, "Invalid message ID");
  }

  // Fetch message to get conversation and sender
  const message = await privateMessageModel
    .findById(messageId)
    .select("sender conversation")
    .lean();

  if (!message) {
    throw new CustomError(404, "Message not found");
  }

  // Cannot report your own message
  if (message.sender.toString() === reporter.toString()) {
    throw new CustomError(400, "You cannot report your own message");
  }

  // Make sure reporter is a participant of this conversation
  const conversation = await conversationModel
    .findById(message.conversation)
    .select("participants")
    .lean();

  if (!conversation) {
    throw new CustomError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants
    .map((p) => p.toString())
    .includes(reporter.toString());

  if (!isParticipant) {
    throw new CustomError(403, "You are not part of this conversation");
  }

  // Duplicate report check handled by unique index — catch the error gracefully
  try {
    const report = await chatReportModel.create({
      reporter,
      reportedUser: message.sender,
      message: new Types.ObjectId(messageId),
      conversation: message.conversation,
      reason,
      details: details ?? "",
    });

    return report;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new CustomError(400, "You have already reported this message");
    }
    throw error;
  }
};

// Admin: get all reports with pagination and optional status filter
const getAllReports = async (
  page?: number,
  limit?: number,
  status?: ChatReportStatus,
) => {
  const pagination = paginationHelper(String(page), String(limit));

  const filter: any = {};
  if (status) filter.status = status;

  const [reports, total] = await Promise.all([
    chatReportModel
      .find(filter)
      .populate("reporter", "firstName lastName profileImage")
      .populate("reportedUser", "firstName lastName profileImage")
      .populate({
        path: "message",
        select: "content media createdAt",
      })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    chatReportModel.countDocuments(filter),
  ]);

  return {
    reports,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

// Admin: update report status
const updateReportStatus = async (
  reportId: string,
  payload: UpdateChatReportStatusPayload,
) => {
  if (!Types.ObjectId.isValid(reportId)) {
    throw new CustomError(400, "Invalid report ID");
  }

  const report = await chatReportModel.findByIdAndUpdate(
    reportId,
    { status: payload.status },
    { returnDocument: 'after' },
  );

  if (!report) {
    throw new CustomError(404, "Report not found");
  }

  return report;
};

export const chatReportService = {
  createReport,
  getAllReports,
  updateReportStatus,
};
