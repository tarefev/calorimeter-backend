"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const request = require("supertest");
const app_module_1 = require("@/app.module");
const prismaClient_1 = require("@/prisma/prismaClient");
const session_middleware_1 = require("@/auth/session.middleware");
const cookieParser = require("cookie-parser");
describe("Auth link flow (e2e)", () => {
    let app;
    beforeAll(async () => {
        process.env.BOT_TOKEN = process.env.BOT_TOKEN || "test-bot-token";
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleRef.createNestApplication();
        app.use(cookieParser());
        app.use((0, session_middleware_1.sessionMiddleware)());
        await app.init();
    });
    afterAll(async () => {
        try {
            await prismaClient_1.prisma.authAccount.deleteMany({
                where: { user: { email: { startsWith: "e2e-" } } },
            });
        }
        catch (e) { }
        try {
            await prismaClient_1.prisma.authLinkToken.deleteMany({
                where: { user: { email: { startsWith: "e2e-" } } },
            });
        }
        catch (e) { }
        try {
            await prismaClient_1.prisma.user.deleteMany({
                where: { email: { startsWith: "e2e-" } },
            });
        }
        catch (e) { }
        await app.close();
        await prismaClient_1.prisma.$disconnect();
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
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token, telegramUserId: tgId })
            .expect(201);
        const acct = await prismaClient_1.prisma.authAccount.findUnique({
            where: {
                provider_providerId: { provider: "telegram", providerId: tgId },
            },
        });
        expect(acct).not.toBeNull();
        try {
            if (acct) {
                await prismaClient_1.prisma.user.delete({ where: { id: acct.userId } });
            }
            else {
                await prismaClient_1.prisma.user.deleteMany({ where: { email } });
            }
        }
        catch (e) {
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
        await request(app.getHttpServer())
            .post("/auth/link/confirm")
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token: "NOTEXIST", telegramUserId: `${Date.now()}` })
            .expect(404);
        try {
            await prismaClient_1.prisma.user.deleteMany({ where: { email } });
        }
        catch (e) { }
    }, 10000);
    it("expired token -> confirm returns 410", async () => {
        const email = `e2e-expired-${Date.now()}@test.local`;
        const password = "pass";
        const agent = request.agent(app.getHttpServer());
        const reg = await agent
            .post("/auth/register")
            .send({ email, password })
            .expect(201);
        const expiresPast = new Date(Date.now() - 1000 * 60 * 60);
        const link = await prismaClient_1.prisma.authLinkToken.create({
            data: {
                userId: (await prismaClient_1.prisma.user.findUnique({ where: { email } })).id,
                token: `exp-${Date.now()}`,
                provider: "telegram",
                expiresAt: expiresPast,
            },
        });
        await request(app.getHttpServer())
            .post("/auth/link/confirm")
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token: link.token, telegramUserId: `${Date.now()}` })
            .expect(410);
        try {
            await prismaClient_1.prisma.authLinkToken.deleteMany({
                where: {
                    userId: (await prismaClient_1.prisma.user.findUnique({ where: { email } })).id,
                },
            });
            await prismaClient_1.prisma.user.deleteMany({ where: { email } });
        }
        catch (e) { }
    }, 10000);
    it("already used token -> second confirm returns 410", async () => {
        const email = `e2e-used-${Date.now()}@test.local`;
        const password = "pass";
        const agent = request.agent(app.getHttpServer());
        await agent.post("/auth/register").send({ email, password }).expect(201);
        const linkRes = await agent.post("/auth/link-token").send().expect(201);
        const token = linkRes.body.token;
        const tgId1 = `tg-${Date.now()}`;
        await request(app.getHttpServer())
            .post("/auth/link/confirm")
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token, telegramUserId: tgId1 })
            .expect(201);
        await request(app.getHttpServer())
            .post("/auth/link/confirm")
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token, telegramUserId: `tg2-${Date.now()}` })
            .expect(410);
        try {
            const acct = await prismaClient_1.prisma.authAccount.findUnique({
                where: {
                    provider_providerId: { provider: "telegram", providerId: tgId1 },
                },
            });
            if (acct)
                await prismaClient_1.prisma.user.delete({ where: { id: acct.userId } });
        }
        catch (e) { }
    }, 15000);
    it("unauthorized web -> link-token returns 401", async () => {
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
        try {
            await prismaClient_1.prisma.user.deleteMany({ where: { email } });
        }
        catch (e) { }
    }, 10000);
    it("telegram already linked -> confirm returns 409", async () => {
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
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token: token1, telegramUserId: tgId })
            .expect(201);
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
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token: token2, telegramUserId: tgId })
            .expect(409);
        try {
            await prismaClient_1.prisma.user.deleteMany({
                where: { OR: [{ email: email1 }, { email: email2 }] },
            });
        }
        catch (e) { }
    }, 15000);
    it("race/idempotency -> parallel confirms: one succeeds, others fail", async () => {
        const email = `e2e-race-${Date.now()}@test.local`;
        const password = "pass";
        const agent = request.agent(app.getHttpServer());
        await agent.post("/auth/register").send({ email, password }).expect(201);
        const linkRes = await agent.post("/auth/link-token").send().expect(201);
        const token = linkRes.body.token;
        const tgIdBase = `tg-race-${Date.now()}`;
        const promises = [0, 1, 2, 3, 4].map((i) => request(app.getHttpServer())
            .post("/auth/link/confirm")
            .set("X-Bot-Token", process.env.BOT_TOKEN)
            .send({ token, telegramUserId: `${tgIdBase}-${i}` }));
        const results = await Promise.all(promises.map((p) => p.then((r) => r.status).catch((e) => e.status || 500)));
        const successCount = results.filter((s) => s === 201).length;
        const conflictOrGone = results.filter((s) => s === 409 || s === 410).length;
        expect(successCount).toBeGreaterThanOrEqual(1);
        expect(successCount + conflictOrGone).toEqual(results.length);
        try {
            const acct = await prismaClient_1.prisma.authAccount.findFirst({
                where: { provider: "telegram", providerId: { startsWith: tgIdBase } },
            });
            if (acct)
                await prismaClient_1.prisma.user.delete({ where: { id: acct.userId } });
            else
                await prismaClient_1.prisma.user.deleteMany({ where: { email } });
        }
        catch (e) { }
    }, 20000);
});
//# sourceMappingURL=link-flow.e2e-spec.js.map