import {
  Controller,
  Get,
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

@Controller("records")
export class RecordsController {
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
