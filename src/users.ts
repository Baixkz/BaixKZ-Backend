import { prisma } from "../db.js";
import type { AuthUser } from "../types.js";

export async function syncUser(user: AuthUser) {
  return prisma.user.upsert({
    where: { firebaseUid: user.uid },
    create: {
      firebaseUid: user.uid,
      email: user.email ?? null,
      displayName: user.name ?? null,
      photoUrl: user.picture ?? null
    },
    update: {
      email: user.email ?? undefined,
      displayName: user.name ?? undefined,
      photoUrl: user.picture ?? undefined
    }
  });
}
