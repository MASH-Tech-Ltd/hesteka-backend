import mongoose, { Schema, Model } from "mongoose";
import { AnimalAge, AnimalGender, AnimalSpecies, IReport, ReportStatus, YesNoUnknown } from "./report.interface";
export {
  IReport,
  ReportStatus,
  AnimalSpecies,
  AnimalAge,
  AnimalGender,
  YesNoUnknown,
} from "./report.interface";

const reportSchema = new Schema<IReport>(
  {
    animalName: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sourceAnimal: {
      type: Schema.Types.ObjectId,
      ref: "Myanimal",
    },
    species: {
      type: String,
      required: true,
    },
    breed: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: Object.values(AnimalGender),
      required: true,
    },
    age: {
      type: String,
      enum: Object.values(AnimalAge),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: [
      {
        public_id: { type: String, required: true },
        secure_url: { type: String, required: true },
        source: {
          type: String,
          enum: ["reportUpload", "myAnimalPhoto"],
          default: "reportUpload",
        },
        ownedByReport: {
          type: Boolean,
          default: true,
        },
      }
    ],
    hasMicrochip: {
      type: String,
      enum: Object.values(YesNoUnknown),
      required: true,
    },
    hasTattoo: {
      type: String,
      enum: Object.values(YesNoUnknown),
      required: true,
    },
    hasCollarOrHarness: {
      type: String,
      enum: Object.values(YesNoUnknown),
      required: true,
    },
    contactPhone: {
      type: String,
    },
    isPhoneVisible: {
      type: Boolean,
      default: false,
    },
    contactEmail: {
      type: String,
    },
    isEmailVisible: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    isPointApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create a 2dsphere index for geospatial queries
reportSchema.index({ location: "2dsphere" });

export const reportModel: Model<IReport> = mongoose.model<IReport>(
  "Report",
  reportSchema
);
