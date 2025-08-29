# Mapper specification: DayRecord DB → JSON

## Overview

The mapper builds the public JSON response for a user's day record matching the shape in `source/*.js`.
Root fields: `dtype`, `metrics`, `activity[]`, `sleep`, `water[]`, `food[]`, `exercise[]`, `totals`, `theoretical`.

## Totals

- `kcal` (int) — total calories from food
- `protein`, `fat`, `carbs` (int) — total grams
- `food_weight_g` (int)
- `food_items_count` (int)
- `water_l`, `liquid_water_l` (number, 2 decimals)
- `steps` (int)
- `sleep_hours` (number, 2 decimals)

Rounding rules: kcal/macros → round to nearest integer; water/sleep → round to 2 decimal places.

## Theoretical

- `steps_burn_kcal` (number)
- `net_deficit_kcal` (number)
- `projected_weekly_kg` (number)

Formulas: document simple defaults in code comments; tests will assert expected outputs.

## Sorting and timestamps

- `activity` sorted by date/time ascending
- `food`/`water` sorted by time ascending; ties broken by `createdAt`
- All stored timestamps are UTC; mapper may include `time_local` formatted using `UserProfile.tz` when available.

## ETag

- Use `src/records/utils/etag.ts` to generate ETag from `updatedAt` ISO value.

## Examples

Minimal:

```json
{
  "dtype": "day_record_v1",
  "date": "2025-08-25",
  "food": [],
  "water": [],
  "totals": {
    "kcal": 0,
    "protein": 0,
    "fat": 0,
    "carbs": 0,
    "food_weight_g": 0,
    "food_items_count": 0,
    "water_l": 0.0
  }
}
```

Full example: see `backend/source/2025-08-25.js` for a canonical example to match.

## Tests

- Unit tests: aggregation functions, rounding, sorting
- E2E tests: full GET response includes `totals`/`theoretical`, and ETag behavior on updates
