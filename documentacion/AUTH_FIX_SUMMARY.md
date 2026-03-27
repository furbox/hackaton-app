# Auth Server Actions Fix Summary

## Problem
Frontend auth forms were returning 404 errors because:
- Forms used named actions like `action="?/register"` and `action="?/login"`
- Server actions used `default` instead of named actions
- Missing server action for reset-password

## Architecture
- **Frontend**: SvelteKit at `http://localhost:5173`
- **Backend**: Bun + Better Auth at `http://localhost:3000`
- **Server Actions**: Act as PROXIES to backend API

## Changes Made

### 1. Register Action (`frontend/src/routes/auth/register/+page.server.ts`)
**Before:**
```typescript
export const actions: Actions = {
  default: async ({ request, fetch }) => { ... }
}
```

**After:**
```typescript
export const actions: Actions = {
  register: async ({ request, fetch }) => {
    // ...
    const response = await fetch(`${import.meta.env.PUBLIC_BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }) // Note: username not sent to backend
    });
    // Returns success message instead of redirect (user must verify email first)
  }
}
```

**Key Changes:**
- Renamed action from `default` to `register`
- Sends only `{ name, email, password }` to backend (username is collected but not used by Better Auth)
- Returns success message instead of redirect (email verification required)

### 2. Login Action (`frontend/src/routes/auth/login/+page.server.ts`)
**Before:**
```typescript
export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => { ... }
}
```

**After:**
```typescript
export const actions: Actions = {
  login: async ({ request, fetch, cookies }) => {
    // ...
    const response = await fetch(`${import.meta.env.PUBLIC_BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    // Forward Set-Cookie headers from backend to client
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      cookies.set('better-auth.session_token', result.token || '', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      });
    }
    // Redirects to dashboard on success
  }
}
```

**Key Changes:**
- Renamed action from `default` to `login`
- Added cookie forwarding logic to pass Better Auth session to client
- Uses `credentials: 'include'` to receive cookies from backend

### 3. Reset Password Action (`frontend/src/routes/auth/reset-password/[token]/+page.server.ts`)
**Created new file** with:
```typescript
export const load: PageServerLoad = async ({ params }) => {
  return { token: params.token };
};

export const actions: Actions = {
  resetPassword: async ({ request, fetch }) => {
    // ...
    const response = await fetch(`${import.meta.env.PUBLIC_BACKEND_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password })
    });
    // Redirects to /auth/login?reset=success on success
  }
}
```

**Key Changes:**
- Created new server action file for reset-password
- Load function extracts token from URL params
- Sends `{ token, newPassword }` to backend (not `password`)
- Redirects to login with success flag

### 4. Forgot Password Action (`frontend/src/routes/auth/forgot-password/+page.server.ts`)
**Before:**
```typescript
return {
  error: result.error?.message || 'Error al solicitar recuperación',
  // ...
};
```

**After:**
```typescript
return {
  error: result.error || 'Error al solicitar recuperación',
  // Uses backend's message directly
};
```

**Key Changes:**
- Fixed error response handling to use `result.error` (not `result.error?.message`)
- Returns backend's success message directly

## API Endpoints Called

| Action | Method | Endpoint | Request Body |
|--------|--------|----------|--------------|
| Register | POST | `/api/auth/register` | `{ name, email, password }` |
| Login | POST | `/api/auth/login` | `{ email, password }` |
| Forgot Password | POST | `/api/auth/forgot-password` | `{ email }` |
| Reset Password | POST | `/api/auth/reset-password` | `{ token, newPassword }` |

## Cookie Handling

Better Auth sets session cookies via `Set-Cookie` header. The frontend server action must:
1. Make request with `credentials: 'include'`
2. Extract `Set-Cookie` header from backend response
3. Forward to client via SvelteKit's `cookies.set()`

```typescript
cookies.set('better-auth.session_token', result.token || '', {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
});
```

## Testing

To verify fixes:
1. Visit `http://localhost:5173/auth/register`
2. Fill form and submit - should call backend API
3. Check browser Network tab - should see `POST http://localhost:3000/api/auth/register`
4. Same for login and reset-password flows

## Notes

- **Username field**: Frontend collects it but backend doesn't use it (Better Auth uses `name` field)
- **Email verification**: Registration returns success message but doesn't auto-redirect (user must verify email first)
- **Error messages**: Backend returns `{ error: "message" }` - use `result.error` directly
- **Token handling**: Reset-password token comes from URL param, extracted in load function

## Files Modified

1. `frontend/src/routes/auth/register/+page.server.ts` - Renamed action, fixed request body
2. `frontend/src/routes/auth/login/+page.server.ts` - Renamed action, added cookie forwarding
3. `frontend/src/routes/auth/reset-password/[token]/+page.server.ts` - Created new file
4. `frontend/src/routes/auth/forgot-password/+page.server.ts` - Fixed error handling
