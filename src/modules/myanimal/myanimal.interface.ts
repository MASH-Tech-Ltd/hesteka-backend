import { Document, Types } from "mongoose";
import {
  AnimalAge,
  AnimalGender,
  AnimalSpecies,
  YesNoUnknown,
} from "../reports/report.interface";

export enum MyanimalStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface IMyanimal extends Document {
  user: Types.ObjectId;
  title: string;
  description: string;
  species: string;
  breed: string;
  gender: AnimalGender;
  age: AnimalAge;
  hasMicrochip: YesNoUnknown;
  hasTattoo: YesNoUnknown;
  hasCollarOrHarness: YesNoUnknown;
  photo?: {
    public_id: string;
    secure_url: string;
  };
  status: MyanimalStatus;
  slug: string;
}

export interface CreateMyanimalPayload {
  title: string;
  description: string;
  species: string;
  breed: string;
  gender: AnimalGender;
  age: AnimalAge;
  hasMicrochip: YesNoUnknown;
  hasTattoo: YesNoUnknown;
  hasCollarOrHarness: YesNoUnknown;
  status?: MyanimalStatus;
}

export interface UpdateMyanimalPayload {
  title?: string;
  description?: string;
  species?: string;
  breed?: string;
  gender?: AnimalGender;
  age?: AnimalAge;
  hasMicrochip?: YesNoUnknown;
  hasTattoo?: YesNoUnknown;
  hasCollarOrHarness?: YesNoUnknown;
  status?: MyanimalStatus;
}
