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
export class FoodController {
  @Post("records/:date/food")
  async addFood(
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
      const f = await tx.food.create({
        data: {
          dayRecordId: day.id,
          name: String(body?.name ?? "food"),
          calories: Number(body?.calories) || 0,
          proteinG: body?.proteinG ?? null,
          carbsG: body?.carbsG ?? null,
          fatG: body?.fatG ?? null,
          kcalPer100G: body?.kcalPer100G ?? null,
          proteinPer100G: body?.proteinPer100G ?? null,
          fatPer100G: body?.fatPer100G ?? null,
          carbsPer100G: body?.carbsPer100G ?? null,
          weightG: body?.weightG ?? null,
          notedAt: body?.notedAt ? new Date(body.notedAt) : null,
          timeLocal: body?.timeLocal ?? null,
        },
      });
      await tx.dayRecord.update({
        where: { id: day.id },
        data: { updatedAt: new Date() },
      });
      return f;
    });
    return res.status(200).json({ id: created.id });
  }

  @Patch("food/:id")
  async updateFood(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    const item = await prisma.food.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    await prisma.food.update({
      where: { id },
      data: {
        name: body?.name ?? undefined,
        calories: body?.calories ?? undefined,
        proteinG: body?.proteinG ?? undefined,
        carbsG: body?.carbsG ?? undefined,
        fatG: body?.fatG ?? undefined,
        kcalPer100G: body?.kcalPer100G ?? undefined,
        proteinPer100G: body?.proteinPer100G ?? undefined,
        fatPer100G: body?.fatPer100G ?? undefined,
        carbsPer100G: body?.carbsPer100G ?? undefined,
        weightG: body?.weightG ?? undefined,
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

  @Delete("food/:id")
  async deleteFood(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new HttpException("unauthorized", HttpStatus.UNAUTHORIZED);
    const item = await prisma.food.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    await prisma.food.delete({ where: { id } });
    await prisma.dayRecord.update({
      where: { id: day.id },
      data: { updatedAt: new Date() },
    });
    return res.status(200).json({ ok: true });
  }
}
