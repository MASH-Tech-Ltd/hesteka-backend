import dotenv from "dotenv";
import { connectDatabase } from "../database/db";
import { userModel } from "../modules/usersAuth/user.models";
import { sponsorModel } from "../modules/sponsors/sponsor.models";
import { SponsorType, SponsorStatus } from "../modules/sponsors/sponsor.interface";
import { departments as DEPARTMENTS, regions as REGIONS } from "../utils/franceLocations";

dotenv.config();

async function run() {
  try {
    console.log("Connecting to the database...");
    await connectDatabase();
    console.log("Connected.");

    // Find partners
    const partners = await userModel.find({ role: "partners" }).limit(5);
    if (partners.length === 0) {
      console.log("No partners found. Please create a partner user first.");
      process.exit(1);
    }

    console.log(`Found ${partners.length} partners. Generating 20 test ads...`);

    const ads = [];
    for (let i = 1; i <= 20; i++) {
      const partner = partners[Math.floor(Math.random() * partners.length)];
      if (!partner) continue;
      
      const isTargetAll = Math.random() > 0.5;
      const adRegions = isTargetAll ? [] : [REGIONS[Math.floor(Math.random() * REGIONS.length)]];
      const adDepartments = isTargetAll ? [] : [DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)]];
      
      // Random dates
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 10)); // started up to 10 days ago
      
      let endDate = new Date();
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 30)); // ends up to 30 days from now
      
      // Status
      let status = SponsorStatus.ACTIVE;
      if (Math.random() > 0.8) status = SponsorStatus.INACTIVE;
      
      // If we randomly make it expired by overriding endDate
      if (Math.random() > 0.9) {
          endDate = new Date();
          endDate.setDate(endDate.getDate() - Math.floor(Math.random() * 5) - 1); // 1 to 6 days ago
          status = SponsorStatus.EXPIRED;
      }

      ads.push({
        partner: partner._id,
        title: `Test Campaign ${i} - ${isTargetAll ? 'Global' : adRegions[0] || adDepartments[0]}`,
        description: `This is a randomly generated test campaign ${i} designed for layout testing.`,
        actionText: "Click Here",
        actionLink: "https://example.com",
        type: Math.random() > 0.5 ? SponsorType.BANNER : SponsorType.FEATURED,
        startDate,
        endDate,
        status,
        targetAllUsers: isTargetAll,
        regions: adRegions,
        departments: adDepartments,
        impressions: Math.floor(Math.random() * 1000),
        clicks: Math.floor(Math.random() * 100),
      });
    }

    await sponsorModel.insertMany(ads);
    console.log("Successfully generated 20 test ads.");

  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    console.log("Exiting...");
    process.exit(0);
  }
}

run();
