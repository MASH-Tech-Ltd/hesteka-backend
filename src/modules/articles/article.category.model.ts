import { Schema, model, Document } from "mongoose";

export interface IArticleCategory extends Document {
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const articleCategorySchema = new Schema<IArticleCategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const articleCategoryModel = model<IArticleCategory>(
  "ArticleCategory",
  articleCategorySchema
);
