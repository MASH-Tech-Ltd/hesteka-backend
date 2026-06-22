import { z } from "zod";
import { DonationCategory, RefusalReason } from "./donationProof.interface";

export const submitDonationProofSchema = z.object({
  amount: z.preprocess((val) => val !== undefined ? Number(val) : undefined, z.number().min(0, "Amount must be positive").optional()),
  quantity: z.preprocess((val) => val !== undefined ? Number(val) : undefined, z.number().min(0, "Quantity must be positive").optional()),
  collectionPointId: z.string().min(1, "Collection point ID is required"),
  category: z.nativeEnum(DonationCategory, {
    error: `Category must be one of: ${Object.values(DonationCategory).join(", ")}`,
  }),
  donorName: z.string().optional(),
  donorEmail: z.string().email("Invalid email").optional(),
}).refine(data => data.amount !== undefined || data.quantity !== undefined, {
  message: "Either amount or quantity must be provided",
});

export const validateDonationProofSchema = z.object({
  pointsAwarded: z.number().min(0, "Points must be positive"),
  adminNote: z.string().optional(),
  amount: z.number().min(0, "Amount must be positive").optional(),
});

export const rejectDonationProofSchema = z.object({
  refusalReason: z.nativeEnum(RefusalReason, {
    error: `Refusal reason must be one of: ${Object.values(RefusalReason).join(", ")}`,
  }).optional(),
  adminNote: z.string().optional(),
}).refine(data => data.refusalReason || data.adminNote, {
  message: "Either refusalReason or adminNote must be provided",
});
