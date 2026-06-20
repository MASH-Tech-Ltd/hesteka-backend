import mongoose, { Model, Schema } from "mongoose";
import { ContactStatus, ContactType, IContact, CreationMethod } from "./contact.interface";

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(ContactType),
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    website: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    photo: {
      public_id: String,
      secure_url: String,
      _id: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    status: {
      type: String,
      enum: Object.values(ContactStatus),
      default: ContactStatus.ACTIVE,
    },
    creationMethod: {
      type: String,
      enum: Object.values(CreationMethod),
      default: CreationMethod.MANUAL,
    },
  },
  {
    timestamps: true,
  },
);

contactSchema.index({ type: 1, status: 1, name: 1 });
contactSchema.index({ name: "text", description: "text", address: "text" });
contactSchema.index({ location: "2dsphere" }, { sparse: true });

export const contactModel: Model<IContact> = mongoose.model<IContact>(
  "Contact",
  contactSchema,
);
