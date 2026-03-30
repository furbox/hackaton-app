import { describe, test, expect, beforeEach, mock } from "bun:test";
import { addRoute, listRoutes } from "../router.ts";
import { registerRoutes } from "../routes/index.ts";
import type { RouteDefinition } from "../routes/index.ts";

describe("registerRoutes() - Integration Tests", () => {
  // Guardar estado original de rutas antes de cada test
  let originalRoutes: ReturnType<typeof listRoutes>;

  beforeEach(() => {
    // Guardar estado actual
    originalRoutes = listRoutes();
  });

  test("should register routes and verify with listRoutes()", () => {
    const mockHandler = mock(() => new Response("OK"));
    const routes: RouteDefinition[] = [
      { method: "GET", pattern: "/test-integration-1", handler: mockHandler },
      { method: "POST", pattern: "/test-integration-2", handler: mockHandler },
    ];

    const beforeCount = listRoutes().length;
    registerRoutes(routes);
    const afterCount = listRoutes().length;

    // Verificar que se registraron 2 rutas nuevas
    expect(afterCount).toBe(beforeCount + 2);

    // Verificar que las rutas están en listRoutes()
    const allRoutes = listRoutes();
    expect(allRoutes.some(r => r.pattern.includes("/test-integration-1"))).toBe(true);
    expect(allRoutes.some(r => r.pattern.includes("/test-integration-2"))).toBe(true);
  });

  test("should log warning for duplicate routes to console", () => {
    const mockHandler = mock(() => new Response("OK"));
    const duplicatePattern = "/test-duplicate-" + Date.now();

    // Registrar la ruta por primera vez
    const routes1: RouteDefinition[] = [
      { method: "GET", pattern: duplicatePattern, handler: mockHandler },
    ];
    registerRoutes(routes1);

    // Intentar registrar la misma ruta duplicada
    const consoleWarnSpy = mock();
    const originalWarn = console.warn;
    console.warn = consoleWarnSpy;

    const routes2: RouteDefinition[] = [
      { method: "GET", pattern: duplicatePattern, handler: mockHandler },
    ];
    registerRoutes(routes2);

    // Verificar que se llamó a console.warn
    expect(consoleWarnSpy).toHaveBeenCalled();

    // Verificar que el warning contiene "Duplicate route detected"
    const warningMessage = consoleWarnSpy.mock.calls[0][0];
    expect(warningMessage).toContain("Duplicate route detected");

    // El warning debe incluir el método y patrón
    expect(warningMessage).toContain("GET");
    expect(warningMessage).toContain(duplicatePattern);

    console.warn = originalWarn;
  });

  test("should preserve route order when registering multiple routes", () => {
    const mockHandler = mock(() => new Response("OK"));
    const timestamp = Date.now();
    const routes: RouteDefinition[] = [
      { method: "GET", pattern: `/order-test-1-${timestamp}`, handler: mockHandler },
      { method: "GET", pattern: `/order-test-2-${timestamp}`, handler: mockHandler },
      { method: "GET", pattern: `/order-test-3-${timestamp}`, handler: mockHandler },
    ];

    const beforeCount = listRoutes().length;
    registerRoutes(routes);
    const afterCount = listRoutes().length;

    expect(afterCount).toBe(beforeCount + 3);

    // Verificar que las 3 rutas están registradas
    const allRoutes = listRoutes();
    const newRoutes = allRoutes.slice(beforeCount); // Últimas 3 rutas

    expect(newRoutes[0].pattern).toContain("/order-test-1-");
    expect(newRoutes[1].pattern).toContain("/order-test-2-");
    expect(newRoutes[2].pattern).toContain("/order-test-3-");
  });

  test("should handle empty route array without errors", () => {
    const routes: RouteDefinition[] = [];
    const beforeCount = listRoutes().length;

    expect(() => registerRoutes(routes)).not.toThrow();

    const afterCount = listRoutes().length;
    expect(afterCount).toBe(beforeCount);
  });
});
