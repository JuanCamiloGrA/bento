import { describe, expect, it } from "vitest";

import { hasMessage, t } from "./dictionary";
import { navItems, routeDefinitions } from "../routes/routeConfig";

describe("i18n dictionary", () => {
  it("contains all route placeholder keys", () => {
    for (const route of routeDefinitions) {
      expect(hasMessage(route.titleKey)).toBe(true);
      expect(hasMessage(route.bodyKey)).toBe(true);
      expect(t(route.titleKey)).not.toHaveLength(0);
      expect(t(route.bodyKey)).not.toHaveLength(0);
    }
  });

  it("contains sidebar labels", () => {
    for (const item of navItems) {
      expect(item.label).not.toHaveLength(0);
    }
  });
});
