# Routes Specification

## Purpose

Define the architecture and behavior of the modular route registration system for frontend-bun-ejs. This spec describes how routes are organized, registered, and validated while maintaining zero-breaking changes to the existing API.

## Requirements

### Functional Requirements

#### REQ-1: Modular Route Organization
The system MUST organize routes into domain-specific modules (`public.routes.ts`, `auth.routes.ts`, `dashboard.routes.ts`, `api.routes.ts`) where each module exports an array of `RouteDefinition` objects.

**Scenario: Export route definitions from module**
- GIVEN a route module file (e.g., `public.routes.ts`)
- WHEN the file is executed
- THEN it MUST export a `RouteDefinition[]` array containing all routes for that domain
- AND each route entry MUST have `method`, `pattern`, and `handler` properties

#### REQ-2: Centralized Route Registration
The system MUST provide a `registerRoutes()` helper function that iterates through a `RouteDefinition[]` array and calls `addRoute()` for each entry.

**Scenario: Register all routes from a module**
- GIVEN a `RouteDefinition[]` array with multiple route entries
- WHEN `registerRoutes(array)` is called
- THEN each route MUST be registered via `addRoute(method, pattern, handler)`
- AND all routes MUST be available for routing after registration

#### REQ-3: Zero Breaking Changes
The refactored system MUST maintain identical behavior to the monolithic implementation. All existing routes MUST be registered with the same methods, patterns, and handlers.

**Scenario: Verify route parity after refactor**
- GIVEN the original monolithic `index.ts` with all routes registered
- WHEN the refactored modular system is deployed
- THEN `listRoutes()` MUST return the same number of routes
- AND each route MUST have identical method, pattern, and handler

#### REQ-4: Static Before Dynamic Ordering
Route modules MUST maintain explicit ordering where static paths are registered BEFORE dynamic paths with parameters (e.g., `/dashboard/links/create` before `/dashboard/links/:id`) to prevent parameter capture.

**Scenario: Static route takes precedence over dynamic**
- GIVEN a module with both static `/dashboard/links/create` and dynamic `/dashboard/links/:id` routes
- WHEN routes are registered
- THEN the static route MUST be registered before the dynamic route
- AND a request to `/dashboard/links/create` MUST NOT be captured by the `:id` parameter

### Non-Functional Requirements

#### REQ-5: Type Safety
All route definitions MUST be type-checked at compile time using the `RouteDefinition` interface to prevent invalid route registrations.

**Scenario: Type validation prevents invalid routes**
- GIVEN a developer attempts to add a route with invalid properties
- WHEN TypeScript compilation runs
- THEN the compiler MUST reject the invalid definition
- AND MUST show a type error indicating missing or incorrect properties

#### REQ-6: Maintainability
Adding a new route MUST require changes to only ONE file—the corresponding domain module—without modifying `index.ts` or other modules.

**Scenario: Add new route without touching index.ts**
- GIVEN a developer needs to add a new dashboard route
- WHEN they add the route to `dashboard.routes.ts`
- THEN the route MUST be registered automatically
- AND `index.ts` MUST NOT require any modifications

#### REQ-7: Performance
Route registration MUST complete in <100ms for 50+ routes and MUST NOT add overhead to request handling compared to the monolithic implementation.

**Scenario: Route registration performance benchmark**
- GIVEN the application starts up
- WHEN all route modules are registered
- THEN registration MUST complete within 100ms
- AND request handling latency MUST be identical to the monolithic version

### Constraints

#### REQ-8: Core Router Immutability
The core router implementation (`src/router.ts`) MUST NOT be modified. All changes MUST be isolated to route organization and registration logic.

**Scenario: Router core remains unchanged**
- GIVEN the existing `router.ts` implementation
- WHEN the refactoring is complete
- THEN `router.ts` MUST be identical to the original version
- AND all exported functions (`handleRequest`, `addRoute`, `listRoutes`) MUST have the same signatures

## Test Cases

### Integration Tests

#### TEST-INT-1: Verify All Routes Registered
```typescript
test("listRoutes() returns expected count after refactor", () => {
  // Arrange: Count routes in original monolithic implementation
  const originalCount = 50; // Expected number of routes

  // Act: Start server with modular routes
  const registeredRoutes = listRoutes();

  // Assert: Same number of routes registered
  expect(registeredRoutes.length).toBe(originalCount);
});
```

#### TEST-INT-2: Verify Static Route Precedence
```typescript
test("static /dashboard/links/create not captured by :id", async () => {
  // Act: Request static route
  const response = await fetch("/dashboard/links/create", { method: "GET" });

  // Assert: Gets create controller, not details controller
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Controller")).toBe("linksCreateController");
});
```

### Unit Tests

#### TEST-UNIT-1: registerRoutes Helper
```typescript
test("registerRoutes calls addRoute for each entry", () => {
  // Arrange: Mock addRoute and create test routes
  const mockAddRoute = mock();
  const testRoutes: RouteDefinition[] = [
    { method: "GET", pattern: "/test", handler: mockHandler },
    { method: "POST", pattern: "/test", handler: mockHandler },
  ];

  // Act: Register routes
  registerRoutes(testRoutes);

  // Assert: addRoute called twice with correct args
  expect(mockAddRoute).toHaveBeenCalledTimes(2);
  expect(mockAddRoute).toHaveBeenCalledWith("GET", "/test", mockHandler);
  expect(mockAddRoute).toHaveBeenCalledWith("POST", "/test", mockHandler);
});
```

### Regression Tests

#### TEST-REG-1: Existing Route Behavior Unchanged
```typescript
test("all existing routes respond identically", async () => {
  // Test critical paths: public, auth, dashboard, short links
  const paths = ["/", "/explore", "/auth/login", "/dashboard", "/s/testcode"];

  for (const path of paths) {
    const response = await fetch(path);
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  }
});
```

## Contracts

### Type: RouteDefinition
```typescript
interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE";
  pattern: string;
  handler: Controller;
}
```

### Function: registerRoutes
```typescript
function registerRoutes(routes: RouteDefinition[]): void
```
Iterates through the array and registers each route with the router.

### Module Exports
Each route module MUST export:
```typescript
export const {module}Routes: RouteDefinition[];
```

Where `{module}` is one of: `public`, `auth`, `dashboard`, `api`.
