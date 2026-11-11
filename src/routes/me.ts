import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { syncUser } from "../services/users.js";

export async function meRoutes(app: FastifyInstance) {
  app.post("/me/sync", { preHandler: requireAuth }, async (request) => {
    const user = await syncUser(request.authUser!);
    return { id: user.id, firebaseUid: user.firebaseUid, email: user.email, displayName: user.displayName, blocked: user.blocked };
  });
}
