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
  category: {
    english: string;
    french: string;
  };
  image: {
    publicId: string;
    secureUrl: string;
  };
  contentsArray: IFaqContent[];
  order: number;
  isActive: boolean;
}
