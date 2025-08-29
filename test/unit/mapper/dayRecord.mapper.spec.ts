import { mapDayRecordToJson } from "@/records/mapper/dayRecord.mapper";

describe("dayRecord mapper", () => {
  it("returns null for empty input", () => {
    const out = mapDayRecordToJson(null as any);
    expect(out).toBeNull();
  });

  it("computes totals for empty children", () => {
    const day = {
      date: new Date("2025-08-25T00:00:00.000Z"),
      updatedAt: new Date("2025-08-25T01:00:00.000Z"),
      food: [],
      water: [],
      activity: [],
      sleep: null,
      metric: null,
      exercise: [],
    } as any;

    const out = mapDayRecordToJson(day);
    expect(out.totals.kcal).toBe(0);
    expect(out.totals.food_items_count).toBe(0);
    expect(out.totals.water_l).toBe(0);
    expect(out.totals.steps).toBe(0);
  });
});
