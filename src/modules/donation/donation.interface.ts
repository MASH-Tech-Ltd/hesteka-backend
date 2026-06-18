import { Document, Types } from "mongoose";

export enum DonationType {
  ONE_TIME = "one-time",
  MONTHLY = "monthly",
}

export interface IDonationCompanyInfo {
  name: string;
  siren: string;
  legalForm: string;
}

export interface IDonation extends Document {
  payment?: Types.ObjectId;
  method: "stripe" | "paypal" | "collection_point";
  amount: number;
  type: DonationType;
  donorEmail: string;
  donorName: string;
  isCompanyDonation: boolean | null;
  companyInfo?: IDonationCompanyInfo | null;
  referenceId?: string;
  status: "pending" | "completed" | "cancelled";
  receiptId: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDonationPayload {
  amount: number;
  type: DonationType;
  donorEmail: string;
  donorName: string;
  isCompanyDonation?: boolean | null;
  companyInfo?: IDonationCompanyInfo | null;
  payerEmail: string;
  payerName: string;
  userId?: string | null;
}

export interface CreateDonationFromPaymentPayload {
  paymentId: Types.ObjectId;
  amount: number;
  donorEmail: string;
  donorName: string;
  type?: DonationType;
  isCompanyDonation?: boolean;
  companyInfo?: IDonationCompanyInfo;
}
