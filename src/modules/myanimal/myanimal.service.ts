import { Request } from "express";
import { myanimalModel } from "./myanimal.models";
import { CreateMyanimalPayload, UpdateMyanimalPayload } from "./myanimal.interface";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";

export const myanimalService = {
  async createMyanimal(req: Request) {
    const data = req.body as CreateMyanimalPayload;
    console.log("Create MyAnimal Request Body Data:", data);
    const image = req.file;

    const payload: any = {
      ...data,
      user: req.user?._id,
    };

    if (image) {
      payload.photo = await uploadCloudinary(image.path);
    }

    try {
      const item = await myanimalModel.create(payload);
      return await item.populate("user", "firstName lastName email profileImage");
    } catch (error) {
      console.error("Custom Error in Create MyAnimal:", error);
      if (payload.photo?.public_id) {
        await deleteCloudinary(payload.photo.public_id).catch(console.error);
      }
      throw error;
    }
  },

  async getAllMyanimals(req: Request) {
    const {
      page: pageQuery,
      limit: limitQuery,
      search,
      status,
    } = req.query;

    const { page, limit, skip } = paginationHelper(pageQuery as string, limitQuery as string);
    const filter: any = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
      ];
    }

    const [items, total] = await Promise.all([
      myanimalModel
        .find(filter)
        .populate("user", "firstName lastName email profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      myanimalModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getMyanimalById(id: string) {
    const item = await myanimalModel
      .findById(id)
      .populate("user", "firstName lastName email profileImage");
    if (!item) throw new CustomError(404, "Animal not found");
    return item;
  },

  async getMyAnimals(req: Request) {
    const userId = req.user?._id;
    if (!userId) throw new CustomError(401, "Unauthorized access");
    
    return await myanimalModel
      .find({ user: userId })
      .populate("user", "firstName lastName email profileImage")
      .sort({ createdAt: -1 });
  },

  async updateMyanimal(req: Request) {
    const id = req.params.id as string;
    const userId = req.user?._id;
    const data = req.body as UpdateMyanimalPayload;
    const image = req.file;

    const item = await myanimalModel.findById(id);
    if (!item) throw new CustomError(404, "Animal not found");

    // Only the owner or an admin could potentially update this.
    // For simplicity, we ensure only the owner can update.
    if (item.user.toString() !== userId?.toString()) {
      throw new CustomError(403, "You can only update your own animal");
    }

    const oldPublicId = image ? item.photo?.public_id : undefined;
    let newPublicId: string | undefined;

    Object.assign(item, data);

    if (image) {
      const uploaded = await uploadCloudinary(image.path);
      item.photo = uploaded;
      newPublicId = uploaded.public_id;
    }

    try {
      await item.save();
    } catch (error) {
      if (newPublicId) {
        await deleteCloudinary(newPublicId).catch(console.error);
      }
      throw error;
    }

    if (oldPublicId) {
      await deleteCloudinary(oldPublicId).catch(console.error);
    }

    return await item.populate("user", "firstName lastName email profileImage");
  },

  async deleteMyanimal(req: Request) {
    const id = req.params.id as string;
    const userId = req.user?._id;

    const item = await myanimalModel.findById(id);
    if (!item) throw new CustomError(404, "Animal not found");

    if (item.user.toString() !== userId?.toString()) {
      throw new CustomError(403, "You can only delete your own animal");
    }

    await item.deleteOne();

    if (item.photo?.public_id) {
      await deleteCloudinary(item.photo.public_id).catch(console.error);
    }

    return true;
  },
};
