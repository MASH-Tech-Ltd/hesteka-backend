import { articleModel } from "./article.models";
import { CreateArticlePayload, UpdateArticlePayload, IContentBlock } from "./article.interface";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import CustomError from "../../helpers/CustomError";

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
  async getAllArticles() {
    const articles = await articleModel.find().sort({ createdAt: -1 });
    return articles;
  },

  // Get Active Articles (Mobile App)
  async getActiveArticles(mainCategory?: string) {
    const query: any = { isActive: true };
    if (mainCategory && mainCategory !== "All") {
      query.mainCategory = mainCategory;
    }
    const articles = await articleModel.find(query).sort({ createdAt: -1 });
    return articles;
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
