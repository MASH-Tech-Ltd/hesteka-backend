import { z } from "zod";
import { ContactStatus, ContactType } from "./contact.interface";

// Validation helper that allows empty strings (for clearing fields) but validates if non-empty
const optionalUrl = z.union([
  z.string().url("Invalid website URL"),
  z.literal(""),
  z.undefined()
]);

const optionalEmail = z.union([
  z.string().email("Invalid email"),
  z.literal(""),
  z.undefined()
]);

const optionalString = z.string().optional().or(z.literal(""));

export const createContactSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(Object.values(ContactType) as [string, ...string[]]),
    description: optionalString,
    address: optionalString,
    phone: optionalString,
    email: optionalEmail,
    website: optionalUrl,
    city: optionalString,
    country: optionalString,
    region: optionalString,
    department: optionalString,
    latitude: z.preprocess((v) => (v === "" ? undefined : v ? Number(v) : undefined), z.number().min(-90).max(90).optional()),
    longitude: z.preprocess((v) => (v === "" ? undefined : v ? Number(v) : undefined), z.number().min(-180).max(180).optional()),
    status: z.enum(Object.values(ContactStatus) as [string, ...string[]]).optional().or(z.literal("")),
    image: z.any().optional(),
  })
  .strict();

export const updateContactSchema = createContactSchema.partial().strict();

export const contactValidation = {
  createContactSchema,
  updateContactSchema,
};
