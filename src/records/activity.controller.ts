import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { prisma } from "@/prisma/prismaClient";
import { AuthenticatedRequest } from "@/auth/session.middleware";

@Controller()
export class ActivityController {
  @Post("records/:date/activity")
  async addActivity(
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
      const a = await tx.activity.create({
        data: {
          dayRecordId: day.id,
          type: String(body?.type ?? "activity"),
          durationMin: body?.durationMin ?? null,
          calories: body?.calories ?? null,
          intensity: body?.intensity ?? null,
          notedAt: body?.notedAt ? new Date(body.notedAt) : null,
          timeLocal: body?.timeLocal ?? null,
        },
      });
      await tx.dayRecord.update({
        where: { id: day.id },
        data: { updatedAt: new Date() },
      });
      return a;
    });
    return res.status(200).json({ id: created.id });
  }

  @Patch("activity/:id")
  async updateActivity(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    const item = await prisma.activity.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    await prisma.activity.update({
      where: { id },
      data: {
        type: body?.type ?? undefined,
        durationMin: body?.durationMin ?? undefined,
        calories: body?.calories ?? undefined,
        intensity: body?.intensity ?? undefined,
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

  @Delete("activity/:id")
  async deleteActivity(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    const item = await prisma.activity.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    await prisma.activity.delete({ where: { id } });
    await prisma.dayRecord.update({
      where: { id: day.id },
      data: { updatedAt: new Date() },
    });
    return res.status(200).json({ ok: true });
  }
}
