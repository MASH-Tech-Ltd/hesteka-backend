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
    category: {
      english: { type: String, required: true },
      french: { type: String, required: true }
    },
    image: {
      publicId: { type: String },
      secureUrl: { type: String }
    },
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
