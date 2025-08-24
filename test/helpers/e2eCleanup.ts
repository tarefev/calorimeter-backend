import { PrismaClient } from "@prisma/client";

export async function cleanupE2E(prisma: PrismaClient, prefix = "e2e-") {
  try {
    // Order matters because of FK constraints
    await prisma.session
      .deleteMany({ where: { user: { email: { startsWith: prefix } } } })
      .catch(() => {});
    await prisma.authLinkToken
      .deleteMany({ where: { user: { email: { startsWith: prefix } } } })
      .catch(() => {});
    await prisma.authAccount
      .deleteMany({ where: { user: { email: { startsWith: prefix } } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { startsWith: prefix } } })
      .catch(() => {});
  } catch (e) {
    // ignore
  }
}

export default cleanupE2E;
