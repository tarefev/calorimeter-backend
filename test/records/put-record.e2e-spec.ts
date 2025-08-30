import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("PUT /records/:date (e2e)", () => {
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

  it("replaces the entire record for the date", async () => {
    const email = `e2e-put-record-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-28";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    // seed via POST
    await agent
      .post("/records")
      .send({
        date,
        water: [{ amountMl: 100 }],
        food: [],
        activity: [],
        exercise: [],
        metric: null,
        sleep: null,
      })
      .expect(200);

    // replace via PUT
    const body = {
      water: [{ amountMl: 400 }],
      food: [],
      activity: [],
      exercise: [],
      metric: { caloriesIn: 900 },
      sleep: null,
    };
    const putRes = await agent.put(`/records/${date}`).send(body).expect(200);
    expect(putRes.headers["etag"]).toBeDefined();
    expect(putRes.body.date).toBe(date);
    expect(putRes.body.water.length).toBe(1);
    expect(
      putRes.body.water[0].amount_ml || putRes.body.water[0].amountMl
    ).toBeDefined();

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.water.length).toBe(1);
  }, 20000);
});
