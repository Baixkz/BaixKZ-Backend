import type { FastifyRequest } from "fastify";
import type { AdminRole } from "@prisma/client";

export interface AuthUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
    adminRole: AdminRole | "SUPER_ADMIN" | null;
  }
}

export type AuthedRequest = FastifyRequest & { authUser: AuthUser };
