import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { registerAuth } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { storeRoutes } from "./routes/stores.js";
import { adminRoutes } from "./routes/admin.js";
import { meRoutes } from "./routes/me.js";
import "./types.js";

const app = Fastify({ logger: { level: config.LOG_LEVEL }, trustProxy: true, bodyLimit: 1024 * 1024 });

await app.register(helmet);
await app.register(cors, {
  origin: [config.PLATFORM_ORIGIN, config.ADMIN_ORIGIN],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await registerAuth(app);
await app.register(healthRoutes, { prefix: "/api/v1" });
await app.register(storeRoutes, { prefix: "/api/v1" });
await app.register(adminRoutes, { prefix: "/api/v1" });
await app.register(meRoutes, { prefix: "/api/v1" });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  if (error.validation) return reply.code(400).send({ error: "VALIDATION_ERROR", message: "Сұрау деректері дұрыс емес." });
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "Серверде қате пайда болды." });
});

const close = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
