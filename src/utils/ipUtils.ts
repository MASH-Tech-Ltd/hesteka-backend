import { Request } from "express";

export const getClientIp = (req: Request): string => {
  // Common headers for extracting real IP behind proxies (Cloudflare, Nginx, AWS, etc)
  const headers = req.headers;
  const ip =
    headers["cf-connecting-ip"] ||
    headers["true-client-ip"] ||
    headers["x-real-ip"] ||
    headers["x-forwarded-for"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";

  const clientIp = (
    Array.isArray(ip) ? ip[0] : typeof ip === "string" ? ip.split(",")[0] : ""
  )?.trim() || "unknown";

  // Clean IPv6 mapped IPv4
  if (clientIp.startsWith("::ffff:")) {
    return clientIp.replace("::ffff:", "");
  }

  return clientIp;
};
