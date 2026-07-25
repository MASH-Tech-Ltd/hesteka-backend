import { Request, Response, NextFunction } from "express";
import { securityService } from "../modules/security/security.service";
import CustomError from "../helpers/CustomError";
import jwt from "jsonwebtoken";

const blockedIpLogThrottle = new Map<string, number>();

const suspiciousProbingPatterns = [
  /^\/wp-/i,
  /^\/phpmyadmin/i,
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/config\.json/i,
  /^\/cgi-bin/i,
  /^\/admin\.php/i,
  /^\/setup\.php/i,
  /^\/xmlrpc\.php/i,
  /^\/actuator/i,
  /^\/vendor\//i,
  /^\/eval/i,
  /^\/shell/i,
  /\.sql$/i,
  /\.bak$/i,
];

export const ipBlockerMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ip = req?.ip || req?.headers?.["x-real-ip"] || req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
    const clientIp = (Array.isArray(ip) ? ip[0] : (typeof ip === "string" ? ip.split(",")[0] : ""))?.trim() || "unknown";

    const isBlocked = await securityService.isIpBlocked(clientIp);
    if (isBlocked) {
      // Throttled logging (max 1 log per minute per blocked IP) so details remain visible in Security Logs
      const lastLogged = blockedIpLogThrottle.get(clientIp) || 0;
      if (Date.now() - lastLogged > 60000) {
        blockedIpLogThrottle.set(clientIp, Date.now());
        let userId = null;
        try {
          const authHeader = req.headers?.authorization;
          if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1] || "";
            const decoded = jwt.decode(token) as any;
            if (decoded?.userId) userId = decoded.userId;
          }
        } catch (e) {}

        await securityService.logSecurityIncident(
          clientIp,
          req.originalUrl || req.url,
          req.method,
          "Access denied. Attempt from blocked IP rejected.",
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
          userId,
          true
        );
      }

      throw new CustomError(
        403,
        "Access denied. Your IP address has been blocked due to suspicious activity.",
      );
    }

    // Active Protection: Detect unusual IP probing / bot attack signatures
    const urlPath = req.originalUrl || req.url || "";
    const isProbingAttack = suspiciousProbingPatterns.some((pattern) => pattern.test(urlPath));
    if (isProbingAttack) {
      await securityService.logSecurityIncident(
        clientIp,
        urlPath,
        req.method,
        `🚨 ACTIVE PROTECTION: Malicious Probing / Bot Attack detected (${urlPath})`,
        typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
        null
      );
      throw new CustomError(
        403,
        "Access denied. Unusual activity and vulnerability probing detected from your IP address.",
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

