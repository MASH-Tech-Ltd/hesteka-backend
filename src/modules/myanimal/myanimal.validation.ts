import { z } from "zod";
import { MyanimalStatus } from "./myanimal.interface";
import {
  AnimalAge,
  AnimalGender,
  AnimalSpecies,
  YesNoUnknown,
} from "../reports/report.interface";

export const createMyanimalSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().min(1, "Description is required").max(1000),
  species: z.string().min(1, "Species is required"),
  breed: z.string().min(1, "Breed is required").max(100),
  gender: z.enum(Object.values(AnimalGender) as [string, ...string[]]),
  age: z.enum(Object.values(AnimalAge) as [string, ...string[]]),
  hasMicrochip: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]),
  hasTattoo: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]),
  hasCollarOrHarness: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]),
  status: z.enum([MyanimalStatus.ACTIVE, MyanimalStatus.INACTIVE]).optional(),
});

export const updateMyanimalSchema = z.object({
  title: z.string().min(1, "Title is required").max(100).optional(),
  description: z.string().min(1, "Description is required").max(1000).optional(),
  species: z.string().min(1, "Species is required").optional(),
  breed: z.string().min(1, "Breed is required").max(100).optional(),
  gender: z.enum(Object.values(AnimalGender) as [string, ...string[]]).optional(),
  age: z.enum(Object.values(AnimalAge) as [string, ...string[]]).optional(),
  hasMicrochip: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]).optional(),
  hasTattoo: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]).optional(),
  hasCollarOrHarness: z.enum(Object.values(YesNoUnknown) as [string, ...string[]]).optional(),
  status: z.enum([MyanimalStatus.ACTIVE, MyanimalStatus.INACTIVE]).optional(),
});

