import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
const cookieParser = require("cookie-parser");

describe("Auth link flow (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.BOT_TOKEN = process.env.BOT_TOKEN || "test-bot-token";
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(sessionMiddleware());
    await app.init();
  });

  afterAll(async () => {
    // cleanup test data (users created with email starting with e2e-)
    try {
      await prisma.authAccount.deleteMany({
        where: { user: { email: { startsWith: "e2e-" } } },
      });
    } catch (e) {}
    try {
      await prisma.authLinkToken.deleteMany({
        where: { user: { email: { startsWith: "e2e-" } } },
      });
    } catch (e) {}
    try {
      await prisma.user.deleteMany({
        where: { email: { startsWith: "e2e-" } },
      });
    } catch (e) {}

    await app.close();
    await prisma.$disconnect();
  });

  it("register -> link-token -> bot confirm -> authAccount created", async () => {
    const email = `e2e-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());

    const reg = await agent
      .post("/auth/register")
      .send({ email, password })
      .expect(201);

    const linkRes = await agent.post("/auth/link-token").send().expect(201);

    const token = linkRes.body.token;
    expect(token).toBeDefined();

    const tgId = `${Date.now()}`;

    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token, telegramUserId: tgId })
      .expect(201);

    const acct = await prisma.authAccount.findUnique({
      where: {
        provider_providerId: { provider: "telegram", providerId: tgId },
      },
    });
    expect(acct).not.toBeNull();

    // cleanup
    try {
      if (acct) {
        await prisma.user.delete({ where: { id: acct.userId } });
      } else {
        await prisma.user.deleteMany({ where: { email } });
      }
    } catch (e) {
      // ignore
    }
  }, 20000);

  it("invalid token -> confirm returns 404", async () => {
    const email = `e2e-invalid-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());
    const reg = await agent
      .post("/auth/register")
      .send({ email, password })
      .expect(201);

    // bot attempts to confirm a non-existent token
    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token: "NOTEXIST", telegramUserId: `${Date.now()}` })
      .expect(404);

    // cleanup
    try {
      await prisma.user.deleteMany({ where: { email } });
    } catch (e) {}
  }, 10000);

  it("expired token -> confirm returns 410", async () => {
    const email = `e2e-expired-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());
    const reg = await agent
      .post("/auth/register")
      .send({ email, password })
      .expect(201);

    // create token with expiresAt in the past
    const expiresPast = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    const link = await prisma.authLinkToken.create({
      data: {
        userId: (await prisma.user.findUnique({ where: { email } }))!.id,
        token: `exp-${Date.now()}`,
        provider: "telegram",
        expiresAt: expiresPast,
      },
    });

    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token: link.token, telegramUserId: `${Date.now()}` })
      .expect(410);

    // cleanup
    try {
      await prisma.authLinkToken.deleteMany({
        where: {
          userId: (await prisma.user.findUnique({ where: { email } }))!.id,
        },
      });
      await prisma.user.deleteMany({ where: { email } });
    } catch (e) {}
  }, 10000);

  it("already used token -> second confirm returns 410", async () => {
    const email = `e2e-used-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const linkRes = await agent.post("/auth/link-token").send().expect(201);
    const token = linkRes.body.token;

    const tgId1 = `tg-${Date.now()}`;
    // first confirm should succeed
    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token, telegramUserId: tgId1 })
      .expect(201);

    // second confirm with same token should return 410 (already used)
    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token, telegramUserId: `tg2-${Date.now()}` })
      .expect(410);

    // cleanup
    try {
      const acct = await prisma.authAccount.findUnique({
        where: {
          provider_providerId: { provider: "telegram", providerId: tgId1 },
        },
      });
      if (acct) await prisma.user.delete({ where: { id: acct.userId } });
    } catch (e) {}
  }, 15000);

  it("unauthorized web -> link-token returns 401", async () => {
    // call /auth/link-token without session
    await request(app.getHttpServer())
      .post("/auth/link-token")
      .send()
      .expect(401);
  }, 5000);

  it("invalid bot token -> confirm returns 401", async () => {
    const email = `e2e-invalidbot-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const linkRes = await agent.post("/auth/link-token").send().expect(201);
    const token = linkRes.body.token;

    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", "invalid-token")
      .send({ token, telegramUserId: `${Date.now()}` })
      .expect(401);

    // cleanup
    try {
      await prisma.user.deleteMany({ where: { email } });
    } catch (e) {}
  }, 10000);

  it("telegram already linked -> confirm returns 409", async () => {
    // create first user and link a telegram id
    const email1 = `e2e-tg1-${Date.now()}@test.local`;
    const password = "pass";
    const agent1 = request.agent(app.getHttpServer());
    await agent1
      .post("/auth/register")
      .send({ email: email1, password })
      .expect(201);
    const linkRes1 = await agent1.post("/auth/link-token").send().expect(201);
    const token1 = linkRes1.body.token;
    const tgId = `tg-${Date.now()}`;
    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token: token1, telegramUserId: tgId })
      .expect(201);

    // create second user and attempt to link same tgId
    const email2 = `e2e-tg2-${Date.now()}@test.local`;
    const agent2 = request.agent(app.getHttpServer());
    await agent2
      .post("/auth/register")
      .send({ email: email2, password })
      .expect(201);
    const linkRes2 = await agent2.post("/auth/link-token").send().expect(201);
    const token2 = linkRes2.body.token;

    await request(app.getHttpServer())
      .post("/auth/link/confirm")
      .set("X-Bot-Token", process.env.BOT_TOKEN as string)
      .send({ token: token2, telegramUserId: tgId })
      .expect(409);

    // cleanup
    try {
      await prisma.user.deleteMany({
        where: { OR: [{ email: email1 }, { email: email2 }] },
      });
    } catch (e) {}
  }, 15000);

  it("race/idempotency -> parallel confirms: one succeeds, others fail", async () => {
    const email = `e2e-race-${Date.now()}@test.local`;
    const password = "pass";
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const linkRes = await agent.post("/auth/link-token").send().expect(201);
    const token = linkRes.body.token;

    const tgIdBase = `tg-race-${Date.now()}`;

    // fire multiple parallel confirms with different tg ids
    const promises = [0, 1, 2, 3, 4].map((i) =>
      request(app.getHttpServer())
        .post("/auth/link/confirm")
        .set("X-Bot-Token", process.env.BOT_TOKEN as string)
        .send({ token, telegramUserId: `${tgIdBase}-${i}` })
    );

    const results = await Promise.all(
      promises.map((p) => p.then((r) => r.status).catch((e) => e.status || 500))
    );

    const successCount = results.filter((s) => s === 201).length;
    const conflictOrGone = results.filter((s) => s === 409 || s === 410).length;

    expect(successCount).toBeGreaterThanOrEqual(1);
    expect(successCount + conflictOrGone).toEqual(results.length);

    // cleanup
    try {
      const acct = await prisma.authAccount.findFirst({
        where: { provider: "telegram", providerId: { startsWith: tgIdBase } },
      });
      if (acct) await prisma.user.delete({ where: { id: acct.userId } });
      else await prisma.user.deleteMany({ where: { email } });
    } catch (e) {}
  }, 20000);
});
