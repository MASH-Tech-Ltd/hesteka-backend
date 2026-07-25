import { Request } from "express";
import geoip from "geoip-lite";

export interface IpLocation {
  country: string;
  city: string;
  region?: string | undefined;
  coordinates?: [number, number] | undefined; // [lat, lng]
  timezone?: string | undefined;
}

export const getIpLocation = (req: Request | any, clientIp?: string): IpLocation => {
  try {
    let ipToLookup = clientIp;
    if (!ipToLookup) {
      const ip = req?.ip || req?.headers?.["x-real-ip"] || req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
      ipToLookup = (Array.isArray(ip) ? ip[0] : (typeof ip === "string" ? ip.split(",")[0] : ""))?.trim() || "unknown";
    }

    // 1. Check Cloudflare / Vercel Edge Headers first (Instant & 0ms)
    const cfCountry = (req?.headers?.["cf-ipcountry"] || req?.headers?.["x-vercel-ip-country"]) as string;
    const cfCity = (req?.headers?.["cf-city"] || req?.headers?.["x-vercel-ip-city"]) as string;
    const cfLat = req?.headers?.["cf-latitude"] || req?.headers?.["x-vercel-ip-latitude"];
    const cfLon = req?.headers?.["cf-longitude"] || req?.headers?.["x-vercel-ip-longitude"];

    if (cfCountry && cfCountry !== "XX" && typeof cfCountry === "string") {
      return {
        country: cfCountry,
        city: (cfCity && typeof cfCity === "string" ? cfCity : "Unknown"),
        coordinates: (cfLat && cfLon && !isNaN(Number(cfLat)) && !isNaN(Number(cfLon))) ? [Number(cfLat), Number(cfLon)] : undefined,
        timezone: (typeof req?.headers?.["cf-timezone"] === "string" ? req.headers["cf-timezone"] : undefined),
      };
    }

    // 2. Fallback to offline GeoIP lookup (Fast local lookup)
    if (ipToLookup && ipToLookup !== "unknown" && ipToLookup !== "127.0.0.1" && ipToLookup !== "::1" && !ipToLookup.startsWith("192.168.") && !ipToLookup.startsWith("10.")) {
      const geo = geoip.lookup(ipToLookup);
      if (geo && Array.isArray(geo.ll) && geo.ll.length === 2) {
        return {
          country: geo.country || "Unknown",
          city: geo.city || "Unknown",
          region: geo.region || undefined,
          coordinates: [Number(geo.ll[0]), Number(geo.ll[1])],
          timezone: geo.timezone || undefined,
        };
      }
    }

    // If local or private IP, return Local / Localhost
    if (ipToLookup === "127.0.0.1" || ipToLookup === "::1" || ipToLookup?.startsWith("192.168.") || ipToLookup?.startsWith("10.")) {
      return { country: "Local", city: "Localhost" };
    }

    return { country: "Unknown", city: "Unknown" };
  } catch (error) {
    return { country: "Unknown", city: "Unknown" };
  }
};

export const trackUserIpAndLocation = async (req: any, user: any, isRegistration: boolean = false): Promise<void> => {
  try {
    if (!user || !user.save) return;
    const clientIp = req?.ip || req?.headers?.["x-real-ip"] || req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
    const ipStr = (Array.isArray(clientIp) ? clientIp[0] : (typeof clientIp === "string" ? clientIp.split(",")[0] : ""))?.trim() || "unknown";
    const loc = getIpLocation(req, ipStr);

    user.lastLogin = new Date();
    user.lastLoginIp = ipStr;
    user.lastLoginLocation = { country: loc.country, city: loc.city };
    if (isRegistration || !user.registrationIp) {
      user.registrationIp = ipStr;
      user.registrationLocation = { country: loc.country, city: loc.city };
    }
    await user.save();
  } catch (error) {
    console.error("[Auth] Failed to track user IP and location:", error);
  }
};
