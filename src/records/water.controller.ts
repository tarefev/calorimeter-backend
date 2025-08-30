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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiHeader,
  ApiTags,
} from "@nestjs/swagger";
import { prisma } from "@/prisma/prismaClient";
import { AuthenticatedRequest } from "@/auth/session.middleware";

@ApiTags("water")
@ApiBearerAuth()
@Controller()
export class WaterController {
  @ApiOperation({ summary: "Add water entry to day by date" })
  @ApiParam({ name: "date", example: "2025-09-01" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        amountMl: { type: "number" },
        notedAt: { type: "string", format: "date-time" },
        timeLocal: { type: "string", nullable: true },
      },
    },
  })
  @ApiOkResponse({
    description: "{ id: string }",
    schema: { type: "object", properties: { id: { type: "string" } } },
  })
  @Post("records/:date/water")
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
  @ApiOperation({ summary: "Update water item by id" })
  @ApiParam({ name: "id", description: "Water item id" })
  @ApiHeader({
    name: "If-Match",
    required: false,
    description:
      "ETag of parent day record; when provided and mismatched → 412",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        amountMl: { type: "number" },
        notedAt: { type: "string", format: "date-time" },
        timeLocal: { type: "string", nullable: true },
      },
    },
  })
  @ApiOkResponse({
    description: "{ ok: true }",
    schema: {
      type: "object",
      properties: { ok: { type: "boolean", example: true } },
    },
  })
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

    const item = await prisma.water.findUnique({ where: { id } });
    if (!item) throw new HttpException("not_found", HttpStatus.NOT_FOUND);
    const day = await prisma.dayRecord.findUnique({
      where: { id: item.dayRecordId },
      select: { id: true, userId: true, updatedAt: true },
    });
    if (!day || day.userId !== userId)
      throw new HttpException("forbidden", HttpStatus.FORBIDDEN);

    const ifMatch =
      (req.headers["if-match"] as string | undefined) || undefined;
    if (ifMatch) {
      const { generateEtag } = await import("@/records/utils/etag");
      if (ifMatch !== generateEtag(day.updatedAt.toISOString())) {
        throw new HttpException(
          "precondition_failed",
          HttpStatus.PRECONDITION_FAILED
        );
      }
    }

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

  @ApiOperation({ summary: "Delete water item by id" })
  @ApiParam({ name: "id", description: "Water item id" })
  @ApiHeader({
    name: "If-Match",
    required: false,
    description:
      "ETag of parent day record; when provided and mismatched → 412",
  })
  @ApiOkResponse({
    description: "{ ok: true }",
    schema: {
      type: "object",
      properties: { ok: { type: "boolean", example: true } },
    },
  })
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
}
