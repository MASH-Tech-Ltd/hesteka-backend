import { Router } from "express";
import { authGuard, allowRole, authGuardOptional } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { contentLimiter } from "../../middleware/rateLimiter.middleware";
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

router.get("/get-all-contacts", contentLimiter, authGuardOptional, getAllContacts);
router.get("/get-by-type/:contactType", contentLimiter, authGuardOptional, getByContactType);
router.get("/get-single-contact/:contactId", contentLimiter, getContactById);
router.get("/stats", contentLimiter, authGuardOptional, getContactStats);
router.get("/locations", contentLimiter, getLocations);

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
