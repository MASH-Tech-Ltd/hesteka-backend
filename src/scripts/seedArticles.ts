import mongoose from "mongoose";
import dotenv from "dotenv";
import config from "../config";
import { articleModel } from "../modules/articles/article.models";

dotenv.config();

const dummyCategories = ["News", "Tips", "Community", "Updates", "Stories"];
const dummyTags = ["Pets", "Health", "Events", "Adoption", "Volunteering"];
const dummyAuthors = ["Team Hesteka", "Emma Fauveau", "Guest Writer", "Dr. Vet"];

const run = async () => {
  try {
    const mongoUrl = config.mongoUri || "mongodb://127.0.0.1:27017/hesteka";
    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB...");

    // Remove existing dummy articles to start fresh
    await articleModel.deleteMany({});
    console.log("Cleared existing articles...");

    const articlesToInsert = [];

    for (let i = 1; i <= 30; i++) {
      articlesToInsert.push({
        title: `Comprehensive Guide and Updates on Animal Welfare - Volume ${i}`,
        mainCategory: dummyCategories[Math.floor(Math.random() * dummyCategories.length)],
        tag: dummyTags[Math.floor(Math.random() * dummyTags.length)],
        author: dummyAuthors[Math.floor(Math.random() * dummyAuthors.length)],
        readTime: Math.floor(Math.random() * 15) + 5,
        isFeatured: i % 4 === 0, 
        isActive: true,
        image: {
          public_id: `dummy_image_high_res_${i}`,
          secure_url: `https://picsum.photos/seed/article${i}/1200/800`,
        },
        contentBlocks: [
          {
            type: "paragraph",
            title: "Introduction & Overview",
            content: "Welcome to our comprehensive overview of the latest developments in animal welfare and community initiatives. In this detailed edition, we explore the intricate challenges and profound triumphs our organization has experienced over the past few months. Animal rescue and support is not just a passing endeavor; it requires absolute dedication, strategic planning, and unwavering compassion from our volunteers, partners, and the broader community. Our mission has always been to bridge the gap between those who want to help and the vulnerable animals who desperately need it.",
          },
          {
            type: "paragraph",
            content: "As we look at the statistics from this quarter, the numbers tell a compelling story. We've seen a 40% increase in community engagement, which directly correlates with higher adoption rates and successful fundraising campaigns. However, with increased awareness comes the realization that the scale of the problem is vast. Urban expansion continues to encroach on natural habitats, leading to a rise in displaced wildlife, while economic pressures have unfortunately led to higher abandonment rates for domestic pets.",
          },
          {
            type: "callout",
            content: "Did you know? Every single contribution, whether it's volunteering your time for a weekend, donating supplies, or simply sharing our messages on social media, has a tangible, measurable impact on the lives of these animals.",
          },
          {
            type: "numbered_point",
            title: "The Importance of Community Support",
            content: "Firstly, grassroots community support forms the backbone of our operations. Without local heroes fostering animals, organizing local food drives, and educating their peers, our network would collapse. The power of community lies in its decentralized ability to respond quickly to emergencies.",
          },
          {
            type: "numbered_point",
            title: "Advancements in Veterinary Care",
            content: "Secondly, we must acknowledge the incredible advancements in veterinary medicine that our partner clinics bring to the table. From non-invasive surgical techniques to innovative rehabilitation therapies for injured wildlife, technology is dramatically improving survival rates and the quality of life for our rescues.",
          },
          {
            type: "paragraph",
            title: "Looking Ahead",
            content: "Moving forward, our strategic focus will shift towards preventative measures. We are launching several educational campaigns aimed at schools and local community centers to teach responsible pet ownership and wildlife conservation from a young age. By addressing the root causes of animal suffering through education and awareness, we hope to build a more compassionate society for generations to come. Thank you for your continued support and dedication to the cause.",
          }
        ]
      });
    }

    const res = await articleModel.insertMany(articlesToInsert);
    console.log(`Successfully seeded ${res.length} detailed articles!`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding detailed articles:", error);
    process.exit(1);
  }
};

run();
