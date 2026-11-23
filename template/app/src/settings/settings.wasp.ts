import { action, query, type Spec } from "@wasp/spec";

import {
  getPlannerSettings,
  updatePlannerSettings,
} from "./operations" with { type: "ref" };

export const settingsSpec: Spec = [
  query(getPlannerSettings, { entities: ["User"] }),
  action(updatePlannerSettings, { entities: ["User"] }),
];
