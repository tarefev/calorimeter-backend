import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
const cookieParser = require("cookie-parser");
import { sessionMiddleware } from "@/auth/session.middleware";

describe("Rate limit login (e2e)", () => {
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
    await prisma.user
      .deleteMany({ where: { email: { startsWith: "e2e-rate-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("locks after threshold failed attempts", async () => {
    const email = `e2e-rate-${Date.now()}@test.local`;
    const password = "wrong";

    // create user with known password
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "okpass" })
      .expect(201);

    // attempt failed logins threshold times
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password })
        .expect(i < 5 ? 401 : 429);
      if (i >= 5) expect(res.body?.message).toBe("too_many_requests");
    }
  }, 20000);
});
