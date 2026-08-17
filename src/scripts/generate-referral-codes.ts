import dotenv from "dotenv";
import { connectDatabase } from "../database/db";
import { userModel } from "../modules/usersAuth/user.models";

dotenv.config();

async function generateReferralCode(firstName: string): Promise<string> {
  const base = firstName.replace(/\s+/g, "").toUpperCase();
  let code = "";
  let isUnique = false;
  while (!isUnique) {
    code = base + Math.floor(1000 + Math.random() * 9000);
    const existing = await userModel.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}

async function run() {
  try {
    console.log("Connecting to the database...");
    await connectDatabase();
    console.log("Connected.");

    // Find users without a referral code
    const users = await userModel.find({ 
        $or: [
            { referralCode: { $exists: false } }, 
            { referralCode: "" }, 
            { referralCode: null }
        ] 
    });
    
    console.log(`Found ${users.length} users without a referral code.`);

    let successCount = 0;
    for (const user of users) {
      try {
        const firstName = user.firstName || "USER";
        const code = await generateReferralCode(firstName);
        user.referralCode = code;
        await user.save();
        console.log(`Generated referral code ${code} for user ${user._id} (name: ${firstName})`);
        successCount++;
      } catch (err) {
        console.error(`Failed to generate code for user ${user._id}:`, err);
      }
    }

    console.log(`Finished generating referral codes. Successfully updated ${successCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error("Error generating referral codes:", error);
    process.exit(1);
  }
}

run();

// !script
//     npx ts-node src/scripts/generate-referral-codes.ts

