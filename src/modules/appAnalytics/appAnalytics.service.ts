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

  getRetentionStats: async (timeframe?: string) => {
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

    // OS Breakdown
    const osData = await AppAnalytics.aggregate([
      { $match: { eventType: "install" } },
      { $group: { _id: "$os", count: { $sum: 1 } } }
    ]);
    const osBreakdown = { android: 0, ios: 0, web: 0, unknown: 0 };
    osData.forEach(item => {
      const os = item._id || "unknown";
      if (osBreakdown[os as keyof typeof osBreakdown] !== undefined) {
        osBreakdown[os as keyof typeof osBreakdown] += item.count;
      } else {
        osBreakdown["unknown"] += item.count;
      }
    });

    // Metadata / Sensitive Samples
    const metadataSamples = await AppAnalytics.find({ metadata: { $exists: true, $type: "object", $ne: {} } })
      .sort({ createdAt: -1 })
      .limit(5);

    // Unique Devices (all time)
    const uniqueDevicesList = await AppAnalytics.distinct("deviceId");
    const uniqueDevices = uniqueDevicesList.length;

    // Installs / Uninstalls Chart
    let startDate;
    let groupStage;
    
    if (timeframe === "weekly") {
      startDate = new Date(new Date().setDate(new Date().getDate() - 7));
      groupStage = { day: { $dayOfMonth: "$createdAt" }, month: { $month: "$createdAt" }, year: { $year: "$createdAt" }, type: "$eventType" };
    } else if (timeframe === "yearly") {
      startDate = new Date(new Date().setMonth(new Date().getMonth() - 12));
      groupStage = { month: { $month: "$createdAt" }, year: { $year: "$createdAt" }, type: "$eventType" };
    } else if (timeframe === "lifetime") {
      startDate = new Date(0); // Beginning of time
      groupStage = { year: { $year: "$createdAt" }, type: "$eventType" };
    } else {
      // Default to monthly
      startDate = new Date(new Date().setDate(new Date().getDate() - 30));
      groupStage = { day: { $dayOfMonth: "$createdAt" }, month: { $month: "$createdAt" }, year: { $year: "$createdAt" }, type: "$eventType" };
    }

    const chartData = await AppAnalytics.aggregate([
      {
        $match: {
          eventType: { $in: ["install", "uninstall"] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: groupStage,
          count: { $sum: 1 }
        }
      }
    ]);

    // Format chart data
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedChartData: Record<string, any> = {};
    
    chartData.forEach(item => {
      let dateLabel = "Unknown";
      let orderDate = 0;

      if (timeframe === "lifetime") {
        dateLabel = `${item._id.year}`;
        orderDate = new Date(item._id.year || new Date().getFullYear(), 0, 1).getTime();
      } else if (timeframe === "yearly") {
        const monthIndex = item._id.month ? item._id.month - 1 : 0;
        dateLabel = `${monthNames[monthIndex]} ${item._id.year}`;
        orderDate = new Date(item._id.year || new Date().getFullYear(), monthIndex, 1).getTime();
      } else {
        const monthIndex = item._id.month ? item._id.month - 1 : 0;
        const monthLabel = monthNames[monthIndex] || "Unknown";
        const day = item._id.day || 1;
        dateLabel = `${monthLabel} ${day}`;
        orderDate = new Date(item._id.year || new Date().getFullYear(), monthIndex, day).getTime();
      }
      
      if (!formattedChartData[dateLabel]) {
        formattedChartData[dateLabel] = { 
          name: dateLabel, 
          installs: 0, 
          uninstalls: 0, 
          orderDate
        };
      }
      
      if (item._id.type === "install") {
        formattedChartData[dateLabel].installs = item.count;
      } else {
        formattedChartData[dateLabel].uninstalls = item.count;
      }
    });

    const finalChartData = Object.values(formattedChartData)
      .sort((a: any, b: any) => a.orderDate - b.orderDate)
      .map((i: any) => {
        delete i.orderDate;
        return i;
      });

    return {
      downloads: totalDownloads,
      uninstalls: totalUninstalls,
      sessionsMonth,
      retention,
      avgDuration,
      conversion,
      uniqueDevices,
      osBreakdown,
      metadataSamples,
      chartData: finalChartData
    };
  }
};
