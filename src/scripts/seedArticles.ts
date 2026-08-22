import mongoose from "mongoose";
import dotenv from "dotenv";
import config from "../config";
import { articleModel } from "../modules/articles/article.models";
import { articleCategoryModel } from "../modules/articles/article.category.model";

dotenv.config();

// ─── Seed Data ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "News",
  "Tips & Advice",
  "Community",
  "Health & Wellness",
  "Stories",
  "Adoption",
  "Volunteering",
];

const dummyTags = ["Pets", "Health", "Events", "Adoption", "Volunteering", "Wildlife", "Rescue"];
const dummyAuthors = ["Team Hesteka", "Emma Fauveau", "Guest Writer", "Dr. Vet", "Sarah Mitchell"];

/**
 * Build content blocks for each article — varied per index for realism.
 */
const makeContentBlocks = (i: number, category: string) => [
  {
    type: "paragraph",
    title: "Introduction & Overview",
    content: `Welcome to this ${category} article — edition #${i}. Animal rescue and support requires absolute dedication, strategic planning, and unwavering compassion from our volunteers, partners, and the broader community. Our mission has always been to bridge the gap between those who want to help and the vulnerable animals who desperately need it.`,
  },
  {
    type: "paragraph",
    content: `This quarter we've seen a ${20 + i}% increase in community engagement in the ${category} space, which directly correlates with higher adoption rates and successful fundraising campaigns. Urban expansion continues to encroach on natural habitats, while economic pressures have led to higher abandonment rates for domestic pets.`,
  },
  {
    type: "callout",
    content: `Did you know? Every single contribution — whether it's volunteering your weekend, donating supplies, or sharing our ${category.toLowerCase()} posts on social media — has a tangible, measurable impact on the lives of these animals.`,
  },
  {
    type: "numbered_point",
    title: "The Importance of Community Support",
    content: `Grassroots community support forms the backbone of our ${category} operations. Without local heroes fostering animals, organising food drives, and educating their peers, our network would collapse. The power of community lies in its decentralised ability to respond quickly to emergencies.`,
  },
  {
    type: "numbered_point",
    title: "Advancements in Veterinary Care",
    content: `Innovative rehabilitation therapies for injured wildlife and non-invasive surgical techniques are dramatically improving survival rates in the ${category} domain. Technology is transforming how we care for our rescues.`,
  },
  {
    type: "paragraph",
    title: "Looking Ahead",
    content: `Moving forward, our strategic focus in ${category} will shift towards preventative measures. We are launching educational campaigns aimed at schools and local community centres to teach responsible pet ownership and wildlife conservation from a young age. Thank you for your continued support.`,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

const run = async () => {
  try {
    const mongoUrl = config.mongoUri || "mongodb://127.0.0.1:27017/hesteka";
    await mongoose.connect(mongoUrl);
    console.log("✅ Connected to MongoDB");

    // ── Step 1: Clear existing articles and categories ──────────────────────
    await articleModel.deleteMany({});
    await articleCategoryModel.deleteMany({});
    console.log("🗑️  Cleared existing articles and categories");

    // ── Step 2: Create categories first ────────────────────────────────────
    const categoryDocs = await articleCategoryModel.insertMany(
      CATEGORIES.map((name) => ({ name, isActive: true }))
    );
    console.log(`📁 Seeded ${categoryDocs.length} categories:`);
    categoryDocs.forEach((c) => console.log(`   • ${c.name}  (_id: ${c._id})`));

    // ── Step 3: Build articles based on those category names ────────────────
    const articlesToInsert = [];
    let articleIndex = 1;

    // Guarantee at least 3 articles per category for good home-page coverage
    for (const category of CATEGORIES) {
      const articlesForCategory = 4; // 4 per category = 28 total (1 featured per cat)
      for (let j = 0; j < articlesForCategory; j++) {
        articlesToInsert.push({
          title: `${category} — Comprehensive Guide Volume ${articleIndex}`,
          mainCategory: category, // string value from CATEGORIES array
          tag: dummyTags[articleIndex % dummyTags.length],
          author: dummyAuthors[articleIndex % dummyAuthors.length],
          readTime: Math.floor(Math.random() * 10) + 3,
          isFeatured: j === 0, // first article in each category is featured
          isActive: true,
          externalLink: j % 2 === 0 ? "https://example.com/external-resource" : "", // some articles get a link
          image: {
            public_id: `dummy_article_${articleIndex}`,
            secure_url: `https://picsum.photos/seed/article${articleIndex}/1200/800`,
          },
          contentBlocks: makeContentBlocks(articleIndex, category),
        });
        articleIndex++;
      }
    }

    // Use category name string (string field, not ObjectId reference)
    const inserted = await articleModel.insertMany(
      articlesToInsert.map((a) => ({
        ...a,
        mainCategory: typeof a.mainCategory === "string" ? a.mainCategory : String(a.mainCategory),
      }))
    );

    console.log(`\n📰 Seeded ${inserted.length} articles across ${CATEGORIES.length} categories`);
    console.log("\nSummary:");
    for (const cat of CATEGORIES) {
      const count = inserted.filter((a) => a.mainCategory === cat).length;
      console.log(`   • ${cat}: ${count} articles`);
    }

    console.log("\n✅ Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding:", error);
    process.exit(1);
  }
};

run();
