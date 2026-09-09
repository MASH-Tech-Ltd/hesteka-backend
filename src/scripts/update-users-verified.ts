import dotenv from "dotenv";
import { connectDatabase } from "../database/db";
import { userModel } from "../modules/usersAuth/user.models";
import { authProvider } from "../modules/usersAuth/user.interface";

dotenv.config();

async function run() {
  try {
    console.log("Connecting to the database...");
    await connectDatabase();
    console.log("Connected.");

    // Update local provider users to isVerified: false
    const localResult = await userModel.updateMany(
      { provider: authProvider.LOCAL },
      { $set: { isVerified: false } }
    );
    console.log(`Updated ${localResult.modifiedCount} local provider users to isVerified: false`);

    // // Update google and apple provider users to isVerified: true
    // const socialResult = await userModel.updateMany(
    //   { provider: { $in: [authProvider.GOOGLE, authProvider.APPLE] } },
    //   { $set: { isVerified: true } }
    // );
    // console.log(`Updated ${socialResult.modifiedCount} google/apple provider users to isVerified: true`);

    console.log("Successfully updated users.");
    process.exit(0);
  } catch (error) {
    console.error("Error updating users:", error);
    process.exit(1);
  }
}

run();

// !script
//     npx ts-node src/scripts/update-users-verified.ts


// in contscts if bulk upload then must be update fields if found like department and region. only update  the new firlds only dontn create again.