import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
// Use require to avoid default-export interop issues in CJS runtime
const cookieParser = require("cookie-parser");
import { AppModule } from "@/app.module";
import { sessionMiddleware } from "@/auth/session.middleware";
import { prisma } from "@/prisma/prismaClient";

describe("6.5 Telegram auth via headers (bot) (e2e)", () => {
  let app: INestApplication;
  const E2E_BOT_TOKEN = "E2E_BOT_TOKEN";
  const tgId1 = "999000001";
  const tgId2 = "999000002";

  beforeAll(async () => {
    process.env.BOT_TOKEN = E2E_BOT_TOKEN;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(sessionMiddleware());
    await app.init();

    // cleanup in case of previous runs
    await prisma.authAccount.deleteMany({
      where: { provider: "telegram", providerId: { in: [tgId1, tgId2] } },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: [`tg-${tgId1}@tg.local`, `tg-${tgId2}@tg.local`] },
      },
    });
  });

  afterAll(async () => {
    // cleanup test users and their artifacts
    await prisma.session.deleteMany({
      where: {
        user: { email: { contains: "@tg.local" } },
        channel: "telegram",
      },
    });
    await prisma.authAccount.deleteMany({
      where: { provider: "telegram", providerId: { in: [tgId1, tgId2] } },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: [`tg-${tgId1}@tg.local`, `tg-${tgId2}@tg.local`] },
      },
    });
    await app.close();
  });

  it("6.5.1 Happy path: valid headers authenticate and create/update telegram session", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);

    expect(res.body?.user?.id).toBeDefined();

    const acct = await prisma.authAccount.findUnique({
      where: {
        provider_providerId: { provider: "telegram", providerId: tgId1 },
      },
    });
    expect(acct).toBeTruthy();
  });

  it("6.5.2 Invalid bot token → 401", async () => {
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", "WRONG_TOKEN")
      .set("X-Telegram-User-Id", tgId2)
      .expect(401);
  });

  it("6.5.3 Missing headers → unauthenticated", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("6.5.4 Existing telegram account: second call returns same userId", async () => {
    const first = await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);
    const userId1 = first.body?.user?.id;

    const second = await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);
    const userId2 = second.body?.user?.id;

    expect(userId1).toBe(userId2);
  });

  it("6.5.5 Session upsert/idempotency: keep one telegram session per user", async () => {
    // ensure session exists by making a call
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);
    const userId = res.body?.user?.id as string;

    // call again to update same session
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);

    const sessions = await prisma.session.findMany({
      where: { userId, channel: "telegram" },
    });
    expect(sessions.length).toBe(1);
  });

  it("6.5.6 Touch lastSeenAt on subsequent calls", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);
    const userId = res.body?.user?.id as string;

    const before = await prisma.session.findFirstOrThrow({
      where: { userId, channel: "telegram" },
      orderBy: { createdAt: "desc" },
    });

    // wait a tiny bit to ensure timestamp changes
    await new Promise((r) => setTimeout(r, 15));

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("X-Bot-Token", E2E_BOT_TOKEN)
      .set("X-Telegram-User-Id", tgId1)
      .expect(200);

    const after = await prisma.session.findFirstOrThrow({
      where: { userId, channel: "telegram" },
      orderBy: { createdAt: "desc" },
    });

    expect(after.lastSeenAt && before.lastSeenAt).toBeTruthy();
    expect(new Date(after.lastSeenAt as Date).getTime()).toBeGreaterThan(
      new Date(before.lastSeenAt as Date).getTime()
    );
  });

  it("6.5.7 Expired/revoked cookie session is rejected (no headers)", async () => {
    // Create a user and a cookie session that is already expired
    const email = `e2e-cookie-expired-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, passwordHash: "" },
    });
    const expired = await prisma.session.create({
      data: {
        userId: user.id,
        channel: "web",
        expiresAt: new Date(Date.now() - 1000),
        lastSeenAt: new Date(Date.now() - 2000),
      },
      select: { id: true },
    });

    const cookieName = "sid";
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${cookieName}=${expired.id}`)
      .expect(401);

    // revoke and try again to assert also revoked is rejected
    await prisma.session.update({
      where: { id: expired.id },
      data: { revokedAt: new Date() },
    });
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${cookieName}=${expired.id}`)
      .expect(401);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
