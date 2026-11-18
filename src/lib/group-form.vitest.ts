import { expect, test } from "vitest";

import { groupNameSchema } from "./group-form";

test("blank group name is rejected", () => {
  expect(groupNameSchema.safeParse("  \t ").success).toBe(false);
});

test("long group name is rejected at 201 characters", () => {
  expect(groupNameSchema.safeParse("я".repeat(200)).success).toBe(true);
  expect(groupNameSchema.safeParse("я".repeat(201)).success).toBe(false);
});
