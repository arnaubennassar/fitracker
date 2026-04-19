import { adminAssignmentRoutes } from "./admin/assignments.js";
import { adminCatalogRoutes } from "./admin/catalog.js";
import { adminReportingRoutes } from "./admin/reporting.js";
import { adminSessionRoutes } from "./admin/session.js";
import type { AdminRouteOptions } from "./admin/shared.js";
import { adminWorkoutRoutes } from "./admin/workouts.js";
import type { AppRouteDefinition } from "./registry.js";

export function adminRoutes(options: AdminRouteOptions): AppRouteDefinition[] {
  return [
    ...adminSessionRoutes(options),
    ...adminCatalogRoutes(options),
    ...adminWorkoutRoutes(options),
    ...adminAssignmentRoutes(options),
    ...adminReportingRoutes(options),
  ];
}
