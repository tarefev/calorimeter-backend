import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";

describe("GET /auth/me (web cookie) (e2e)", () => {
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
      .deleteMany({ where: { user: { email: { contains: "e2e-me-" } } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { contains: "e2e-me-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("returns user info when cookie present", async () => {
    const email = `e2e-me-${Date.now()}@test.local`;
    const password = "pass";
    const agent = request.agent(app.getHttpServer());

    await agent.post("/auth/register").send({ email, password }).expect(201);

    const res = await agent.get("/auth/me").expect(200);
    expect(res.body?.id || res.body?.user?.id).toBeDefined();
  });

  it("returns 401 when no cookie", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });
});
