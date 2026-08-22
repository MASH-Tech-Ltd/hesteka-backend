import { articleModel } from "./article.models";
import { articleCategoryModel } from "./article.category.model";
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

const parseContentBlocks = (raw: string | IContentBlock[]): IContentBlock[] => {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      throw new CustomError(400, "Invalid format for contentBlocks");
    }
  }
  return raw as IContentBlock[];
};

export const articleService = {
  // ─── Create Article ───────────────────────────────────────────────────────────
  async createArticle(payload: CreateArticlePayload, file?: Express.Multer.File) {
    let image: any = undefined;

    if (file) {
      try {
        image = await uploadCloudinary(file.path);
      } catch {
        throw new CustomError(500, "Error uploading image");
      }
    }

    const parsedContentBlocks = parseContentBlocks(payload.contentBlocks);
    const articleData: any = { ...payload, contentBlocks: parsedContentBlocks };
    if (image) articleData.image = image;

    return await articleModel.create(articleData);
  },

  // ─── Article Home Page ────────────────────────────────────────────────────────
  // Returns: 1 featured article + 2 articles per distinct category (active only)
  async getArticleHomePage() {
    // 1. Featured article
    const featured = await articleModel
      .findOne({ isFeatured: true, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Distinct categories from active articles
    const categories: string[] = await articleModel.distinct("mainCategory", { isActive: true });

    // 3. Fetch 2 articles per category in parallel
    const categoryGroups = await Promise.all(
      categories.map(async (categoryName) => {
        const articles = await articleModel
          .find({ mainCategory: categoryName, isActive: true })
          .sort({ createdAt: -1 })
          .limit(2)
          .lean();
        return { name: categoryName, articles };
      })
    );

    return { featured, categories: categoryGroups };
  },

  // ─── Get All Articles (Admin) ─────────────────────────────────────────────────
  // Shows ALL articles regardless of isActive. Supports pagination + search + sort + status filter.
  async getAllArticles(query: any = {}) {
    const { page, limit, skip } = paginationHelper(query.page as string, query.limit as string);

    const search = query.search || "";
    const status = query.status || "all";
    const category = query.category || "";
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sort === "ascending" ? 1 : -1;

    // Filter
    const filter: any = {};
    if (status && status !== "all") {
      filter.isActive = status === "active";
    }
    if (category) {
      filter.mainCategory = category;
    }

    // Search
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { title: searchRegex },
        { mainCategory: searchRegex },
        { author: searchRegex },
        { tag: searchRegex },
      ];
    }

    // Sort
    const sortFieldMap: Record<string, string> = {
      title: "title",
      date: "createdAt",
      category: "mainCategory",
      author: "author",
    };
    const sortField = sortFieldMap[sortBy] ?? "createdAt";
    const sortConfig: any = { [sortField]: sortOrder };

    const total = await articleModel.countDocuments(filter);
    const articles = await articleModel.find(filter).sort(sortConfig).skip(skip).limit(limit).lean();

    return {
      data: articles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  // ─── Get Articles By Category (Public) ───────────────────────────────────────
  // Shows only ACTIVE articles for a given category with pagination.
  async getArticleByCategory(query: any = {}) {
    const { page, limit, skip } = paginationHelper(query.page as string, query.limit as string);
    const category = query.category as string;

    if (!category) {
      throw new CustomError(400, "Category is required");
    }

    const filter: any = { isActive: true, mainCategory: category };

    const total = await articleModel.countDocuments(filter);
    const articles = await articleModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      data: articles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  // ─── Get Single Article ───────────────────────────────────────────────────────
  // Public: only active articles. Admin: any article.
  // Also returns 2 related articles from the same category.
  async getSingleArticle(id: string, isAdmin: boolean = false) {
    const filter: any = { _id: id };
    if (!isAdmin) filter.isActive = true;

    const article = await articleModel.findOne(filter).lean();
    if (!article) throw new CustomError(404, "Article not found");

    // Fetch related active articles (same category, exclude current)
    let relatedArticles = await articleModel
      .find({
        _id: { $ne: article._id },
        mainCategory: article.mainCategory,
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    // Fallback: If less than 2, fetch any latest active articles to fill the gap
    if (relatedArticles.length < 2) {
      const needed = 2 - relatedArticles.length;
      const existingIds = relatedArticles.map(a => a._id);
      existingIds.push(article._id); // exclude current

      const fallbackArticles = await articleModel
        .find({
          _id: { $nin: existingIds },
          isActive: true,
        })
        .sort({ createdAt: -1 })
        .limit(needed)
        .lean();

      relatedArticles = [...relatedArticles, ...fallbackArticles];
    }

    return { article, relatedArticles };
  },

  // ─── Update Article (Admin) ───────────────────────────────────────────────────
  async updateArticle(id: string, payload: UpdateArticlePayload, file?: Express.Multer.File) {
    const article = await articleModel.findById(id);
    if (!article) throw new CustomError(404, "Article not found");

    if (file) {
      await deleteCloudinaryQuietly(article.image?.public_id);
      try {
        article.image = await uploadCloudinary(file.path);
      } catch {
        throw new CustomError(500, "Error uploading image");
      }
    }

    const updatedData: any = { ...payload };
    if (payload.contentBlocks) {
      updatedData.contentBlocks = parseContentBlocks(payload.contentBlocks);
    }

    Object.assign(article, updatedData);
    await article.save();
    return article;
  },

  // ─── Delete Article (Admin) ───────────────────────────────────────────────────
  async deleteArticle(id: string) {
    const article = await articleModel.findById(id);
    if (!article) throw new CustomError(404, "Article not found");

    await deleteCloudinaryQuietly(article.image?.public_id);
    await article.deleteOne();
    return article;
  },

  // ─── Get Article Categories (Public + Admin) ──────────────────────────────────
  // Merges stored categories (from ArticleCategory collection) with distinct
  // mainCategory values already used in articles — deduped, sorted A-Z.
  async getArticleCategory() {
    const [storedDocs, usedNames] = await Promise.all([
      articleCategoryModel.find({ isActive: true }).lean(),
      articleModel.distinct("mainCategory", { isActive: true }),
    ]);

    const stored = storedDocs.map((c) => ({ _id: c._id.toString(), name: c.name }));

    // Add any article-used categories not yet in the categories collection
    const storedNames = new Set(stored.map((c) => c.name.toLowerCase()));
    const extra = usedNames
      .filter((n: string) => !storedNames.has(n.toLowerCase()))
      .map((name: string) => ({ _id: null, name }));

    const merged = [...stored, ...extra].sort((a, b) => a.name.localeCompare(b.name));
    return merged;
  },

  // ─── Create Article Category (Admin) ─────────────────────────────────────────
  async createArticleCategory(name: string) {
    const existing = await articleCategoryModel.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existing) throw new CustomError(409, `Category "${name}" already exists`);
    const category = await articleCategoryModel.create({ name: name.trim() });
    return category;
  },

  // ─── Delete Article Category (Admin) ─────────────────────────────────────────
  // Guard: reject if any article (active or inactive) references this category.
  async deleteArticleCategory(id: string) {
    const category = await articleCategoryModel.findById(id);
    if (!category) throw new CustomError(404, "Category not found");

    const usageCount = await articleModel.countDocuments({ mainCategory: category.name });
    if (usageCount > 0) {
      throw new CustomError(
        400,
        `Cannot delete category "${category.name}" — it is used by ${usageCount} article${usageCount > 1 ? "s" : ""}. Please reassign or delete those articles first.`
      );
    }

    await category.deleteOne();
    return category;
  },
};
