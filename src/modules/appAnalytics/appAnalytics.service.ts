import { AppAnalytics } from "./appAnalytics.models";

export const appAnalyticsService = {
  logEvent: async (data: {
    eventType: "install" | "uninstall" | "session" | "conversion";
    deviceId: string;
    os?: "android" | "ios" | "web" | "unknown";
    version?: string;
    duration?: number;
    userId?: string;
    metadata?: any;
  }) => {
    return await AppAnalytics.create(data);
  },

  getRetentionStats: async () => {
    // Current month start
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Basic aggregate counts
    const totalDownloads = await AppAnalytics.countDocuments({ eventType: "install" });
    const totalUninstalls = await AppAnalytics.countDocuments({ eventType: "uninstall" });
    
    // Sessions this month
    const sessionsMonth = await AppAnalytics.countDocuments({ 
      eventType: "session",
      createdAt: { $gte: currentMonthStart }
    });

    // Retention: 
    // Simply mocked or derived. Real retention usually compares Day 1 vs Day 30 installs.
    // For now, let's use a simple ratio: active devices this month / total installs.
    const activeDevicesThisMonth = await AppAnalytics.distinct("deviceId", {
      eventType: "session",
      createdAt: { $gte: currentMonthStart }
    });
    
    let retention = 0;
    if (totalDownloads > 0) {
      retention = Math.round((activeDevicesThisMonth.length / totalDownloads) * 100);
    }

    // Average session duration
    const sessionStats = await AppAnalytics.aggregate([
      { $match: { eventType: "session" } },
      { $group: { _id: null, avgDuration: { $avg: "$duration" } } }
    ]);
    
    let avgDurationSeconds = sessionStats[0]?.avgDuration || 0;
    const mins = Math.floor(avgDurationSeconds / 60);
    const secs = Math.floor(avgDurationSeconds % 60);
    const avgDuration = `${mins}m${secs}s`;

    // Conversion
    const totalConversions = await AppAnalytics.countDocuments({ eventType: "conversion" });
    let conversion = 0;
    if (totalDownloads > 0) {
      conversion = Math.round((totalConversions / totalDownloads) * 100);
    }

    // Installs / Uninstalls per month (last 6 months for chart)
    const chartData = await AppAnalytics.aggregate([
      {
        $match: {
          eventType: { $in: ["install", "uninstall"] },
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
            type: "$eventType"
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format chart data
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedChartData: Record<string, any> = {};
    
    chartData.forEach(item => {
      const monthIndex = item._id.month ? item._id.month - 1 : 0;
      const monthLabel = monthNames[monthIndex] || "Unknown";
      if (!formattedChartData[monthLabel]) {
        formattedChartData[monthLabel] = { name: monthLabel, installs: 0, uninstalls: 0 };
      }
      if (item._id.type === "install") {
        formattedChartData[monthLabel].installs = item.count;
      } else {
        formattedChartData[monthLabel].uninstalls = item.count;
      }
    });

    return {
      downloads: totalDownloads,
      uninstalls: totalUninstalls,
      sessionsMonth,
      retention,
      avgDuration,
      conversion,
      chartData: Object.values(formattedChartData)
    };
  }
};
