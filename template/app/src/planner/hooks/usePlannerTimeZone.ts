import { getPlannerSettings, useQuery } from "wasp/client/operations";
import { getRuntimeTimeZone, getTodayDateKey } from "../lib/dates";

/**
 * The user's planner settings plus the effective time zone (falls back to the
 * browser's time zone while settings load or if they fail to load).
 */
export function usePlannerTimeZone() {
  const { data: settings, isLoading } = useQuery(getPlannerSettings);
  const timeZone = settings?.timeZone ?? getRuntimeTimeZone();
  return {
    settings,
    timeZone,
    today: getTodayDateKey(timeZone),
    /** True until we know which time zone to use. */
    isLoading,
  };
}
