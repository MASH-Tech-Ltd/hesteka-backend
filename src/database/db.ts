import mongoose from "mongoose";
import chalk from "chalk";
import dotenv from "dotenv";
import config from "../config";
dotenv.config();

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUrl = config.mongoUri;

    if (!mongoUrl) {
      throw new Error("MONGODB_URL is not defined in environment variables");
    }

    const dbinfo = await mongoose.connect(mongoUrl);

    console.log(
      chalk.yellow(`Database connection successful: ${dbinfo.connection.host}`),
    );

    // Safely drop the old non-sparse unique index on phone if it exists
    if (dbinfo.connection.db) {
      try {
        await dbinfo.connection.db.collection("users").dropIndex("phone_1");
        console.log(chalk.green("Successfully dropped old phone_1 index to resolve duplicate null phone error"));
      } catch (e: any) {
        console.log(chalk.blue("Note on phone_1 index drop (already dropped or not found):"), e.message);
      }
    }
  } catch (error) {
    console.error(chalk.red("Database connection failed!!"), error);
    process.exit(1); // stop app if DB fails
  }
};
