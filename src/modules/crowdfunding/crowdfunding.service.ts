import { crowdfundingProjectModel } from "./crowdfunding.models";
import { getUluleProjectStats, getUluleProjectDonors } from "../../utils/ululeClient";
import { adminConfigModel } from "../admin/admin.models";

export const crowdfundingService = {
  async getAllProjects() {
    return crowdfundingProjectModel.find().sort({ createdAt: -1 });
  },

  async addProject(slug: string) {
    let project = await crowdfundingProjectModel.findOne({ slug });
    if (!project) {
      const activeExists = await crowdfundingProjectModel.exists({ isActive: true });
      project = await crowdfundingProjectModel.create({ slug, isActive: !activeExists });
    }
    return project;
  },

  async removeProject(slug: string) {
    await crowdfundingProjectModel.deleteOne({ slug });
  },

  async setActiveProject(slug: string) {
    const project = await crowdfundingProjectModel.findOne({ slug });
    if (!project) throw new Error("Project not found");
    
    // Set all to inactive
    await crowdfundingProjectModel.updateMany({}, { isActive: false });
    // Set the chosen one to active
    project.isActive = true;
    await project.save();
    return project;
  },

  async getCrowdfundingStats(slugParam?: string) {
    // Determine which slug to use
    let slug = slugParam;
    if (!slug) {
      const activeProject = await crowdfundingProjectModel.findOne({ isActive: true });
      if (activeProject) slug = activeProject.slug;
    }

    let config = await adminConfigModel.findOne();
    const fallbackTotal = config?.crowdfundingTotal || 0;
    const fallbackGoal = config?.crowdfundingGoal || 5000;

    if (!slug) {
      return {
        totalCollected: fallbackTotal,
        goalAmount: fallbackGoal,
        percentage: fallbackGoal > 0 ? Math.min(100, (fallbackTotal / fallbackGoal) * 100) : 0,
        donorsCount: 0,
      };
    }

    try {
      const data: any = await getUluleProjectStats(slug);
      const totalCollected = parseFloat(data.amount_raised);
      const goalAmount = parseFloat(data.goal);
      
      return {
        totalCollected,
        goalAmount,
        percentage: goalAmount > 0 ? Math.min(100, (totalCollected / goalAmount) * 100) : 0,
        donorsCount: data.supporters_count || 0,
        dateEnd: data.date_end,
      };
    } catch (error) {
      console.error(`Failed to fetch from Ulule API for slug ${slug}, falling back to config`, error);
      return {
        totalCollected: fallbackTotal,
        goalAmount: fallbackGoal,
        percentage: fallbackGoal > 0 ? Math.min(100, (fallbackTotal / fallbackGoal) * 100) : 0,
        donorsCount: 0,
      };
    }
  },

  async getCrowdfundingDonors(slugParam?: string) {
    let slug = slugParam;
    if (!slug) {
      const activeProject = await crowdfundingProjectModel.findOne({ isActive: true });
      if (activeProject) slug = activeProject.slug;
    }

    if (!slug) return [];

    const apiKey = process.env.ULULE_API_KEY;
    
    if (!apiKey) {
      console.warn("ULULE_API_KEY not configured in .env");
      return [];
    }

    try {
      const orders = await getUluleProjectDonors(slug, apiKey);
      
      return orders.map((order: any) => ({
        user: order.user?.display_name || order.user?.username || "Anonyme",
        amount: order.order_total,
        counterpart: order.reward_title || "Don libre",
        date: order.created_at || order.date,
        status: order.status,
      }));
    } catch (error) {
      console.error(`Failed to fetch donors from Ulule API for slug ${slug}`, error);
      return [];
    }
  }
};
