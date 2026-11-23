import { action, page, query, route, type Spec } from "@wasp/spec";

import {
  getPlannerSettings,
  updatePlannerSettings,
} from "./operations" with { type: "ref" };
import { SettingsPage } from "./SettingsPage" with { type: "ref" };

export const settingsSpec: Spec = [
  route("SettingsRoute", "/settings", page(SettingsPage, { authRequired: true })),
  query(getPlannerSettings, { entities: ["User"] }),
  action(updatePlannerSettings, { entities: ["User"] }),
];
