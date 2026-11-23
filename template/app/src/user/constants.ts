import {
  CalendarDays,
  LayoutDashboard,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { routes } from "wasp/client/router";

export const userMenuItems = [
  {
    name: "Today's Plan",
    to: routes.PlannerRoute.to,
    icon: LayoutDashboard,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "Calendar",
    to: routes.CalendarRoute.to,
    icon: CalendarDays,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "Teams",
    to: routes.WorkspacesRoute.to,
    icon: Users,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "Planner Settings",
    to: routes.SettingsRoute.to,
    icon: SlidersHorizontal,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "Account Settings",
    to: routes.AccountRoute.to,
    icon: Settings,
    isAuthRequired: false,
    isAdminOnly: false,
  },
  {
    name: "Admin Dashboard",
    to: routes.AdminRoute.to,
    icon: Shield,
    isAuthRequired: false,
    isAdminOnly: true,
  },
] as const;
