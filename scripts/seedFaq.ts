import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { faqModel } from "../src/modules/faq/faq.models";
import config from "../src/config";

mongoose.set("bufferCommands", false);

const seedFaq = async () => {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(config.mongoUri as string);
        console.log("MongoDB connected ✅");

        // 2. Read CSV file
        const csvPath = path.resolve(__dirname, "../../faq_content.csv");
        const fileContent = fs.readFileSync(csvPath, "utf-8");

        const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== "");
        // Skip header
        const dataLines = lines.slice(1);

        const categories: Record<string, any[]> = {};
        let currentItem: any = null;

        for (const line of dataLines) {
            const parts = line.split(",");
            if (parts.length < 4) continue;

            const category = parts[0]!.trim();
            const language = parts[1]!.trim();
            const question = parts[2]!.trim();
            // In case there are commas in the answer, join the rest
            const answer = parts.slice(3).join(",").trim();

            if (language === "en") {
                currentItem = {
                    question: {
                        english: { question, answer }
                    }
                };
            } else if (language === "fr" && currentItem) {
                currentItem.question.french = { question, answer };
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(currentItem);
                currentItem = null; // Reset for the next pair
            }
        }

        console.log("Parsed categories:", Object.keys(categories));

        // 3. Clear existing FAQs
        await faqModel.deleteMany({});
        console.log("Cleared existing FAQs 🗑️");

        // 4. Insert new FAQs
        const insertPromises = Object.entries(categories).map(([category, contentsArray], index) => {
            return faqModel.create({
                category,
                contentsArray,
                isActive: true,
                order: index
            });
        });

        await Promise.all(insertPromises);
        console.log("Successfully inserted new FAQs ✅");

        await mongoose.disconnect();
        console.log("MongoDB disconnected");
        process.exit(0);
    } catch (error: any) {
        console.error("Seeder Error:", error.message || error);
        process.exit(1);
    }
};

seedFaq();
