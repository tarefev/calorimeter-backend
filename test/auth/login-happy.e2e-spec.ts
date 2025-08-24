import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";

describe("POST /auth/login (happy path) (e2e)", () => {
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
    await prisma.authAccount
      .deleteMany({ where: { user: { email: { startsWith: "e2e-login-" } } } })
      .catch(() => {});
    await prisma.session
      .deleteMany({ where: { user: { email: { startsWith: "e2e-login-" } } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { startsWith: "e2e-login-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("returns cookie and creates session", async () => {
    const email = `e2e-login-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());

    // register
    await agent.post("/auth/register").send({ email, password }).expect(201);

    // login
    const res = await agent
      .post("/auth/login")
      .send({ email, password })
      .expect(200);

    // cookie should be set
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();

    // session should exist in DB
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u).toBeTruthy();
    if (!u) return;
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
