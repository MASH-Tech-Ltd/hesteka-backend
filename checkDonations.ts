import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { donationModel } from "./src/modules/donation/donation.models";

dotenv.config({ path: path.join(__dirname, ".env") });

const checkDonations = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    const stats = await donationModel.aggregate([
      { $group: { _id: "$method", count: { $sum: 1 }, total: { $sum: "$amount" } } }
    ]);
    console.log("Donation stats by method:", JSON.stringify(stats, null, 2));
    
    // Also check payment population
    const payments = await donationModel.find().populate("payment").lean();
    console.log(`Total donations: ${payments.length}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
checkDonations();
