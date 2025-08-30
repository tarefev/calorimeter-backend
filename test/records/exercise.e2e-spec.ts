import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("exercise sub-resources (e2e)", () => {
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

  it("POST /records/:date/exercise → creates exercise item", async () => {
    const email = `e2e-exercise-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-08";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const createRes = await agent
      .post(`/records/${date}/exercise`)
      .send({ name: "Squat", sets: 3, reps: 10 })
      .expect(200);
    expect(createRes.body.id).toBeDefined();

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.exercise.length).toBe(1);
  }, 20000);

  it("PATCH /exercise/:id → updates sets", async () => {
    const email = `e2e-exercise-patch-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-09";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/exercise`)
      .send({ name: "Bench", sets: 4, reps: 8 })
      .expect(200);
    const id = created.body.id;

    await agent.patch(`/exercise/${id}`).send({ sets: 5 }).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    const item = getRes.body.exercise.find((e: any) => e.id === id);
    expect(item.sets).toBe(5);
  }, 20000);

  it("DELETE /exercise/:id → removes item", async () => {
    const email = `e2e-exercise-delete-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-10";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/exercise`)
      .send({ name: "Row", sets: 3, reps: 12 })
      .expect(200);
    const id = created.body.id;

    await agent.delete(`/exercise/${id}`).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.exercise.find((e: any) => e.id === id)).toBeUndefined();
  }, 20000);
});
