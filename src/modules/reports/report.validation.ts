import { z } from "zod";
import { ReportStatus, AnimalAge, AnimalGender, YesNoUnknown } from "./report.interface";

const locationSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .array(z.number())
    .length(2, "Coordinates must contain exactly [longitude, latitude]")
    .refine(
      ([lng, lat]) => !(lng === 0 && lat === 0),
      { message: "Must be a valid location" }
    ),
  address: z.string().min(1, "Address is required"),
});

export const createReportSchema = z
  .object({
    animalName: z.string().min(1, "Animal name is required"),
    title: z.string().optional(),
    myAnimalId: z.string().min(1).optional(),
    species: z.string().min(1, "Species is required"),
    breed: z.string().min(1, "Breed is required"),
    gender: z.enum(Object.values(AnimalGender) as [string, ...string[]]),
    age: z.enum(Object.values(AnimalAge) as [string, ...string[]]),
    status: z.enum(Object.values(ReportStatus) as [string, ...string[]]),
    eventDate: z.string().datetime({ message: "Invalid ISO datetime format" }),
    description: z.string().min(1, "Description is required").refine(
      (val) => val.trim().split(/\s+/).length <= 500,
      { message: "Description cannot exceed 500 words" }
    ),
    hasMicrochip: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]),
    hasTattoo: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]),
    hasCollarOrHarness: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]),
    isSterilized: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]).optional(),
    contactPhone: z.string().optional(),
    isPhoneVisible: z.preprocess(
      (val) => (val === "true" || val === true ? true : val === "false" || val === false ? false : val),
      z.boolean()
    ).default(false),
    contactEmail: z.string().email("Invalid email").optional(),
    isEmailVisible: z.preprocess(
      (val) => (val === "true" || val === true ? true : val === "false" || val === false ? false : val),
      z.boolean({
        message: "Accept only boolean value",
      })
    )
      .optional()
      .default(false),
    location: z.preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch (e) {
          return val;
        }
      }
      return val;
    }, locationSchema),
    images: z.any().optional(),
  })
  .strict();

export const updateReportSchema = createReportSchema.partial().strict();