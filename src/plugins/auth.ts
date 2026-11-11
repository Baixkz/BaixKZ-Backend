import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminRole } from "@prisma/client";
import { firebaseAuth } from "../firebase-admin.js";
import { prisma } from "../db.js";
import { config } from "../config.js";

export async function registerAuth(app: FastifyInstance) {
  app.decorateRequest("authUser", null);
  app.decorateRequest("adminRole", null);

  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;

    const token = header.slice(7).trim();
    if (!token) return;

    try {
      const decoded = await firebaseAuth.verifyIdToken(token, true);
      request.authUser = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      };
      if (decoded.uid === config.SUPER_ADMIN_UID) {
        request.adminRole = "SUPER_ADMIN";
      } else {
        const admin = await prisma.adminUser.findFirst({
          where: { user: { firebaseUid: decoded.uid }, active: true },
          select: { role: true }
        });
        request.adminRole = admin?.role ?? null;
      }
    } catch {
      request.authUser = null;
      request.adminRole = null;
    }
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Кіру қажет." });
  }
}

export function requireRoles(...roles: Array<AdminRole | "SUPER_ADMIN">) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Кіру қажет." });
    }
    if (!request.adminRole || !roles.includes(request.adminRole)) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Бұл әрекетке рұқсатыңыз жоқ." });
    }
  };
}
