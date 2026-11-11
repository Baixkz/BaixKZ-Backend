import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  PLATFORM_ORIGIN: z.string().url().default("http://localhost:5173"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5174"),
  DATABASE_URL: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  SUPER_ADMIN_UID: z.string().min(1),
  LOG_LEVEL: z.string().default("info")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Environment configuration error:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Copy .env.example to .env and fill required values.");
}

export const config = parsed.data;
