import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";

describe("PATCH /auth/password (e2e)", () => {
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
    await prisma.authAccount
      .deleteMany({ where: { user: { email: { startsWith: "e2e-pass-" } } } })
      .catch(() => {});
    await prisma.session
      .deleteMany({ where: { user: { email: { startsWith: "e2e-pass-" } } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { startsWith: "e2e-pass-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("changes password, revokes old sessions and issues new session cookie", async () => {
    const email = `e2e-pass-${Date.now()}@test.local`;
    const password = "oldpass";
    const newPassword = "newpass";

    const agent = request.agent(app.getHttpServer());

    // register
    await agent.post("/auth/register").send({ email, password }).expect(201);

    // create an extra session to ensure it will be revoked
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u).toBeTruthy();
    if (!u) return;

    await prisma.session.create({
      data: {
        userId: u.id,
        channel: "web",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    // call change password
    const res = await agent
      .patch("/auth/password")
      .send({ oldPassword: password, newPassword })
      .expect(200);

    // should return user id
    expect(res.body?.id).toBe(u.id);

    // old sessions should be revoked and a new active session should exist
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const revokedCount = sessions.filter((s) => s.revokedAt).length;
    const activeCount = sessions.filter((s) => !s.revokedAt).length;
    expect(revokedCount).toBeGreaterThanOrEqual(1);
    expect(activeCount).toBeGreaterThanOrEqual(1);
  }, 15000);
});
