import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { donationModel } from "./src/modules/donation/donation.models";

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

const deletePendingDonations = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MONGO_URI is not defined in your .env file!");
    }

    console.log("Connecting to the database...");
    await mongoose.connect(uri);
    console.log("Connected successfully!");

    console.log("Searching and deleting pending donations...");
    // Delete all donations where status is "pending"
    const result = await donationModel.deleteMany({ status: "pending" });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} pending donations!`);
    
    // Disconnect and exit
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting pending donations:", error);
    process.exit(1);
  }
};

deletePendingDonations();


// run command >> npx ts-node deletePendingDonations.ts
