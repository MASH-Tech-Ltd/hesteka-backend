import mongoose, { Model, Schema } from "mongoose";
import { IDonation, DonationType } from "./donation.interface";

const donationSchema = new Schema<IDonation>(
  {
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: false,
    },
    method: {
      type: String,
      enum: ["stripe", "paypal", "collection_point"],
      default: "stripe",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: Object.values(DonationType),
      required: true,
    },
    donorEmail: {
      type: String,
      required: true,
    },
    donorName: {
      type: String,
      required: true,
    },
    isCompanyDonation: {
      type: Boolean,
      default: false,
    },
    companyInfo: {
      name: { type: String },
      siren: { type: String },
      legalForm: { type: String },
      _id: false,
    },
    referenceId: {
      type: String, // ID of the DonationProof for collection_point
      unique: true,
      sparse: true,
    },
    receiptId: {
      type: String,
      unique: true,
      // required: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

donationSchema.index({ donorEmail: 1 });
donationSchema.index({ type: 1 });
donationSchema.index({ payment: 1 }, { unique: true, sparse: true });
donationSchema.index({ createdAt: -1 });
// TTL index to automatically delete "pending" donations after 30 days (2592000 seconds)
donationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000, partialFilterExpression: { status: "pending" } }
);
export const donationModel: Model<IDonation> = mongoose.model<IDonation>(
  "Donation",
  donationSchema,
);
