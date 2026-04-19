import type { AppRouteDefinition } from "./registry.js";
import { userAuthRoutes } from "./user-auth.js";
import { userWorkoutRoutes } from "./user-workouts.js";

export type UserRouteOptions = {
  apiBasePath: string;
};

export function userRoutes(options: UserRouteOptions): AppRouteDefinition[] {
  return [...userAuthRoutes(options), ...userWorkoutRoutes(options)];
}
