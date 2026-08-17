import { Document } from "mongoose";

export enum BlockType {
  PARAGRAPH = "paragraph",
  NUMBERED_POINT = "numbered_point",
  CALLOUT = "callout",
}

export interface IContentBlock {
  type: BlockType;
  title?: string;
  content: string;
  sourceUrl?: string;
}

export interface IArticle extends Document {
  title: string;
  mainCategory: string; // e.g., "Advice", "News", "Health"
  tag: string; // e.g., "HYDRATION", "HAZARD"
  author: string; // e.g., "Team Hesteka"
  readTime: number; // in minutes
  isFeatured: boolean;
  image?: {
    public_id: string;
    secure_url: string;
  };
  contentBlocks: IContentBlock[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArticlePayload {
  title: string;
  mainCategory: string;
  tag: string;
  author: string;
  readTime: number | string;
  isFeatured?: boolean;
  contentBlocks: string | IContentBlock[];
  isActive?: boolean;
}

export interface UpdateArticlePayload extends Partial<CreateArticlePayload> {}
