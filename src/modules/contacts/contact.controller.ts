import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { contactService } from "./contact.service";

export const createContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await contactService.createContact(req);
  ApiResponse.sendSuccess(res, 201, "Contact created successfully", contact);
});

export const bulkUploadContacts = asyncHandler(async (req: Request, res: Response) => {
  const result = await contactService.bulkUploadContacts(req);
  ApiResponse.sendSuccess(res, 201, "Bulk upload processed", result);
});

export const getAllContacts = asyncHandler(async (req: Request, res: Response) => {
  const { contacts, meta } = await contactService.getAllContacts(req);
  ApiResponse.sendSuccess(res, 200, "Contacts fetched successfully", contacts, meta);
});

export const getByContactType = asyncHandler(async (req: Request, res: Response) => {
  const { contacts, meta } = await contactService.getByContactType(req);
  ApiResponse.sendSuccess(res, 200, "Contacts fetched successfully", contacts, meta);
});

export const getContactById = asyncHandler(async (req: Request, res: Response) => {
  const contact = await contactService.getContactById(req.params.contactId as string);
  ApiResponse.sendSuccess(res, 200, "Contact fetched successfully", contact);
});

export const updateContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await contactService.updateContact(req);
  ApiResponse.sendSuccess(res, 200, "Contact updated successfully", contact);
});

export const deleteContact = asyncHandler(async (req: Request, res: Response) => {
  await contactService.deleteContact(req.params.contactId as string);
  ApiResponse.sendSuccess(res, 200, "Contact deleted successfully");
});

export const getContactStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await contactService.getContactStats();
  ApiResponse.sendSuccess(res, 200, "Contact stats fetched successfully", stats);
});

import { departments, regions, countries } from "../../utils/franceLocations";
export const getLocations = asyncHandler(async (req: Request, res: Response) => {
  ApiResponse.sendSuccess(res, 200, "Locations fetched successfully", { departments, regions, countries });
});
