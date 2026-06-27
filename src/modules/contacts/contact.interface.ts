import { Document } from "mongoose";

export enum ContactType {
  SHELTER = "shelter",
  VETERINARIAN = "veterinarian",
  CSFS = "CSFS",
  PARTNER = "partner",
}

export enum ContactStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum CreationMethod {
  MANUAL = "manual",
  BULK = "bulk",
}

export interface IContact extends Document {
  name: string;
  type: ContactType;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  country?: string;
  region?: string;
  department?: string;
  photo?: {
    public_id: string;
    secure_url: string;
  };
  location?: {
    type: string;
    coordinates: number[];
  };
  status: ContactStatus;
  creationMethod: CreationMethod;
}

export interface CreateContactPayload {
  name: string;
  type: ContactType;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  country?: string;
  region?: string;
  department?: string;
  latitude?: number;
  longitude?: number;
  status?: ContactStatus;
  creationMethod?: CreationMethod;
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> { }
