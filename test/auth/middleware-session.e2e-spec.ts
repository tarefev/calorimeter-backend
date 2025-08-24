import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";

describe("Session middleware (valid/expired/revoked) (e2e)", () => {
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
    await prisma.session
      .deleteMany({ where: { user: { email: { contains: "e2e-mw-" } } } })
      .catch(() => {});
    await prisma.authAccount
      .deleteMany({ where: { user: { email: { contains: "e2e-mw-" } } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { contains: "e2e-mw-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("valid session passes and updates lastSeenAt", async () => {
    const email = `e2e-mw-${Date.now()}@test.local`;
    const password = "pass";

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/register").send({ email, password }).expect(201);

    const u = await prisma.user.findUnique({ where: { email } });
    expect(u).toBeTruthy();
    if (!u) return;

    const session = await prisma.session.create({
      data: {
        userId: u.id,
        channel: "web",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    // call with cookie
    const res1 = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `sid=${session.id}`)
      .expect(200);
    expect(res1.body?.id || res1.body?.user?.id).toBeDefined();

    const before = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(before?.lastSeenAt).toBeTruthy();

    // wait and call again to ensure lastSeenAt updated
    await new Promise((r) => setTimeout(r, 15));
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `sid=${session.id}`)
      .expect(200);
    const after = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(
      after && before && after.lastSeenAt && before.lastSeenAt
    ).toBeTruthy();
    if (after && before)
      expect(new Date(after.lastSeenAt!).getTime()).toBeGreaterThan(
        new Date(before.lastSeenAt!).getTime()
      );
  }, 20000);

  it("expired session is rejected", async () => {
    const email = `e2e-mw-exp-${Date.now()}@test.local`;
    const user = await prisma.user.create({
      data: { email, passwordHash: "" },
    });
    const expired = await prisma.session.create({
      data: {
        userId: user.id,
        channel: "web",
        expiresAt: new Date(Date.now() - 1000),
        lastSeenAt: new Date(Date.now() - 2000),
      },
    });

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `sid=${expired.id}`)
      .expect(401);

    await prisma.session.delete({ where: { id: expired.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it("revoked session is rejected", async () => {
    const email = `e2e-mw-rev-${Date.now()}@test.local`;
    const user = await prisma.user.create({
      data: { email, passwordHash: "" },
    });
    const s = await prisma.session.create({
      data: {
        userId: user.id,
        channel: "web",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });
    await prisma.session.update({
      where: { id: s.id },
      data: { revokedAt: new Date() },
    });

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `sid=${s.id}`)
      .expect(401);

    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});
