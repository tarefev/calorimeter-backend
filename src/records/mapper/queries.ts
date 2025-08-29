import { prisma } from "../../prisma/prismaClient";

// Fetch DayRecord by userId + date (date should be YYYY-MM-DD or Date at UTC midnight)
export async function fetchDayRecordWithChildren(
  userId: string,
  date: Date | string
) {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const day = await prisma.dayRecord.findUnique({
    where: {
      userId_date: {
        userId,
        date: dateObj,
      },
    },
    include: {
      metric: true,
      water: {
        orderBy: [{ notedAt: "asc" }, { createdAt: "asc" }],
      },
      food: {
        orderBy: [{ notedAt: "asc" }, { createdAt: "asc" }],
      },
      activity: {
        orderBy: [{ notedAt: "asc" }, { createdAt: "asc" }],
      },
      exercise: {
        orderBy: [{ notedAt: "asc" }, { createdAt: "asc" }],
      },
      sleep: true,
    },
  });

  return day;
}
