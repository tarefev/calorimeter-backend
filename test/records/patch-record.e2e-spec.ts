import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("PATCH /records/:date (e2e)", () => {
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

  it("applies water upsert/delete atomically", async () => {
    const email = `e2e-patch-record-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-29";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    // seed via POST with single water item
    const seed = await agent
      .post("/records")
      .send({
        date,
        water: [{ amountMl: 200 }],
        food: [],
        activity: [],
        exercise: [],
        metric: null,
        sleep: null,
      })
      .expect(200);

    const firstWaterId = seed.body.water[0].id;

    // PATCH: delete first, upsert another
    const patchBody = {
      water: {
        delete: [firstWaterId],
        upsert: [{ amountMl: 500 }],
      },
    };

    const patchRes = await agent
      .patch(`/records/${date}`)
      .send(patchBody)
      .expect(200);
    expect(patchRes.body.water.length).toBe(1);
    expect(
      patchRes.body.water[0].amount_ml || patchRes.body.water[0].amountMl
    ).toBeDefined();
    expect(patchRes.body.water[0].id).not.toBe(firstWaterId);

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.water.length).toBe(1);
  }, 20000);
});
