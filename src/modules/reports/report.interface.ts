import { Document, Types } from "mongoose";

export enum ReportStatus {
  LOST = "lost",
  FOUND = "found",
  RESCUED = "rescued",
  SIGHTED = "sighted",
}

export enum AnimalSpecies {
  DOG = "Dog",
  CAT = "Cat",
  BIRD = "Bird",
  OTHER = "Other",
}

export enum AnimalAge {
  JUNIOR = "Junior",
  ADULT = "Adult",
  SENIOR = "Senior",
}

export enum AnimalGender {
  MALE = "Male",
  FEMALE = "Female",
}

export enum YesNoUnknown {
  YES = "Yes",
  NO = "No",
  UNKNOWN = "Unknown",
}

export interface ILocation {
  type: "Point";
  coordinates: number[]; // [longitude, latitude]
  address: string;
}

export interface IReport extends Document {
  animalName: string;
  title: string;
  author: Types.ObjectId | string;
  sourceAnimal?: Types.ObjectId | string;
  species: string;
  breed: string;
  gender: AnimalGender;
  age: AnimalAge;
  status: ReportStatus;
  eventDate: Date;
  description: string;
  images: {
    public_id: string;
    secure_url: string;
    source?: "reportUpload" | "myAnimalPhoto";
    ownedByReport?: boolean;
  }[];
  hasMicrochip: YesNoUnknown;
  hasTattoo: YesNoUnknown;
  hasCollarOrHarness: YesNoUnknown;
  contactPhone?: string;
  isPhoneVisible: boolean;
  contactEmail?: string;
  isEmailVisible: boolean;
  location: ILocation;
  comments: (Types.ObjectId | string)[];
  isPointApproved: boolean;
}

export interface CreateReportPayload {
  animalName: string;
  title?: string;
  species: string;
  myAnimalId?: string;
  breed: string;
  gender: string;
  age: string;
  status: string;
  eventDate: string;
  description: string;
  images: {
    public_id: string;
    secure_url: string;
    source?: "reportUpload" | "myAnimalPhoto";
    ownedByReport?: boolean;
  }[];
  hasMicrochip: string;
  hasTattoo: string;
  hasCollarOrHarness: string;
  contactPhone?: string;
  isPhoneVisible: boolean;
  contactEmail?: string;
  isEmailVisible: boolean;
  location: {
    type: "Point",
    coordinates: number[];
    address: string;
  };
}

export interface UpdateReportPayload extends Partial<CreateReportPayload> {}
