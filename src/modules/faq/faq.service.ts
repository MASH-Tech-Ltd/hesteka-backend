import { faqModel } from "./faq.models";
import { IFaq } from "./faq.interface";
import CustomError from "../../helpers/CustomError";
import { role } from "../usersAuth/user.interface";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import { Request } from "express";

export const faqService = {
  async createFaq(req: Request) {
    const data = req.body;
    let category = data.category;
    let contentsArray = data.contentsArray;

    if (typeof category === 'string') {
      try { category = JSON.parse(category); } catch (e) {}
    }
    if (typeof contentsArray === 'string') {
      try { contentsArray = JSON.parse(contentsArray); } catch (e) {}
    }

    const payload: Partial<IFaq> = {
      category,
      contentsArray,
      order: Number(data.order) || 0,
      isActive: data.isActive === 'true' || data.isActive === true
    };

    if (req.file) {
      const result = await uploadCloudinary(req.file.path);
      if (result) {
        payload.image = {
          publicId: result.public_id,
          secureUrl: result.secure_url
        };
      }
    }

    return faqModel.create(payload);
  },

  async getAllFaqs(query: any, user?: any) {
    const filter: any = {};
    if (query.category && query.category !== "ALL") {
       filter["category.english"] = query.category; // Temporary fallback if needed, but UI search will change
    }
    
    // Non-admins can only see active FAQs
    if (!user || user.role !== role.ADMIN) {
      filter.isActive = true;
    }
    
    if (query.search) {
      filter.$or = [
        { "contentsArray.question.english.question": { $regex: query.search, $options: "i" } },
        { "contentsArray.question.english.answer": { $regex: query.search, $options: "i" } },
        { "contentsArray.question.french.question": { $regex: query.search, $options: "i" } },
        { "contentsArray.question.french.answer": { $regex: query.search, $options: "i" } },
      ];
    }

    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || "category";
    const sortOrder = query.sortOrder === "desc" ? -1 : 1;

    const [data, total] = await Promise.all([
      faqModel.find(filter).sort({ [sortBy]: sortOrder, order: 1 }).skip(skip).limit(limit),
      faqModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  },

  async getFaqById(id: string, user?: any) {
    const filter: any = { _id: id };
    
    // Non-admins can only see active FAQs
    if (!user || user.role !== role.ADMIN) {
      filter.isActive = true;
    }
    
    const faq = await faqModel.findOne(filter);
    if (!faq) throw new CustomError(404, "FAQ not found");
    return faq;
  },

  async updateFaq(req: Request) {
    const id = req.params.id as string;
    const data = req.body;
    let category = data.category;
    let contentsArray = data.contentsArray;

    if (typeof category === 'string') {
      try { category = JSON.parse(category); } catch (e) {}
    }
    if (typeof contentsArray === 'string') {
      try { contentsArray = JSON.parse(contentsArray); } catch (e) {}
    }

    const payload: any = {};
    if (category) payload.category = category;
    if (contentsArray) payload.contentsArray = contentsArray;
    if (data.order !== undefined) payload.order = Number(data.order);
    if (data.isActive !== undefined) payload.isActive = data.isActive === 'true' || data.isActive === true;

    if (req.file) {
      const result = await uploadCloudinary(req.file.path);
      if (result) {
        payload.image = {
          publicId: result.public_id,
          secureUrl: result.secure_url
        };
        // Option: Delete old image from cloudinary here
        const existingFaq = await faqModel.findById(id);
        if (existingFaq?.image?.publicId) {
          try { await deleteCloudinary(existingFaq.image.publicId); } catch(e) {}
        }
      }
    }

    const faq = await faqModel.findByIdAndUpdate(id, payload, { returnDocument: "after" });
    if (!faq) throw new CustomError(404, "FAQ not found");
    return faq;
  },

  async deleteFaq(id: string) {
    const faq = await faqModel.findById(id);
    if (!faq) throw new CustomError(404, "FAQ not found");

    if (faq.image?.publicId) {
      try { await deleteCloudinary(faq.image.publicId); } catch(e) {}
    }

    await faq.deleteOne();
    return true;
  },

  async reorderFaqs(orders: { id: string; order: number }[]) {
    const bulkOps = orders.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: item.order } },
      },
    }));
    return faqModel.bulkWrite(bulkOps);
  }
};
