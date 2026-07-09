import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { donationModel } from "./src/modules/donation/donation.models";

dotenv.config({ path: path.join(__dirname, ".env") });

const deleteCollectionPointDonations = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not defined");

    console.log("Connecting to the database...");
    await mongoose.connect(uri);
    
    console.log("Deleting old collection_point donations from the Donations table...");
    const result = await donationModel.deleteMany({ method: "collection_point" });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} collection_point donations!`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

deleteCollectionPointDonations();
