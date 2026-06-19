import { Schema, model } from "mongoose";
import { IFaq, IFaqContent } from "./faq.interface";

const faqContentSchema = new Schema<IFaqContent>({
  question: {
    english: {
      question: { type: String, required: true },
      answer: { type: String, required: true }
    },
    french: {
      question: { type: String, required: true },
      answer: { type: String, required: true }
    }
  },
  order: { type: Number, default: 0 }
});

const faqSchema = new Schema<IFaq>(
  {
    category: { type: String, required: true, unique: true },
    contentsArray: {
      type: [faqContentSchema],
      required: true,
      default: []
    },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const faqModel = model<IFaq>("Faq", faqSchema);
