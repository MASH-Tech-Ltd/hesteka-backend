import mongoose, { Schema } from "mongoose";
import slugify from "slugify";
import CustomError from "../../helpers/CustomError";
import { IMyanimal, MyanimalStatus } from "./myanimal.interface";
import {
  AnimalAge,
  AnimalGender,
  AnimalSpecies,
  YesNoUnknown,
} from "../reports/report.interface";

const myanimalSchema = new Schema<IMyanimal>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    species: {
      type: String,
      required: true,
    },
    breed: { type: String, required: true, trim: true },
    gender: {
      type: String,
      enum: Object.values(AnimalGender),
      required: true,
    },
    age: {
      type: String,
      enum: Object.values(AnimalAge),
      required: true,
      default: AnimalAge.ADULT,
    },
    hasMicrochip: {
      type: String,
      enum: Object.values(YesNoUnknown),
      required: true,
      default: YesNoUnknown.UNKNOWN,
    },
    hasTattoo: {
      type: String,
      enum: Object.values(YesNoUnknown),
      required: true,
      default: YesNoUnknown.UNKNOWN,
    },
    hasCollarOrHarness: {
      type: String,
      enum: Object.values(YesNoUnknown),
      required: true,
      default: YesNoUnknown.UNKNOWN,
    },
    photo: {
      public_id: { type: String },
      secure_url: { type: String },
    },
    status: {
      type: String,
      enum: Object.values(MyanimalStatus),
      default: MyanimalStatus.ACTIVE,
    },
    slug: { type: String },
  },
  { timestamps: true }
);

// Generate slug before save
myanimalSchema.pre("save", async function () {
  if (!this.isModified("title")) return;

  const existing = await (this.constructor as any).findOne({ title: this.title });
  if (existing) {
    throw new CustomError(400, "Animal with this title already exists");
  }

  this.slug = slugify(this.title, {
    lower: true,
    strict: true,
    trim: true,
  });
});

// Generate slug on update
myanimalSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() as any;

  if (update?.title) {
    const existing = await (this.model as any).findOne({ title: update.title });
    if (existing && existing._id.toString() !== this.getQuery()._id.toString()) {
      throw new CustomError(400, "Animal with this title already exists");
    }

    update.slug = slugify(update.title, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
});

export const myanimalModel = mongoose.model<IMyanimal>("Myanimal", myanimalSchema);
