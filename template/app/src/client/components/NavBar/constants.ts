import { routes } from "wasp/client/router";
import { BlogUrl, DocsUrl } from "../../../shared/common";
import type { NavigationItem } from "./NavBar";

const staticNavigationItems: NavigationItem[] = [
  { name: "Documentation", to: DocsUrl },
  { name: "Blog", to: BlogUrl },
];

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Features", to: "/#features" },
  { name: "Pricing", to: routes.PricingPageRoute.to },
  ...staticNavigationItems,
] as const;

export const appNavigationItems: NavigationItem[] = [
  { name: "Today", to: routes.PlannerRoute.to },
  { name: "Calendar", to: routes.CalendarRoute.to },
  { name: "History", to: routes.PlanHistoryRoute.to },
  { name: "Stats", to: routes.StatsRoute.to },
  { name: "Routines", to: routes.RoutinesRoute.to },
  { name: "Teams", to: routes.WorkspacesRoute.to },
] as const;
