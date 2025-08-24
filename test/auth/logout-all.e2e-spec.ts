import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";

describe("POST /auth/logout/all (e2e)", () => {
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
    await prisma.session
      .deleteMany({
        where: { user: { email: { startsWith: "e2e-logoutall-" } } },
      })
      .catch(() => {});
    await prisma.authAccount
      .deleteMany({
        where: { user: { email: { startsWith: "e2e-logoutall-" } } },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { startsWith: "e2e-logoutall-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("revokes all sessions for user and clears cookie", async () => {
    const email = `e2e-logoutall-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());

    // register
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const u = await prisma.user.findUnique({ where: { email } });
    expect(u).toBeTruthy();
    if (!u) return;

    // create extra sessions
    await prisma.session.createMany({
      data: [
        {
          userId: u.id,
          channel: "web",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
        {
          userId: u.id,
          channel: "web",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
        },
      ],
    });

    // call logout all
    await agent.post("/auth/logout/all").expect(204);

    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.every((s) => s.revokedAt)).toBeTruthy();
  }, 20000);
});
