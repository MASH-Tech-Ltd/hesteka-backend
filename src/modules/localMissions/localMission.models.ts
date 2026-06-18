import mongoose, { Model, Schema } from "mongoose";
import { ILocalMission, LocalMissionStatus } from "./localMission.interface";

const localMissionSchema = new Schema<ILocalMission>(
  {
    partner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
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
    duration: {
      type: String,
      required: true,
      trim: true,
    },
    points: {
      type: Number,
      min: 0,
      default: 0,
    },
    photo: {
      public_id: String,
      secure_url: String,
      _id: false,
    },
    status: {
      type: String,
      enum: Object.values(LocalMissionStatus),
      default: LocalMissionStatus.ACTIVE,
    },
    missionDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

localMissionSchema.index({ partner: 1, createdAt: -1 });
localMissionSchema.index({ status: 1, createdAt: -1 });
localMissionSchema.index({ location: "2dsphere" }, { sparse: true });

export const localMissionModel: Model<ILocalMission> = mongoose.model<ILocalMission>(
  "LocalMission",
  localMissionSchema,
);
