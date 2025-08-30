import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { AuthenticatedRequest } from "@/auth/session.middleware";
import { fetchDayRecordWithChildren } from "@/records/mapper/queries";
import { mapDayRecordToJson } from "@/records/mapper/dayRecord.mapper";
import { prisma } from "@/prisma/prismaClient";

@Controller("records")
export class RecordsController {
  @Post(":date/water")
  async addWater(
    @Param("date") dateParam: string,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    const date = new Date(`${dateParam}T00:00:00.000Z`);

    const created = await prisma.$transaction(async (tx) => {
      const day = await tx.dayRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
      });
      const w = await tx.water.create({
        data: {
          dayRecordId: day.id,
          amountMl: Number(body?.amountMl) || 0,
          notedAt: body?.notedAt ? new Date(body.notedAt) : undefined,
          timeLocal: body?.timeLocal ?? null,
        },
      });
      await tx.dayRecord.update({
        where: { id: day.id },
        data: { updatedAt: new Date() },
      });
      return w;
    });
    return res.status(200).json({ id: created.id });
  }

  @Patch("water/:id")
  async updateWater(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: any,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);

    // Ensure ownership via join on DayRecord
    const item = await prisma.water.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    await prisma.water.update({
      where: { id },
      data: {
        amountMl: body?.amountMl ?? undefined,
        notedAt: body?.notedAt ? new Date(body.notedAt) : undefined,
        timeLocal: body?.timeLocal ?? undefined,
      },
    });
    await prisma.dayRecord.update({
      where: { id: day.id },
      data: { updatedAt: new Date() },
    });
    return res.status(200).json({ ok: true });
  }

  @Delete("water/:id")
  async deleteWater(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);

    const item = await prisma.water.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    await prisma.water.delete({ where: { id } });
    await prisma.dayRecord.update({
      where: { id: day.id },
      data: { updatedAt: new Date() },
    });
    return res.status(200).json({ ok: true });
  }
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
