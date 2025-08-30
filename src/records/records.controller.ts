import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedRequest } from "@/auth/session.middleware";
import { fetchDayRecordWithChildren } from "@/records/mapper/queries";
import { mapDayRecordToJson } from "@/records/mapper/dayRecord.mapper";
import { prisma } from "@/prisma/prismaClient";

@ApiTags("records")
@ApiBearerAuth()
@Controller("records")
export class RecordsController {
  @ApiOperation({ summary: "Replace entire day record by date" })
  @ApiParam({ name: "date", example: "2025-09-01" })
  @ApiBody({
    description: "Full day record payload; omitting collection creates empty",
    schema: {
      type: "object",
      properties: {
        metric: {
          type: "object",
          properties: {
            caloriesIn: { type: "number" },
            caloriesOut: { type: "number" },
            weightKg: { type: "number" },
            bodyFatPct: { type: "number" },
            proteinG: { type: "number" },
            carbsG: { type: "number" },
            fatG: { type: "number" },
          },
        },
        water: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amountMl: { type: "number" },
              notedAt: { type: "string", format: "date-time" },
              timeLocal: { type: "string", nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Returns mapped day record JSON with ETag header",
  })
  @Put(":date")
  async replaceRecord(
    @Param("date") dateParam: string,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    }

    const dateIso = dateParam;
    const date = new Date(`${dateIso}T00:00:00.000Z`);

    await prisma.$transaction(async (tx) => {
      const day = await tx.dayRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
      });

      // Replace all children using provided body
      await tx.metric.deleteMany({ where: { dayRecordId: day.id } });
      await tx.water.deleteMany({ where: { dayRecordId: day.id } });
      await tx.food.deleteMany({ where: { dayRecordId: day.id } });
      await tx.activity.deleteMany({ where: { dayRecordId: day.id } });
      await tx.exercise.deleteMany({ where: { dayRecordId: day.id } });
      await tx.sleep.deleteMany({ where: { dayRecordId: day.id } });

      if (body?.metric) {
        await tx.metric.create({
          data: { dayRecordId: day.id, ...body.metric },
        });
      }
      if (Array.isArray(body?.water)) {
        for (const w of body.water) {
          await tx.water.create({
            data: {
              dayRecordId: day.id,
              amountMl: Number(w.amountMl) || 0,
              notedAt: w?.notedAt ? new Date(w.notedAt) : undefined,
              timeLocal: w?.timeLocal ?? null,
            },
          });
        }
      }
      if (Array.isArray(body?.food)) {
        for (const f of body.food) {
          await tx.food.create({
            data: {
              dayRecordId: day.id,
              name: String(f.name ?? "food"),
              calories: Number(f.calories) || 0,
              proteinG: f?.proteinG ?? null,
              carbsG: f?.carbsG ?? null,
              fatG: f?.fatG ?? null,
              kcalPer100G: f?.kcalPer100G ?? null,
              proteinPer100G: f?.proteinPer100G ?? null,
              fatPer100G: f?.fatPer100G ?? null,
              carbsPer100G: f?.carbsPer100G ?? null,
              weightG: f?.weightG ?? null,
              notedAt: f?.notedAt ? new Date(f.notedAt) : null,
              timeLocal: f?.timeLocal ?? null,
            },
          });
        }
      }
      if (Array.isArray(body?.activity)) {
        for (const a of body.activity) {
          await tx.activity.create({
            data: {
              dayRecordId: day.id,
              type: String(a?.type ?? "activity"),
              durationMin: a?.durationMin ?? null,
              calories: a?.calories ?? null,
              intensity: a?.intensity ?? null,
              notedAt: a?.notedAt ? new Date(a.notedAt) : null,
              timeLocal: a?.timeLocal ?? null,
            },
          });
        }
      }
      if (Array.isArray(body?.exercise)) {
        for (const e of body.exercise) {
          await tx.exercise.create({
            data: {
              dayRecordId: day.id,
              name: String(e?.name ?? "exercise"),
              sets: e?.sets ?? null,
              reps: e?.reps ?? null,
              weightKg: e?.weightKg ?? null,
              durationMin: e?.durationMin ?? null,
              calories: e?.calories ?? null,
              notedAt: e?.notedAt ? new Date(e.notedAt) : null,
              timeLocal: e?.timeLocal ?? null,
            },
          });
        }
      }
      if (body?.sleep) {
        await tx.sleep.create({
          data: {
            dayRecordId: day.id,
            startAt: body.sleep.startAt
              ? new Date(body.sleep.startAt)
              : new Date(`${dateIso}T00:00:00.000Z`),
            endAt: body.sleep.endAt
              ? new Date(body.sleep.endAt)
              : new Date(`${dateIso}T00:00:00.000Z`),
            startLocal: body.sleep.startLocal ?? null,
            endLocal: body.sleep.endLocal ?? null,
            quality: body.sleep.quality ?? null,
          },
        });
      }

      await tx.dayRecord.update({
        where: { id: day.id },
        data: { updatedAt: new Date() },
      });
    });

    const dayFull = await fetchDayRecordWithChildren(userId, date);
    const mapped = mapDayRecordToJson(dayFull as any);
    if (mapped?.etag) res.setHeader("ETag", mapped.etag);
    return res.status(200).json(mapped);
  }

