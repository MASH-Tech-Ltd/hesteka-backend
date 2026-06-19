import { Document } from "mongoose";

export interface IFaqContent {
  question: {
    english: {
      question: string;
      answer: string;
    };
    french: {
      question: string;
      answer: string;
    };
  };
  order: number;
}

export interface IFaq extends Document {
  category: string;
  contentsArray: IFaqContent[];
  order: number;
  isActive: boolean;
}
