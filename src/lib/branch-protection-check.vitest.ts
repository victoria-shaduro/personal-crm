import { assert, test } from "vitest";

test("branch protection blocks a failing check", () => {
  assert.fail("Intentional failure for the main branch protection check");
});
