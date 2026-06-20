import mongoose from "mongoose";
import dotenv from "dotenv";
import { contactModel } from "../src/modules/contacts/contact.models";
import { CreationMethod } from "../src/modules/contacts/contact.interface";

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/hesteka";

const removeBulkData = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to database successfully.");

    console.log("Removing all contacts with creationMethod 'bulk'...");
    const result = await contactModel.deleteMany({ creationMethod: CreationMethod.BULK });

    console.log(`Removal complete!`);
    console.log(`Deleted documents: ${result.deletedCount}`);

  } catch (error) {
    console.error("Error removing data:", error);
  } finally {
    console.log("Disconnecting from database...");
    await mongoose.disconnect();
    process.exit(0);
  }
};

removeBulkData();
