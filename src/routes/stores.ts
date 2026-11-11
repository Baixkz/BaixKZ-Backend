import type { FastifyInstance } from "fastify";
import { StoreStatus, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../plugins/auth.js";
import { syncUser } from "../services/users.js";

const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1500).default(""),
  phone: z.string().trim().min(5).max(30),
  whatsapp: z.string().trim().min(5).max(30),
  village: z.string().trim().min(2).max(100),
  address: z.string().trim().max(200).default("")
});

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  price: z.coerce.number().positive().max(999999999),
  imageUrl: z.string().url().max(2048).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(80).default("Басқа"),
  stock: z.coerce.number().int().min(0).max(1000000).optional()
});

export async function storeRoutes(app: FastifyInstance) {
  app.get("/stores", async (request) => {
    const query = request.query as { village?: string; search?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20) || 20));
    const where = {
      status: StoreStatus.ACTIVE,
      ...(query.village ? { village: { equals: query.village, mode: "insensitive" as const } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {})
    };
    const [items, total] = await Promise.all([
      prisma.store.findMany({ where, select: { id: true, name: true, description: true, village: true, address: true, phone: true, whatsapp: true, logoUrl: true, _count: { select: { products: { where: { status: ProductStatus.ACTIVE } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.store.count({ where })
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  });

  app.get("/stores/:storeId", async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const store = await prisma.store.findFirst({
      where: { id: storeId, status: StoreStatus.ACTIVE },
      select: { id: true, name: true, description: true, village: true, address: true, phone: true, whatsapp: true, logoUrl: true,
        products: { where: { status: ProductStatus.ACTIVE }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, description: true, price: true, currency: true, imageUrl: true, category: true, stock: true } }
      }
    });
    if (!store) return reply.code(404).send({ error: "NOT_FOUND", message: "Дүкен табылмады." });
    return store;
  });

  app.post("/stores", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createStoreSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const user = await syncUser(request.authUser!);
    const existing = await prisma.store.findFirst({ where: { ownerId: user.id, status: { in: [StoreStatus.PENDING, StoreStatus.ACTIVE] } } });
    if (existing) return reply.code(409).send({ error: "STORE_EXISTS", message: "Сізде тіркелген немесе тексеріліп жатқан дүкен бар." });
    const store = await prisma.store.create({ data: { ...parsed.data, ownerId: user.id } });
    return reply.code(201).send(store);
  });

  app.get("/my/store", { preHandler: requireAuth }, async (request, reply) => {
    const user = await syncUser(request.authUser!);
    const store = await prisma.store.findFirst({ where: { ownerId: user.id }, include: { products: { orderBy: { createdAt: "desc" } } } });
    if (!store) return reply.code(404).send({ error: "STORE_NOT_FOUND", message: "Әзірге дүкен тіркелмеген." });
    return store;
  });

  app.post("/my/store/products", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const user = await syncUser(request.authUser!);
    const store = await prisma.store.findFirst({ where: { ownerId: user.id, status: StoreStatus.ACTIVE } });
    if (!store) return reply.code(403).send({ error: "STORE_NOT_ACTIVE", message: "Тауар қосу үшін дүкен әкімші тарапынан мақұлдануы керек." });
    const product = await prisma.product.create({ data: { ...parsed.data, imageUrl: parsed.data.imageUrl || null, storeId: store.id } });
    return reply.code(201).send(product);
  });

  app.patch("/my/store/products/:productId", { preHandler: requireAuth }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const parsed = createProductSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const user = await syncUser(request.authUser!);
    const product = await prisma.product.findFirst({ where: { id: productId, store: { ownerId: user.id } } });
    if (!product) return reply.code(404).send({ error: "NOT_FOUND", message: "Тауар табылмады." });
    return prisma.product.update({ where: { id: productId }, data: { ...parsed.data, imageUrl: parsed.data.imageUrl || null } });
  });

  app.delete("/my/store/products/:productId", { preHandler: requireAuth }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const user = await syncUser(request.authUser!);
    const product = await prisma.product.findFirst({ where: { id: productId, store: { ownerId: user.id } } });
    if (!product) return reply.code(404).send({ error: "NOT_FOUND", message: "Тауар табылмады." });
    await prisma.product.update({ where: { id: productId }, data: { status: ProductStatus.HIDDEN } });
    return reply.code(204).send();
  });
}
