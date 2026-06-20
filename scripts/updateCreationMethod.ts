import mongoose from "mongoose";
import dotenv from "dotenv";
import { contactModel } from "../src/modules/contacts/contact.models";
import { CreationMethod } from "../src/modules/contacts/contact.interface";

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/hesteka";

const updatePreviousData = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to database successfully.");

    console.log("Updating contacts where creationMethod is not 'bulk'...");
    const result = await contactModel.updateMany(
      { creationMethod: { $ne: CreationMethod.BULK } },
      { $set: { creationMethod: CreationMethod.MANUAL } }
    );

    console.log(`Update complete!`);
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);

  } catch (error) {
    console.error("Error updating data:", error);
  } finally {
    console.log("Disconnecting from database...");
    await mongoose.disconnect();
    process.exit(0);
  }
};

updatePreviousData();
