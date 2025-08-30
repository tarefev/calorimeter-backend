import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import { sessionMiddleware } from "@/auth/session.middleware";
import cleanupE2E from "@/helpers/e2eCleanup";

describe("food sub-resources (e2e)", () => {
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

  it("POST /records/:date/food → creates food item", async () => {
    const email = `e2e-food-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-02";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const createRes = await agent
      .post(`/records/${date}/food`)
      .send({ name: "Apple", calories: 52 })
      .expect(200);
    expect(createRes.body.id).toBeDefined();

    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.food.length).toBe(1);
  }, 20000);

  it("PATCH /food/:id → updates calories", async () => {
    const email = `e2e-food-patch-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-03";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/food`)
      .send({ name: "Bread", calories: 200 })
      .expect(200);
    const foodId = created.body.id;

    await agent.patch(`/food/${foodId}`).send({ calories: 180 }).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    const item = getRes.body.food.find((f: any) => f.id === foodId);
    expect(item.calories).toBe(180);
  }, 20000);

  it("DELETE /food/:id → removes item", async () => {
    const email = `e2e-food-delete-${Date.now()}@test.local`;
    const password = "pass";
    const date = "2025-09-04";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);
    const created = await agent
      .post(`/records/${date}/food`)
      .send({ name: "Cheese", calories: 300 })
      .expect(200);
    const foodId = created.body.id;

    await agent.delete(`/food/${foodId}`).expect(200);
    const getRes = await agent.get(`/records/${date}`).expect(200);
    expect(getRes.body.food.find((f: any) => f.id === foodId)).toBeUndefined();
  }, 20000);
});
