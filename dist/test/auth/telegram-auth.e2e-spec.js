"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const request = require("supertest");
const cookieParser = require("cookie-parser");
const app_module_1 = require("@/app.module");
const session_middleware_1 = require("@/auth/session.middleware");
const prismaClient_1 = require("@/prisma/prismaClient");
describe("6.5 Telegram auth via headers (bot) (e2e)", () => {
    let app;
    const E2E_BOT_TOKEN = "E2E_BOT_TOKEN";
    const tgId1 = "999000001";
    const tgId2 = "999000002";
    beforeAll(async () => {
        process.env.BOT_TOKEN = E2E_BOT_TOKEN;
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleRef.createNestApplication();
        app.use(cookieParser());
        app.use((0, session_middleware_1.sessionMiddleware)());
        await app.init();
        await prismaClient_1.prisma.authAccount.deleteMany({
            where: { provider: "telegram", providerId: { in: [tgId1, tgId2] } },
        });
        await prismaClient_1.prisma.user.deleteMany({
            where: {
                email: { in: [`tg-${tgId1}@tg.local`, `tg-${tgId2}@tg.local`] },
            },
        });
    });
    afterAll(async () => {
        await prismaClient_1.prisma.session.deleteMany({
            where: {
                user: { email: { contains: "@tg.local" } },
                channel: "telegram",
            },
        });
        await prismaClient_1.prisma.authAccount.deleteMany({
            where: { provider: "telegram", providerId: { in: [tgId1, tgId2] } },
        });
        await prismaClient_1.prisma.user.deleteMany({
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
        const acct = await prismaClient_1.prisma.authAccount.findUnique({
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
        const res = await request(app.getHttpServer())
            .get("/auth/me")
            .set("X-Bot-Token", E2E_BOT_TOKEN)
            .set("X-Telegram-User-Id", tgId1)
            .expect(200);
        const userId = res.body?.user?.id;
        await request(app.getHttpServer())
            .get("/auth/me")
            .set("X-Bot-Token", E2E_BOT_TOKEN)
            .set("X-Telegram-User-Id", tgId1)
            .expect(200);
        const sessions = await prismaClient_1.prisma.session.findMany({
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
        const userId = res.body?.user?.id;
        const before = await prismaClient_1.prisma.session.findFirstOrThrow({
            where: { userId, channel: "telegram" },
            orderBy: { createdAt: "desc" },
        });
        await new Promise((r) => setTimeout(r, 15));
        await request(app.getHttpServer())
            .get("/auth/me")
            .set("X-Bot-Token", E2E_BOT_TOKEN)
            .set("X-Telegram-User-Id", tgId1)
            .expect(200);
        const after = await prismaClient_1.prisma.session.findFirstOrThrow({
            where: { userId, channel: "telegram" },
            orderBy: { createdAt: "desc" },
        });
        expect(after.lastSeenAt && before.lastSeenAt).toBeTruthy();
        expect(new Date(after.lastSeenAt).getTime()).toBeGreaterThan(new Date(before.lastSeenAt).getTime());
    });
    it("6.5.7 Expired/revoked cookie session is rejected (no headers)", async () => {
        const email = `e2e-cookie-expired-${Date.now()}@example.com`;
        const user = await prismaClient_1.prisma.user.create({
            data: { email, passwordHash: "" },
        });
        const expired = await prismaClient_1.prisma.session.create({
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
        await prismaClient_1.prisma.session.update({
            where: { id: expired.id },
            data: { revokedAt: new Date() },
        });
        await request(app.getHttpServer())
            .get("/auth/me")
            .set("Cookie", `${cookieName}=${expired.id}`)
            .expect(401);
        await prismaClient_1.prisma.user.delete({ where: { id: user.id } });
    });
});
//# sourceMappingURL=telegram-auth.e2e-spec.js.map