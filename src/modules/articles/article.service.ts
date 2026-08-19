import { articleModel } from "./article.models";
import { CreateArticlePayload, UpdateArticlePayload, IContentBlock } from "./article.interface";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import CustomError from "../../helpers/CustomError";
import { paginationHelper } from "../../utils/pagination";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;
  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

export const articleService = {
  // Create Article
  async createArticle(payload: CreateArticlePayload, file?: Express.Multer.File) {
    let image: any = undefined;

    if (file) {
      try {
        image = await uploadCloudinary(file.path);
      } catch (error) {
        throw new CustomError(500, "Error uploading image");
      }
    }

    let parsedContentBlocks: IContentBlock[] = [];
    if (typeof payload.contentBlocks === "string") {
      try {
        parsedContentBlocks = JSON.parse(payload.contentBlocks);
      } catch (e) {
        throw new CustomError(400, "Invalid format for contentBlocks");
      }
    } else {
      parsedContentBlocks = payload.contentBlocks as IContentBlock[];
    }

    const articleData: any = { ...payload, contentBlocks: parsedContentBlocks };
    if (image) {
      articleData.image = image;
    }

    const article = await articleModel.create(articleData);
    return article;
  },

  // Get All Articles (Admin)
  async getAllArticles(query: any = {}) {
    // 1. Process Query Params
    const { page, limit, skip } = paginationHelper(query.page as string, query.limit as string);
    
    const search = query.search || "";
    const status = query.status || "all";
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sort === "ascending" ? 1 : -1;

    // 2. Build Filter
    const filter: any = {};
    if (status && status !== "all") {
      filter.isActive = status === "active";
    }

    // 3. Handle Search
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { title: searchRegex },
        { mainCategory: searchRegex },
        { author: searchRegex },
        { tag: searchRegex }
      ];
    }

    // 4. Handle Sorting
    let sortConfig: any = { createdAt: sortOrder };
    if (sortBy === "title") {
      sortConfig = { title: sortOrder };
    } else if (sortBy === "date") {
      sortConfig = { createdAt: sortOrder };
    } else if (sortBy === "category") {
      sortConfig = { mainCategory: sortOrder };
    } else if (sortBy === "author") {
      sortConfig = { author: sortOrder };
    }

    // 5. Execute Query
    const total = await articleModel.countDocuments(filter);
    const articles = await articleModel.find(filter)
      .sort(sortConfig)
      .skip(skip)
      .limit(limit);

    return {
      data: articles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  // Get Active Articles (Mobile App)
  async getActiveArticles(query: any = {}) {
    const { page, limit, skip } = paginationHelper(query.page as string, query.limit as string);
    const mainCategory = query.category;

    const dbQuery: any = { isActive: true };
    if (mainCategory && mainCategory !== "All" && mainCategory !== "ALL") {
      dbQuery.mainCategory = mainCategory;
    }
    
    const total = await articleModel.countDocuments(dbQuery);
    const articles = await articleModel.find(dbQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    return {
      data: articles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  // Get Single Article
  async getArticleById(id: string) {
    const article = await articleModel.findById(id);
    if (!article) throw new CustomError(404, "Article not found");
    return article;
  },

  // Update Article
  async updateArticle(id: string, payload: UpdateArticlePayload, file?: Express.Multer.File) {
    const article = await articleModel.findById(id);
    if (!article) throw new CustomError(404, "Article not found");

    if (file) {
      if (article.image?.public_id) {
        await deleteCloudinaryQuietly(article.image.public_id);
      }
      try {
        const image = await uploadCloudinary(file.path);
        article.image = image;
      } catch (error) {
        throw new CustomError(500, "Error uploading image");
      }
    }

    let parsedContentBlocks = undefined;
    if (payload.contentBlocks) {
      if (typeof payload.contentBlocks === "string") {
        try {
          parsedContentBlocks = JSON.parse(payload.contentBlocks);
        } catch (e) {
          throw new CustomError(400, "Invalid format for contentBlocks");
        }
      } else {
        parsedContentBlocks = payload.contentBlocks;
      }
    }

    const updatedData = { ...payload };
    if (parsedContentBlocks) {
      updatedData.contentBlocks = parsedContentBlocks;
    }

    Object.assign(article, updatedData);
    await article.save();
    return article;
  },

  // Delete Article
  async deleteArticle(id: string) {
    const article = await articleModel.findById(id);
    if (!article) throw new CustomError(404, "Article not found");

    if (article.image?.public_id) {
      await deleteCloudinaryQuietly(article.image.public_id);
    }
    await article.deleteOne();
    return article;
  },
};
