import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("water sub-resources (e2e)", () => {
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

  it("POST /records/:date/water → creates water item", async () => {
    const email = `e2e-water-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-30";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const createRes = await agent
      .post(`/records/${date}/water`)
      .send({ amountMl: 250 })
      .expect(200);
    expect(createRes.body.id).toBeDefined();

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.water.length).toBe(1);
  }, 20000);

  it("PATCH /water/:id → updates amount", async () => {
    const email = `e2e-water-patch-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-08-31";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/water`)
      .send({ amountMl: 300 })
      .expect(200);
    const waterId = created.body.id;

    await agent.patch(`/water/${waterId}`).send({ amountMl: 500 }).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    const item = getRes.body.water.find((w: any) => w.id === waterId);
    expect(item.amount_ml ?? item.amountMl).toBe(500);
  }, 20000);

  it("DELETE /water/:id → removes item", async () => {
    const email = `e2e-water-delete-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-01";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/water`)
      .send({ amountMl: 200 })
      .expect(200);
    const waterId = created.body.id;

    await agent.delete(`/water/${waterId}`).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(
      getRes.body.water.find((w: any) => w.id === waterId)
    ).toBeUndefined();
  }, 20000);
});
