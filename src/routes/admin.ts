import type { FastifyInstance } from "fastify";
import { AdminRole, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRoles } from "../plugins/auth.js";

const roleSchema = z.object({ firebaseUid: z.string().min(10).max(128), role: z.enum(["ADMIN", "MODERATOR"]), permissions: z.array(z.string().max(80)).max(50).default([]) });

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", { preHandler: requireRoles("SUPER_ADMIN", AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPPORT) }, async () => {
    const [users, stores, pendingStores, products, admins] = await Promise.all([
      prisma.user.count(), prisma.store.count(), prisma.store.count({ where: { status: StoreStatus.PENDING } }), prisma.product.count(), prisma.adminUser.count({ where: { active: true } })
    ]);
    return { users, stores, pendingStores, products, admins };
  });

  app.get("/admin/stores", { preHandler: requireRoles("SUPER_ADMIN", AdminRole.ADMIN, AdminRole.MODERATOR) }, async (request) => {
    const query = request.query as { status?: string; page?: string };
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const validStatus = Object.values(StoreStatus).includes(query.status as StoreStatus) ? query.status as StoreStatus : undefined;
    const where = validStatus ? { status: validStatus } : {};
    const [items, total] = await Promise.all([
      prisma.store.findMany({ where, include: { owner: { select: { firebaseUid: true, email: true, displayName: true } }, _count: { select: { products: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25 }),
      prisma.store.count({ where })
    ]);
    return { items, page, total };
  });

  app.patch("/admin/stores/:storeId/status", { preHandler: requireRoles("SUPER_ADMIN", AdminRole.ADMIN, AdminRole.MODERATOR) }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const parsed = z.object({ status: z.nativeEnum(StoreStatus) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR" });
    const store = await prisma.store.update({ where: { id: storeId }, data: { status: parsed.data.status } }).catch(() => null);
    if (!store) return reply.code(404).send({ error: "NOT_FOUND" });
    await prisma.adminAuditLog.create({ data: { actorUid: request.authUser!.uid, action: "STORE_STATUS_CHANGED", targetType: "store", targetId: storeId, details: { status: parsed.data.status } } });
    return store;
  });

  app.get("/admin/admins", { preHandler: requireRoles("SUPER_ADMIN") }, async () => prisma.adminUser.findMany({ include: { user: { select: { firebaseUid: true, email: true, displayName: true } } }, orderBy: { createdAt: "desc" } }));

  app.post("/admin/admins", { preHandler: requireRoles("SUPER_ADMIN") }, async (request, reply) => {
    const parsed = roleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { firebaseUid: parsed.data.firebaseUid } });
    if (!user) return reply.code(404).send({ error: "USER_NOT_FOUND", message: "Бұл қолданушы Backend арқылы әлі тіркелмеген. Алдымен платформаға кірсін." });
    if (user.firebaseUid === process.env.SUPER_ADMIN_UID) return reply.code(400).send({ error: "SUPER_ADMIN_PROTECTED" });
    const admin = await prisma.adminUser.upsert({ where: { userId: user.id }, create: { userId: user.id, role: parsed.data.role, permissions: parsed.data.permissions }, update: { role: parsed.data.role, permissions: parsed.data.permissions, active: true } });
    await prisma.adminAuditLog.create({ data: { actorUid: request.authUser!.uid, action: "ADMIN_ROLE_GRANTED", targetType: "admin", targetId: admin.id, details: { role: admin.role } } });
    return reply.code(201).send(admin);
  });

  app.delete("/admin/admins/:adminId", { preHandler: requireRoles("SUPER_ADMIN") }, async (request, reply) => {
    const { adminId } = request.params as { adminId: string };
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId }, include: { user: true } });
    if (!admin) return reply.code(404).send({ error: "NOT_FOUND" });
    if (admin.user.firebaseUid === process.env.SUPER_ADMIN_UID) return reply.code(400).send({ error: "SUPER_ADMIN_PROTECTED" });
    await prisma.adminUser.update({ where: { id: adminId }, data: { active: false } });
    await prisma.adminAuditLog.create({ data: { actorUid: request.authUser!.uid, action: "ADMIN_ROLE_REVOKED", targetType: "admin", targetId: adminId } });
    return reply.code(204).send();
  });

  app.get("/admin/audit-logs", { preHandler: requireRoles("SUPER_ADMIN", AdminRole.ADMIN) }, async () => prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
}
