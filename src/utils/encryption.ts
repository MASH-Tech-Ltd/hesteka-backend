import crypto from "crypto";
import config from "../config";

const algorithm = "aes-256-cbc";
const secretKey = crypto.createHash('sha256').update(config.jwt.accessTokenSecret as string).digest('base64').substr(0, 32);

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

export const decrypt = (hash: string): string => {
  const [ivHex, encryptedText] = hash.split(":");
  if (!ivHex || !encryptedText) return "";
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};
