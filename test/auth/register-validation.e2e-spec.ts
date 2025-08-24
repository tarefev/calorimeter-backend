import { Test } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { prisma } from "@/prisma/prismaClient";
import * as cookieParser from "cookie-parser";
import { sessionMiddleware } from "@/auth/session.middleware";

describe("POST /auth/register validation (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(sessionMiddleware());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            message: "validation_error",
            errors: errors.map((e) => ({
              field: e.property,
              errors: Object.values(e.constraints || {}),
            })),
          }),
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await prisma.user
      .deleteMany({ where: { email: { contains: "e2e-invalid-" } } })
      .catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  it("rejects invalid email", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "not-an-email", password: "pass" })
      .expect(400)
      .then((res) => {
        expect(res.body?.message).toBe("validation_error");
      });
  });

  it("rejects empty password", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: `e2e-invalid-${Date.now()}@test.local`, password: "" })
      .expect(400)
      .then((res) => {
        expect(res.body?.message).toBe("validation_error");
      });
  });
});
