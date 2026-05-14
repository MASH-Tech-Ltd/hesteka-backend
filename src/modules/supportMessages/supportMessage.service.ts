import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { paginationHelper } from "../../utils/pagination";
import { CreateSupportMessagePayload, ISupportMessage } from "./supportMessage.interface";
import { SupportMessageModel } from "./supportMessage.models";

export const supportMessageService = {
  async createSupportMessage(req: Request) {
    const userId = req.user?._id;
    const data = req.body as CreateSupportMessagePayload;

    if (!userId) {
      throw new CustomError(401, "Authentication required");
    }

    return await SupportMessageModel.create({
      ...data,
      user: userId,
    });
  },

  async getAllSupportMessages(req: Request) {
    const { page: queryPage, limit: queryLimit, status, search } = req.query;
    const { page, limit, skip } = paginationHelper(
      queryPage as string,
      queryLimit as string
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
        .populate("user", "firstName lastName email")
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
      "firstName lastName email"
    );
    if (!message) {
      throw new CustomError(404, "Support message not found");
    }
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
