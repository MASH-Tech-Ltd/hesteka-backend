import mongoose from "mongoose";
import dotenv from "dotenv";
import config from "../config";
import { articleModel } from "../modules/articles/article.models";
import { articleCategoryModel } from "../modules/articles/article.category.model";

dotenv.config();

// ─── Seed Data ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Actualités",
  "Conseils & Astuces",
  "Communauté",
  "Santé & Bien-être",
  "Histoires"
];

const dummyTags = ["Animaux", "Santé", "Événements", "Adoption", "Bénévolat", "Faune", "Sauvetage"];
const dummyAuthors = ["Équipe Hesteka", "Emma Fauveau", "Rédacteur Invité", "Dr. Vétérinaire", "Sarah Mitchell"];

/**
 * Build content blocks for each article — varied per index for realism.
 */
const makeContentBlocks = (i: number, category: string) => [
  {
    type: "paragraph",
    title: "Introduction et Aperçu",
    content: `Bienvenue dans cet article sur ${category} — édition n°${i}. Le sauvetage et le soutien aux animaux exigent un dévouement absolu, une planification stratégique et une compassion inébranlable de la part de nos bénévoles, partenaires et de la communauté au sens large. Notre mission a toujours été de combler le fossé entre ceux qui veulent aider et les animaux vulnérables qui en ont désespérément besoin.`,
  },
  {
    type: "paragraph",
    content: `Ce trimestre, nous avons constaté une augmentation de ${20 + i}% de l'engagement communautaire dans le domaine ${category}, ce qui est directement corrélé à des taux d'adoption plus élevés et à des campagnes de collecte de fonds fructueuses. L'expansion urbaine continue d'empiéter sur les habitats naturels, tandis que les pressions économiques ont entraîné des taux d'abandon plus élevés pour les animaux de compagnie.`,
  },
  {
    type: "callout",
    content: `Le saviez-vous ? Chaque contribution — qu'il s'agisse de faire du bénévolat le week-end, de donner des fournitures ou de partager nos publications sur ${category.toLowerCase()} sur les réseaux sociaux — a un impact tangible et mesurable sur la vie de ces animaux.`,
  },
  {
    type: "numbered_point",
    title: "L'importance du Soutien Communautaire",
    content: `Le soutien de la communauté de base constitue l'épine dorsale de nos opérations en matière de ${category}. Sans les héros locaux qui accueillent des animaux, organisent des collectes de nourriture et éduquent leurs pairs, notre réseau s'effondrerait. Le pouvoir de la communauté réside dans sa capacité décentralisée à réagir rapidement aux situations d'urgence.`,
  },
  {
    type: "numbered_point",
    title: "Progrès des Soins Vétérinaires",
    content: `Des thérapies de rééducation innovantes pour la faune sauvage blessée et des techniques chirurgicales non invasives améliorent considérablement les taux de survie dans le domaine ${category}. La technologie transforme la façon dont nous prenons soin de nos rescapés.`,
  },
  {
    type: "paragraph",
    title: "Perspectives d'Avenir",
    content: `À l'avenir, notre orientation stratégique en matière de ${category} se déplacera vers des mesures préventives. Nous lançons des campagnes de sensibilisation destinées aux écoles et aux centres communautaires locaux pour enseigner dès le plus jeune âge la possession responsable d'animaux de compagnie et la conservation de la faune. Merci pour votre soutien continu.`,
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

    // 2 articles per category = 10 total
    for (const category of CATEGORIES) {
      const articlesForCategory = 2; 
      for (let j = 0; j < articlesForCategory; j++) {
        articlesToInsert.push({
          title: `${category} — Guide Complet Volume ${articleIndex}`,
          mainCategory: category, // string value from CATEGORIES array
          tag: dummyTags[articleIndex % dummyTags.length],
          author: dummyAuthors[articleIndex % dummyAuthors.length],
          readTime: Math.floor(Math.random() * 10) + 3,
          isFeatured: j === 0, // first article in each category is featured
          isActive: true,
          externalLink: j % 2 === 0 ? "https://example.com/external-resource" : "", 
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