  @ApiOperation({ summary: "Patch day record collections by date" })
  @ApiParam({ name: "date", example: "2025-09-01" })
  @ApiBody({
    description:
      "Partial update payload, e.g. { water: { delete:[], upsert:[] } }",
    schema: {
      type: "object",
      properties: {
        water: {
          type: "object",
          properties: {
            delete: { type: "array", items: { type: "string" } },
            upsert: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", nullable: true },
                  amountMl: { type: "number" },
                  notedAt: { type: "string", format: "date-time" },
                  timeLocal: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        food: {
          type: "object",
          properties: {
            delete: { type: "array", items: { type: "string" } },
            upsert: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", nullable: true },
                  name: { type: "string" },
                  calories: { type: "number" },
                  proteinG: { type: "number", nullable: true },
                  carbsG: { type: "number", nullable: true },
                  fatG: { type: "number", nullable: true },
                  weightG: { type: "number", nullable: true },
                  notedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  timeLocal: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        activity: {
          type: "object",
          properties: {
            delete: { type: "array", items: { type: "string" } },
            upsert: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", nullable: true },
                  type: { type: "string" },
                  durationMin: { type: "number", nullable: true },
                  calories: { type: "number", nullable: true },
                  intensity: { type: "string", nullable: true },
                  notedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  timeLocal: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        exercise: {
          type: "object",
          properties: {
            delete: { type: "array", items: { type: "string" } },
            upsert: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", nullable: true },
                  name: { type: "string" },
                  sets: { type: "number", nullable: true },
                  reps: { type: "number", nullable: true },
                  weightKg: { type: "number", nullable: true },
                  durationMin: { type: "number", nullable: true },
                  calories: { type: "number", nullable: true },
                  notedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  timeLocal: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Returns mapped day record JSON with ETag header",
  })
  @Patch(":date")
  async patchRecord(
    @Param("date") dateParam: string,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    }
    const dateIso = dateParam;
    const date = new Date(`${dateIso}T00:00:00.000Z`);

    await prisma.$transaction(async (tx) => {
      const day = await tx.dayRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
      });

      // Water collection upsert/delete
      if (body?.water) {
        const w = body.water;
        if (Array.isArray(w.delete) && w.delete.length > 0) {
          await tx.water.deleteMany({
            where: { dayRecordId: day.id, id: { in: w.delete } },
          });
        }
        if (Array.isArray(w.upsert)) {
          for (const item of w.upsert) {
            if (item.id) {
              await tx.water.upsert({
                where: { id: item.id },
                update: {
                  amountMl: item.amountMl ?? undefined,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : undefined,
                  timeLocal: item?.timeLocal ?? undefined,
                },
                create: {
                  dayRecordId: day.id,
                  amountMl: Number(item.amountMl) || 0,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : undefined,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            } else {
              await tx.water.create({
                data: {
                  dayRecordId: day.id,
                  amountMl: Number(item.amountMl) || 0,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : undefined,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            }
          }
        }
      }

      // Food collection upsert/delete
      if (body?.food) {
        const f = body.food;
        if (Array.isArray(f.delete) && f.delete.length > 0) {
          await tx.food.deleteMany({
            where: { dayRecordId: day.id, id: { in: f.delete } },
          });
        }
        if (Array.isArray(f.upsert)) {
          for (const item of f.upsert) {
            if (item.id) {
              await tx.food.upsert({
                where: { id: item.id },
                update: {
                  name: item?.name ?? undefined,
                  calories: item?.calories ?? undefined,
                  proteinG: item?.proteinG ?? undefined,
                  carbsG: item?.carbsG ?? undefined,
                  fatG: item?.fatG ?? undefined,
                  kcalPer100G: item?.kcalPer100G ?? undefined,
                  proteinPer100G: item?.proteinPer100G ?? undefined,
                  fatPer100G: item?.fatPer100G ?? undefined,
                  carbsPer100G: item?.carbsPer100G ?? undefined,
                  weightG: item?.weightG ?? undefined,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : undefined,
                  timeLocal: item?.timeLocal ?? undefined,
                },
                create: {
                  dayRecordId: day.id,
                  name: String(item?.name ?? "food"),
                  calories: Number(item?.calories) || 0,
                  proteinG: item?.proteinG ?? null,
                  carbsG: item?.carbsG ?? null,
                  fatG: item?.fatG ?? null,
                  kcalPer100G: item?.kcalPer100G ?? null,
                  proteinPer100G: item?.proteinPer100G ?? null,
                  fatPer100G: item?.fatPer100G ?? null,
                  carbsPer100G: item?.carbsPer100G ?? null,
                  weightG: item?.weightG ?? null,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : null,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            } else {
              await tx.food.create({
                data: {
                  dayRecordId: day.id,
                  name: String(item?.name ?? "food"),
                  calories: Number(item?.calories) || 0,
                  proteinG: item?.proteinG ?? null,
                  carbsG: item?.carbsG ?? null,
                  fatG: item?.fatG ?? null,
                  kcalPer100G: item?.kcalPer100G ?? null,
                  proteinPer100G: item?.proteinPer100G ?? null,
                  fatPer100G: item?.fatPer100G ?? null,
                  carbsPer100G: item?.carbsPer100G ?? null,
                  weightG: item?.weightG ?? null,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : null,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            }
          }
        }
      }

      // Activity collection upsert/delete
      if (body?.activity) {
        const a = body.activity;
        if (Array.isArray(a.delete) && a.delete.length > 0) {
          await tx.activity.deleteMany({
            where: { dayRecordId: day.id, id: { in: a.delete } },
          });
        }
        if (Array.isArray(a.upsert)) {
          for (const item of a.upsert) {
            if (item.id) {
              await tx.activity.upsert({
                where: { id: item.id },
                update: {
                  type: item?.type ?? undefined,
                  durationMin: item?.durationMin ?? undefined,
                  calories: item?.calories ?? undefined,
                  intensity: item?.intensity ?? undefined,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : undefined,
                  timeLocal: item?.timeLocal ?? undefined,
                },
                create: {
                  dayRecordId: day.id,
                  type: String(item?.type ?? "activity"),
                  durationMin: item?.durationMin ?? null,
                  calories: item?.calories ?? null,
                  intensity: item?.intensity ?? null,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : null,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            } else {
              await tx.activity.create({
                data: {
                  dayRecordId: day.id,
                  type: String(item?.type ?? "activity"),
                  durationMin: item?.durationMin ?? null,
                  calories: item?.calories ?? null,
                  intensity: item?.intensity ?? null,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : null,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            }
          }
        }
      }

      // Exercise collection upsert/delete
      if (body?.exercise) {
        const e = body.exercise;
        if (Array.isArray(e.delete) && e.delete.length > 0) {
          await tx.exercise.deleteMany({
            where: { dayRecordId: day.id, id: { in: e.delete } },
          });
        }
        if (Array.isArray(e.upsert)) {
          for (const item of e.upsert) {
            if (item.id) {
              await tx.exercise.upsert({
                where: { id: item.id },
                update: {
                  name: item?.name ?? undefined,
                  sets: item?.sets ?? undefined,
                  reps: item?.reps ?? undefined,
                  weightKg: item?.weightKg ?? undefined,
                  durationMin: item?.durationMin ?? undefined,
                  calories: item?.calories ?? undefined,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : undefined,
                  timeLocal: item?.timeLocal ?? undefined,
                },
                create: {
                  dayRecordId: day.id,
                  name: String(item?.name ?? "exercise"),
                  sets: item?.sets ?? null,
                  reps: item?.reps ?? null,
                  weightKg: item?.weightKg ?? null,
                  durationMin: item?.durationMin ?? null,
                  calories: item?.calories ?? null,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : null,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            } else {
              await tx.exercise.create({
                data: {
                  dayRecordId: day.id,
                  name: String(item?.name ?? "exercise"),
                  sets: item?.sets ?? null,
                  reps: item?.reps ?? null,
                  weightKg: item?.weightKg ?? null,
                  durationMin: item?.durationMin ?? null,
                  calories: item?.calories ?? null,
                  notedAt: item?.notedAt ? new Date(item.notedAt) : null,
                  timeLocal: item?.timeLocal ?? null,
                },
              });
            }
          }
        }
      }

      await tx.dayRecord.update({
        where: { id: day.id },
        data: { updatedAt: new Date() },
      });
    });

    const dayFull = await fetchDayRecordWithChildren(userId, date);
    const mapped = mapDayRecordToJson(dayFull as any);
    if (mapped?.etag) res.setHeader("ETag", mapped.etag);
    return res.status(200).json(mapped);
  }
  @ApiOperation({ summary: "Upsert day record by date (idempotent)" })
  @ApiBody({
    description:
      "Upsert payload must include date, may include metric and collections",
    schema: {
      type: "object",
      required: ["date"],
      properties: {
        date: { type: "string", example: "2025-09-01" },
        metric: { type: "object" },
        water: { type: "array", items: { type: "object" } },
        food: { type: "array", items: { type: "object" } },
        activity: { type: "array", items: { type: "object" } },
        exercise: { type: "array", items: { type: "object" } },
        sleep: { type: "object", nullable: true },
      },
    },
  })
  @ApiOkResponse({
    description: "Returns mapped day record JSON with ETag header",
  })
  @Post()
  async upsertRecord(
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    }

    const dateIso: string = body?.date;
    if (!dateIso || typeof dateIso !== "string") {
      throw new HttpException("invalid_date", HttpStatus.BAD_REQUEST);
    }
    const date = new Date(`${dateIso}T00:00:00.000Z`);

    await prisma.$transaction(async (tx) => {
      // Ensure day record exists (or create)
      const day = await tx.dayRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
      });

      // Replace strategy: wipe children and recreate from body
      await tx.metric.deleteMany({ where: { dayRecordId: day.id } });
      await tx.water.deleteMany({ where: { dayRecordId: day.id } });
      await tx.food.deleteMany({ where: { dayRecordId: day.id } });
      await tx.activity.deleteMany({ where: { dayRecordId: day.id } });
      await tx.exercise.deleteMany({ where: { dayRecordId: day.id } });
      await tx.sleep.deleteMany({ where: { dayRecordId: day.id } });

      // Create new children from payload (minimal fields supported for now)
      if (body?.metric) {
        await tx.metric.create({
          data: {
            dayRecordId: day.id,
            caloriesIn: body.metric.caloriesIn ?? null,
            caloriesOut: body.metric.caloriesOut ?? null,
            weightKg: body.metric.weightKg ?? null,
            bodyFatPct: body.metric.bodyFatPct ?? null,
            proteinG: body.metric.proteinG ?? null,
            carbsG: body.metric.carbsG ?? null,
            fatG: body.metric.fatG ?? null,
          },
        });
      }

      if (Array.isArray(body?.water) && body.water.length > 0) {
        for (const w of body.water) {
          await tx.water.create({
            data: {
              dayRecordId: day.id,
              amountMl: Number(w.amountMl) || 0,
              notedAt: w?.notedAt ? new Date(w.notedAt) : undefined,
              timeLocal: w?.timeLocal ?? null,
            },
          });
        }
      }

      if (Array.isArray(body?.food) && body.food.length > 0) {
        for (const f of body.food) {
          await tx.food.create({
            data: {
              dayRecordId: day.id,
              name: String(f.name ?? "food"),
              calories: Number(f.calories) || 0,
              proteinG: f?.proteinG ?? null,
              carbsG: f?.carbsG ?? null,
              fatG: f?.fatG ?? null,
              kcalPer100G: f?.kcalPer100G ?? null,
              proteinPer100G: f?.proteinPer100G ?? null,
              fatPer100G: f?.fatPer100G ?? null,
              carbsPer100G: f?.carbsPer100G ?? null,
              weightG: f?.weightG ?? null,
              notedAt: f?.notedAt ? new Date(f.notedAt) : null,
              timeLocal: f?.timeLocal ?? null,
            },
          });
        }
      }

      if (Array.isArray(body?.activity) && body.activity.length > 0) {
        for (const a of body.activity) {
          await tx.activity.create({
            data: {
              dayRecordId: day.id,
              type: String(a?.type ?? "activity"),
              durationMin: a?.durationMin ?? null,
              calories: a?.calories ?? null,
              intensity: a?.intensity ?? null,
              notedAt: a?.notedAt ? new Date(a.notedAt) : null,
              timeLocal: a?.timeLocal ?? null,
            },
          });
        }
      }

      if (Array.isArray(body?.exercise) && body.exercise.length > 0) {
        for (const e of body.exercise) {
          await tx.exercise.create({
            data: {
              dayRecordId: day.id,
              name: String(e?.name ?? "exercise"),
              sets: e?.sets ?? null,
              reps: e?.reps ?? null,
              weightKg: e?.weightKg ?? null,
              durationMin: e?.durationMin ?? null,
              calories: e?.calories ?? null,
              notedAt: e?.notedAt ? new Date(e.notedAt) : null,
              timeLocal: e?.timeLocal ?? null,
            },
          });
        }
      }

      if (body?.sleep) {
        await tx.sleep.create({
          data: {
            dayRecordId: day.id,
            startAt: body.sleep.startAt
              ? new Date(body.sleep.startAt)
              : new Date(`${dateIso}T00:00:00.000Z`),
            endAt: body.sleep.endAt
              ? new Date(body.sleep.endAt)
              : new Date(`${dateIso}T00:00:00.000Z`),
            startLocal: body.sleep.startLocal ?? null,
            endLocal: body.sleep.endLocal ?? null,
            quality: body.sleep.quality ?? null,
          },
        });
      }

      // Touch updatedAt
      await tx.dayRecord.update({
        where: { id: day.id },
        data: { updatedAt: new Date() },
      });
    });

    const dayFull = await fetchDayRecordWithChildren(
      userId,
      new Date(`${dateIso}T00:00:00.000Z`)
    );
    const mapped = mapDayRecordToJson(dayFull as any);
    if (mapped?.etag) {
      res.setHeader("ETag", mapped.etag);
    }
    return res.status(200).json(mapped);
  }

  @ApiOperation({ summary: "Get day record by date" })
  @ApiParam({ name: "date", example: "2025-09-01" })
  @ApiOkResponse({
    description: "Returns mapped day record JSON with totals/theoretical",
  })
  @Get(":date")
  async getByDate(
    @Param("date") dateParam: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    }

    const dateIso = dateParam;
    let day: any = null;
    try {
      day = await fetchDayRecordWithChildren(
        userId,
        new Date(`${dateIso}T00:00:00.000Z`)
      );
    } catch {
      // If schema/migrations not applied yet, fall back to minimal payload
      day = null;
    }

    let mapped = mapDayRecordToJson(day as any);
    if (!mapped) {
      // Build minimal placeholder if no record exists yet
      mapped = mapDayRecordToJson({
        date: new Date(`${dateIso}T00:00:00.000Z`),
        updatedAt: new Date(0),
        metric: null,
        water: [],
        food: [],
        activity: [],
        exercise: [],
        sleep: null,
      } as any);
    }

    if (mapped?.etag) {
      res.setHeader("ETag", mapped.etag);
    }
    return res.json(mapped);
  }
}
