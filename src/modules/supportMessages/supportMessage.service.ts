import { Request } from "express";
import { mailer } from "../../helpers/nodeMailer";
import CustomError from "../../helpers/CustomError";
import { paginationHelper } from "../../utils/pagination";
import {
  CreateSupportMessagePayload,
  ISupportMessage,
  SupportMessageStatus,
} from "./supportMessage.interface";
import { SupportMessageModel } from "./supportMessage.models";
import { getNewSupportRequestTemplate, getSupportReplyTemplate } from "../../tempaletes/emailTemplates";

export const supportMessageService = {
  async createSupportMessage(req: Request) {
    const userId = req.user?._id;
    const data = req.body as CreateSupportMessagePayload;

    if (!userId) {
      throw new CustomError(401, "Authentication required");
    }

    const newMessage = await SupportMessageModel.create({
      ...data,
      user: userId,
    });

    try {
      await mailer({
        email: "contact@hesteka.com",
        subject: `New Support Request: ${data.subject}`,
        template: getNewSupportRequestTemplate({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        }),
      });
    } catch (err) {
      console.error("Failed to send support notification email:", err);
    }

    return newMessage;
  },

  async getMySupportMessages(req: Request) {
    const userId = req.user?._id;
    if (!userId) {
      throw new CustomError(401, "Authentication required");
    }

    const { page: queryPage, limit: queryLimit } = req.query;
    const { page, limit, skip } = paginationHelper(
      queryPage as string,
      queryLimit as string,
    );

    const [messages, total] = await Promise.all([
      SupportMessageModel.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportMessageModel.countDocuments({ user: userId }),
    ]);

    return {
      messages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getAllSupportMessages(req: Request) {
    const { page: queryPage, limit: queryLimit, status, search } = req.query;
    const { page, limit, skip } = paginationHelper(
      queryPage as string,
      queryLimit as string,
    );

    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { subject: searchRegex },
        { message: searchRegex },
      ];
    }

    const [messages, total] = await Promise.all([
      SupportMessageModel.find(filter)
        .populate("user", "firstName lastName email profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportMessageModel.countDocuments(filter),
    ]);

    return {
      messages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getSupportMessageById(id: string) {
    const message = await SupportMessageModel.findById(id).populate(
      "user",
      "firstName lastName email",
    );
    if (!message) {
      throw new CustomError(404, "Support message not found");
    }
    return message;
  },

  async replyToSupportMessage(id: string, replyMessage: string) {
    const message = await SupportMessageModel.findById(id);
    if (!message) {
      throw new CustomError(404, "Support message not found");
    }

    if (message.status === SupportMessageStatus.CLOSED) {
      throw new CustomError(400, "This support ticket is already closed");
    }

    message.adminReply = replyMessage;
    message.status = SupportMessageStatus.CLOSED;
    await message.save();

    await mailer({
      email: message.email,
      subject: `Re: ${message.subject}`,
      template: getSupportReplyTemplate({
        name: message.name,
        subject: message.subject,
        replyMessage: replyMessage,
      }),
    });

    return message;
  },

  async deleteSupportMessage(id: string) {
    const message = await SupportMessageModel.findByIdAndDelete(id);
    if (!message) {
      throw new CustomError(404, "Support message not found");
    }
    return true;
  },
};
