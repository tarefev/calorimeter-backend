import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("GET /records/:date (e2e)", () => {
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

  it("returns minimal payload with totals when no record exists", async () => {
    const email = `e2e-records-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-25";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const res = await agent.get(`/records/${date}`).expect(200);
    expect(res.body.dtype).toBe("day_record_v1");
    expect(res.body.date).toBe(date);
    expect(res.body.totals).toBeDefined();
    expect(res.headers["etag"]).toBeDefined();
  }, 20000);
});
