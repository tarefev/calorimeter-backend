import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("activity sub-resources (e2e)", () => {
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

  it("POST /records/:date/activity → creates activity item", async () => {
    const email = `e2e-activity-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-05";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const createRes = await agent
      .post(`/records/${date}/activity`)
      .send({ type: "walking", durationMin: 30 })
      .expect(200);
    expect(createRes.body.id).toBeDefined();

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.activity.length).toBe(1);
  }, 20000);

  it("PATCH /activity/:id → updates duration", async () => {
    const email = `e2e-activity-patch-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-06";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/activity`)
      .send({ type: "run", durationMin: 20 })
      .expect(200);
    const activityId = created.body.id;

    await agent
      .patch(`/activity/${activityId}`)
      .send({ durationMin: 45 })
      .expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    const item = getRes.body.activity.find((a: any) => a.id === activityId);
    expect(item.duration_min ?? item.durationMin).toBe(45);
  }, 20000);

  it("DELETE /activity/:id → removes item", async () => {
    const email = `e2e-activity-delete-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-07";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/activity`)
      .send({ type: "bike", durationMin: 60 })
      .expect(200);
    const activityId = created.body.id;

    await agent.delete(`/activity/${activityId}`).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(
      getRes.body.activity.find((a: any) => a.id === activityId)
    ).toBeUndefined();
  }, 20000);
});
