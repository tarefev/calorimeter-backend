import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("POST /auth/logout (current session) (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(sessionMiddleware());
    await app.init();
  });

  afterAll(async () => {
    await cleanupE2E(prisma).catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("revokes only current session and clears cookie", async () => {
    const email = `e2e-logoutcur-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());

    // register and have initial session
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const u = await prisma.user.findUnique({ where: { email } });
    expect(u).toBeTruthy();
    if (!u) return;

    // create an extra session (different id)
    await prisma.session.create({
      data: {
        userId: u.id,
        channel: "web",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    // logout current
    await agent.post("/auth/logout").expect(204);

    // current agent's cookie cleared; check DB: at least one session revoked
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.some((s) => s.revokedAt)).toBeTruthy();
  }, 15000);
});
