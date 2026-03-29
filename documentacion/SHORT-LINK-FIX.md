# Short Link Flow - Fix Documentation

## Problem Summary

Users reported that short links (`/s/:code`) were returning HTML splash pages instead of redirecting to the original URL.

### Root Cause

**Multiple Bun processes running simultaneously on different/overlapping ports**, causing requests to be intercepted by the wrong server.

When testing with `curl http://localhost:3001/api/s/testcode`, the response was:
- **Status:** 404 (but with HTML body instead of JSON)
- **Content-Type:** `text/html; charset=utf-8`
- **Body:** Full HTML 404 page from the FRONTEND, not the backend

This indicated that the request was hitting the frontend server instead of the backend.

## Technical Details

### Architecture

```
User Browser → Frontend (:3001) → Backend (:3000)
                    ↓
              /s/:code route
                    ↓
           shortLinkController
                    ↓
      Proxy to ${BACKEND_URL}/api/s/:code
                    ↓
           Backend handleShortRoute
                    ↓
         302 redirect to original URL
```

### Configuration

**Frontend** (`frontend-bun-ejs/index.ts`):
- Default port: `3001`
- Backend URL: `process.env.BACKEND_URL ?? "http://localhost:3000"`
- Route: `GET /s/:code` → `shortLinkController`

**Backend** (`backend/index.ts`):
- Default port: `3000`
- Route: `GET /api/s/:code` → `handleShortRoute`

### Why It Failed

When multiple bun processes were running:
1. Some requests to `localhost:3001` hit the backend (wrong)
2. Some requests to `localhost:3000` hit the frontend (wrong)
3. Port conflicts caused unpredictable behavior
4. Frontend returned HTML 404 for unknown routes (including `/api/s/:code` when hit by mistake)

## Solution

### 1. Process Cleanup Script

Created `dev-start.sh` that:
- Kills all existing bun processes before starting
- Verifies ports are available
- Starts backend and frontend in correct order
- Provides clear logging and PIDs for cleanup

### 2. Enhanced Error Detection

Updated `shortLinkController` to:
- Log all redirect attempts with backend URL
- Detect HTML responses from backend (wrong server)
- Provide actionable error messages
- Include backend URL and response details in errors

### 3. Port Checking Script

Created `scripts/check-port.sh` for manual port verification.

## Testing

### Backend Direct Test (Correct Behavior)

```bash
# Start backend on port 3002
cd backend
PORT=3002 bun run index.ts &

# Test with invalid short code
curl -i http://localhost:3002/api/s/invalid
# Returns: 404 JSON with {"error":{"code":"NOT_FOUND","message":"Short link not found"}}

# Test with valid short code (create first)
curl -i http://localhost:3002/api/s/google-search-wy4pqo
# Returns: 302 redirect with Location: https://www.google.com/
```

### Frontend Proxy Test (Correct Behavior)

```bash
# Start backend on :3000 and frontend on :3001
./dev-start.sh

# Test short link through frontend proxy
curl -i http://localhost:3001/s/google-search-wy4pqo
# Should return: 302 redirect to https://www.google.com/
```

## Validation Checklist

- [x] Backend returns 302 redirect for valid short codes
- [x] Backend returns 404 JSON for invalid short codes
- [x] Frontend proxies redirects correctly
- [x] Frontend shows friendly error page for 404
- [x] Multiple error scenarios handled (network error, HTML response, 404, 5xx)
- [x] Clear logging for debugging
- [x] Startup script prevents port conflicts

## Files Changed

### Frontend
- `frontend-bun-ejs/src/controllers/short-link.controller.ts`
  - Added logging of redirect attempts
  - Enhanced HTML response detection
  - Improved error messages with actionable info

### Backend
- No changes needed (handler was already correct)

### Scripts
- `dev-start.sh` (NEW) - Clean startup script
- `scripts/check-port.sh` (NEW) - Port verification utility

## Prevention

To prevent this issue in the future:

1. **Always use `dev-start.sh`** for development (or similar port-checking logic)
2. **Kill existing processes** before starting new ones: `pkill -9 bun`
3. **Check port usage** if experiencing weird behavior: `lsof -i :3000`
4. **Set environment variables** explicitly if using custom ports:
   ```bash
   export BACKEND_URL=http://localhost:3000
   export PORT=3001  # Frontend port
   ```

## Debugging Tips

If short links return HTML instead of redirects:

1. **Check what's running on the backend port:**
   ```bash
   lsof -i :3000
   netstat -an | grep ":3000"
   ```

2. **Verify backend is responding with JSON:**
   ```bash
   curl -i http://localhost:3000/api/s/testcode
   ```

3. **Check environment variables:**
   ```bash
   echo $BACKEND_URL
   echo $PORT
   ```

4. **Kill all bun processes and restart:**
   ```bash
   pkill -9 bun
   ./dev-start.sh
   ```

5. **Check logs for detailed errors:**
   - Frontend logs show `[short-link]` prefixed messages
   - Backend logs show request details
