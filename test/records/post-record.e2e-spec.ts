import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("POST /records (e2e)", () => {
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

  it("creates a new day record with water item (happy path)", async () => {
    const email = `e2e-post-record-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-26";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const body = {
      date,
      metric: null,
      water: [{ amountMl: 250 }],
      food: [],
      activity: [],
      exercise: [],
      sleep: null,
    };

    const postRes = await agent.post("/records").send(body).expect(200);
    expect(postRes.headers["etag"]).toBeDefined();
    expect(postRes.body.dtype).toBe("day_record_v1");
    expect(postRes.body.date).toBe(date);
    expect(Array.isArray(postRes.body.water)).toBe(true);
    expect(postRes.body.water.length).toBe(1);
    expect(postRes.body.water[0].id).toBeDefined();

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.date).toBe(date);
    expect(getRes.body.water.length).toBe(1);
  }, 20000);

  it("is idempotent by user+date (repeat POST replaces to the same state)", async () => {
    const email = `e2e-post-record-idem-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-27";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const body = {
      date,
      metric: { caloriesIn: 1200 },
      water: [{ amountMl: 300 }, { amountMl: 200 }],
      food: [],
      activity: [],
      exercise: [],
      sleep: null,
    };

    const first = await agent.post("/records").send(body).expect(200);
    const second = await agent.post("/records").send(body).expect(200);

    expect(first.body.date).toBe(date);
    expect(second.body.date).toBe(date);
    expect(second.body.water.length).toBe(2);
    // Totals should be consistent after repeated POST
    expect(second.body.totals).toBeDefined();
  }, 20000);
});
