import { expect, test } from "vitest";

import { buildContactListUrl, parseContactGroupFilter } from "./contact-list-filters";

const groups = [{ id: 4, name: "Теннис" }, { id: 8, name: "Семья" }];

test("search and group are encoded in the address together", () => {
  const url = new URL(buildContactListUrl("  Анна + Оля  ", 4), "http://localhost");
  expect(url.searchParams.get("q")).toBe("Анна + Оля");
  expect(parseContactGroupFilter(url.searchParams.get("group"), groups)).toBe(4);

  const changed = new URL(buildContactListUrl(url.searchParams.get("q") ?? "", 8), url);
  expect(changed.searchParams.get("q")).toBe("Анна + Оля");
  expect(parseContactGroupFilter(changed.searchParams.get("group"), groups)).toBe(8);
});

test("clearing the name keeps the group in the address", () => {
  expect(buildContactListUrl("", 4)).toBe("/?group=4");
  expect(buildContactListUrl("", "ungrouped")).toBe("/?group=ungrouped");
});

test("a missing or invalid group defaults to all contacts", () => {
  expect(parseContactGroupFilter(null, groups)).toBeNull();
  expect(parseContactGroupFilter("999", groups)).toBeNull();
  expect(parseContactGroupFilter("invalid", groups)).toBeNull();
  expect(parseContactGroupFilter("ungrouped", groups)).toBe("ungrouped");
});
