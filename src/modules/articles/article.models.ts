import { Schema, model } from "mongoose";
import { IArticle } from "./article.interface";

const articleSchema = new Schema<IArticle>(
  {
    title: {
      type: String,
      required: true,
    },
    mainCategory: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
      default: "Team Hesteka",
    },
    readTime: {
      type: Number,
      required: true,
      default: 2,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    image: {
      public_id: { type: String },
      secure_url: { type: String },
    },
    contentBlocks: [
      {
        type: {
          type: String,
          enum: ["paragraph", "numbered_point", "callout"],
          required: true,
        },
        title: { type: String },
        content: { type: String, required: true },
        sourceUrl: { type: String },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const articleModel = model<IArticle>("Article", articleSchema);
