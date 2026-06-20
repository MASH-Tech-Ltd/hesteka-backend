import { Router } from "express";
import { authGuard, allowRole, authGuardOptional } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  createContact,
  deleteContact,
  getAllContacts,
  getContactById,
  getByContactType,
  updateContact,
  getContactStats,
  getLocations,
} from "./contact.controller";
import { contactValidation } from "./contact.validation";

const router = Router();

router.get("/get-all-contacts", authGuardOptional, getAllContacts);
router.get("/get-by-type/:contactType", authGuardOptional, getByContactType);
router.get("/get-single-contact/:contactId", getContactById);
router.get("/stats", authGuardOptional, getContactStats);
router.get("/locations", getLocations);

router.use(authGuard, allowRole("admin"));

router.post(
  "/create-contact",
  upload.single("image"),
  validateRequest(contactValidation.createContactSchema),
  createContact,
);

router.post(
  "/bulk-upload",
  upload.single("file"),
  // Note: we can add validation for file presence if needed
  require("./contact.controller").bulkUploadContacts
);

router.patch(
  "/update-contact/:contactId",
  upload.single("image"),
  validateRequest(contactValidation.updateContactSchema),
  updateContact,
);

router.delete("/delete-contact/:contactId", deleteContact);

export const contactRoute = router;
