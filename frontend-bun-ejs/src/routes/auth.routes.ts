import type { RouteDefinition } from "./index.ts";
import {
  loginGetController,
  loginPostController,
} from "../controllers/auth/login.controller.ts";
import {
  registerGetController,
  registerPostController,
} from "../controllers/auth/register.controller.ts";
import { logoutController } from "../controllers/auth/logout.controller.ts";
import {
  forgotPasswordGetController,
  forgotPasswordPostController,
} from "../controllers/auth/forgot-password.controller.ts";
import { verifyController } from "../controllers/auth/verify.controller.ts";
import {
  resetPasswordGetController,
  resetPasswordPostController,
} from "../controllers/auth/reset-password.controller.ts";

/**
 * Rutas de autenticación.
 *
 * Incluye:
 * - Login (GET form, POST submit)
 * - Register (GET form, POST submit)
 * - Logout (POST)
 * - Forgot password (GET form, POST submit)
 * - Verify email (GET with token)
 * - Reset password (GET form, POST submit with token)
 */
export const authRoutes: RouteDefinition[] = [
  { method: "GET", pattern: "/auth/login", handler: loginGetController },
  { method: "POST", pattern: "/auth/login", handler: loginPostController },
  { method: "GET", pattern: "/auth/register", handler: registerGetController },
  { method: "POST", pattern: "/auth/register", handler: registerPostController },
  { method: "POST", pattern: "/auth/logout", handler: logoutController },
  { method: "GET", pattern: "/auth/forgot-password", handler: forgotPasswordGetController },
  { method: "POST", pattern: "/auth/forgot-password", handler: forgotPasswordPostController },
  { method: "GET", pattern: "/auth/verify/:token", handler: verifyController },
  { method: "GET", pattern: "/auth/reset-password/:token", handler: resetPasswordGetController },
  { method: "POST", pattern: "/auth/reset-password/:token", handler: resetPasswordPostController },
];
