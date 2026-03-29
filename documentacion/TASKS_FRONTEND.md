# Tasks: URLoft - Frontend EJS + Bun

> **Frontend oficial del proyecto para el hackatón.**
>
> Stack: **Bun** + **EJS** + **Tailwind CSS** + **HTMX** (para interactividad)
>
> Location: `frontend-bun-ejs/`
>
> **⚠️ IMPORTANT:** Status is phase-specific. Do not assume implementation correctness from file existence alone.
> FE-17..FE-22 are closed as **PASS**; other phases may still require follow-up verification.
>
> Status synchronization: Detailed phases live in `tasks/PhaseFE-*.md`

---

## 🎯 Decisiones de Arquitectura

### ¿Por qué Bun + EJS y no SvelteKit?

| Aspecto | SvelteKit (archivado) | Bun + EJS (actual) |
|---------|----------------------|-------------------|
| **Setup** | Complejo (Vite, Svelte 5 runes, SSR/CSR config) | Zero-config (Bun.serve nativo) |
| **Build** | Requiere bundle step | No build (sirve estáticos directos) |
| **Templates** | Svelte components (.svelte) | EJS (HTML con JS incrustado) |
| **Interactividad** | Runes ($state, $derived) | HTMX + Alpine.js (si necesario) |
| **Learning curve** | Alta (nuevos conceptos) | Baja (HTML/JS estándar) |
| **Hackathon suitability** | Overhead extra | ✅ Velocidad máxima |

### Stack del Frontend

```
frontend-bun-ejs/
├── index.ts          # Bun.serve server con routing
├── src/
│   ├── router.ts              # Custom router basado en regex
│   ├── renderer.ts            # EJS renderer con layouts
│   ├── api/
│   │   └── client.ts          # Cliente HTTP proxy al backend
│   ├── middleware/
│   │   └── session.ts         # Auth: getSession(), withAuth(), requireAuth()
│   ├── controllers/           # Controllers por feature
│   │   ├── auth/              # login, register, logout, verify, reset-password
│   │   ├── dashboard/         # index, links, categories, favorites, profile, keys
│   │   ├── links/             # like, favorite (HTMX partials)
│   │   ├── home.controller.ts
│   │   ├── explore.controller.ts
│   │   ├── profile.controller.ts
│   │   └── short-link.controller.ts
│   └── utils/
│       ├── flash.ts           # Flash messages via query params
│       └── csrf.ts            # CSRF tokens
├── views/                     # EJS templates
│   ├── layouts/
│   │   └── base.ejs           # Layout principal (nav, footer, HTMX script)
│   ├── pages/
│   │   ├── home.ejs
│   │   ├── explore.ejs
│   │   ├── profile.ejs
│   │   ├── error.ejs
│   │   ├── auth/
│   │   │   ├── login.ejs
│   │   │   ├── register.ejs
│   │   │   ├── verify.ejs
│   │   │   ├── forgot-password.ejs
│   │   │   └── reset-password.ejs
│   │   └── dashboard/
│   │       ├── index.ejs
│   │       ├── links.ejs
│   │       ├── categories.ejs
│   │       ├── favorites.ejs
│   │       ├── profile.ejs
│   │       ├── keys.ejs
│   │       └── import.ejs      # PENDIENTE
│   └── partials/
│       ├── nav.ejs
│       ├── flash.ejs
│       ├── link-card.ejs
│       ├── like-button.ejs
│       ├── favorite-button.ejs
│       └── pagination.ejs
├── public/                    # Static assets
│   └── logo-urloft.png
├── package.json               # EJS dependency
└── .env                       # PORT=3001, URL_BACKEND=http://localhost:3000
```

---

## 📋 Phases del Frontend

> **⚠️ STATUS:** Verification status is synchronized per phase via SDD.
>
> Each phase will be audited for:
> - ✅ Correct implementation (not just file existence)
> - ✅ Integration with backend API
> - ✅ Error handling
> - ✅ Edge cases covered
> - ✅ User experience (UX)

---

### Phase FE-1: Foundation & Routing ✅ VERIFIED

> **Goal:** Server setup, routing, EJS rendering, and basic infrastructure
>
> **Files:** `index.ts`, `src/router.ts`, `src/renderer.ts`, `src/api/client.ts`, `src/middleware/session.ts`

- [x] **FE-1.1** Setup Bun.serve server in `index.ts`
  - [x] Server starts without errors on configured PORT
  - [x] Error handling for 404 and 500 responses
  - [x] CORS configured correctly (if needed)
  - [x] Graceful shutdown handling

- [ ] **FE-1.2** Configure custom router in `src/router.ts`
  - [ ] Regex-based routing works correctly
  - [ ] Route parameters extracted (e.g., `:username`, `:id`)
  - [ ] Query string parameters accessible
  - [ ] HTTP methods differentiated (GET, POST, PUT, DELETE)

- [ ] **FE-1.3** Configure EJS renderer in `src/renderer.ts`
  - [ ] EJS templates render with correct data binding
  - [ ] Layout inheritance works (base layout + page content)
  - [ ] Partials include correctly (`<%- include() %>`)
  - [ ] Error handling for missing templates

- [ ] **FE-1.4** Setup API client proxy in `src/api/client.ts`
  - [ ] Forwards cookies/session to backend correctly
  - [ ] Handles JSON responses properly
  - [ ] Handles error responses (4xx, 5xx) with correct error messages
  - [ ] Timeout handling for slow backend responses

- [ ] **FE-1.5** Setup session middleware in `src/middleware/session.ts`
  - [ ] `getSession()` extracts session from cookies correctly
  - [ ] `requireAuth()` redirects unauthenticated users to `/auth/login`
  - [ ] `withAuth()` passes user data to controllers
  - [ ] Session validation against backend `/api/auth/me` or similar

- [ ] **FE-1.6** Setup Tailwind CSS integration
  - [ ] Tailwind CDN loaded correctly or bundled CSS
  - [ ] Custom theme colors defined (primary, etc.)
  - [ ] Responsive breakpoints configured
  - [ ] No CSS conflicts or missing styles

- [ ] **FE-1.7** Setup HTMX for interactivity
  - [ ] HTMX script loaded in base layout
  - [ ] HTMX endpoints work for like/favorite toggles
  - [ ] Loading indicators work (hx-indicator)
  - [ ] Error handling for failed HTMX requests

**Acceptance Criteria:**
- Server starts and serves pages without errors
- Routing works for all registered routes
- Templates render with correct data
- Session middleware protects private routes
- API client communicates with backend successfully

---

### Phase FE-2: Base Layout & Navigation ✅ VERIFIED & FIXED

> **Goal:** Reusable layout, navigation, and common UI components
>
> **Files:** `views/layouts/base.ejs`, `views/partials/nav.ejs`, `views/partials/flash.ejs`

> **✅ VERIFICADO:** Alpine.js agregado, hamburger menu implementado, flash messages funcionan

- [x] **FE-2.1** Create base layout in `views/layouts/base.ejs`
  - [ ] HTML5 structure with proper `<head>`, meta tags
  - [ ] Tailwind CSS loaded (CDN or bundled)
  - [ ] HTMX script loaded
  - [ ] Responsive viewport meta tag
  - [ ] Title and meta tags configurable per page
  - [ ] Body includes nav, content slot, footer
  - [ ] Google Fonts or custom font loaded (if needed)

- [ ] **FE-2.2** Create navigation component in `views/partials/nav.ejs`
  - [ ] Logo/name links to home
  - [ ] Public navigation: Home, Explore
  - [ ] Auth state detection (show Login/Register OR User menu + Logout)
  - [ ] Dropdown menu for authenticated user (Dashboard links)
  - [ ] Mobile responsive (hamburger menu works)
  - [ ] Active page highlighting

- [ ] **FE-2.3** Create flash messages component in `views/partials/flash.ejs`
  - [ ] Reads flash messages from query params or session
  - [ ] Success messages styled green
  - [ ] Error messages styled red
  - [ ] Warning messages styled yellow
  - [ ] Dismissible (close button)
  - [ ] Auto-dismiss after N seconds (optional)

- [ ] **FE-2.4** Create footer component (optional)
  - [ ] Links to About, Privacy, Terms
  - [ ] Copyright notice
  - [ ] Social links (GitHub, Twitter)

**Acceptance Criteria:**
- Base layout renders correctly on all pages
- Navigation adapts to auth state (logged in vs guest)
- Flash messages display correctly with proper styling
- Mobile responsive navigation works
- All pages share consistent look and feel

---

### Phase FE-3: Public Pages - Home ✅ VERIFIED

> **Goal:** Landing page with hero, stats, and featured content
>
> **Files:** `src/controllers/home.controller.ts`, `views/pages/home.ejs`

- [x] **FE-3.1** Create home controller in `src/controllers/home.controller.ts`
  - [ ] Fetches global stats from `GET /api/stats/global`
  - [ ] Fetches featured links from `GET /api/links?sort=likes&limit=6`
  - [ ] Fetches top users (if applicable) or uses link data
  - [ ] Handles errors gracefully (shows empty state if API fails)
  - [ ] Passes data to template with correct structure

- [ ] **FE-3.2** Create home template in `views/pages/home.ejs`
  - [ ] Hero section with headline, subheadline, CTA buttons
  - [ ] CTAs: "Get Started" → `/auth/register`, "Explore" → `/explore`
  - [ ] Featured links section (6 links grid or list)
  - [ ] Global stats display (total users, links, categories)
  - [ ] Features section highlighting key URLoft features
  - [ ] Footer with additional info
  - [ ] Mobile responsive (hero stacks, stats adjust)

- [ ] **FE-3.3** Integrate featured links
  - [ ] Uses `link-card.ejs` partial for consistent styling
  - [ ] Shows OG image or favicon fallback
  - [ ] Shows title, description, stats (likes, views)
  - [ ] Links to `/s/:code` for tracking views
  - [ ] Fallback message if no featured links

- [ ] **FE-3.4** SEO optimization
  - [ ] Title tag: "URLoft - Your Personal Link Library"
  - [ ] Meta description: Brief description of URLoft
  - [ ] OG tags for social sharing (title, description, image)
  - [ ] Semantic HTML (`<main>`, `<section>`, `<h1>`, etc.)

**Acceptance Criteria:**
- Home page loads without errors
- Stats and featured links display correctly from API
- CTAs navigate to correct pages
- Page is mobile responsive
- SEO tags present and correct
- API errors handled gracefully (show empty states)

---

### Phase FE-4: Public Pages - Explore ✅ VERIFIED

> **Goal:** Searchable, filterable list of all public links
>
> **Files:** `src/controllers/explore.controller.ts`, `views/pages/explore.ejs`, `views/partials/pagination.ejs`

- [x] **FE-4.1** Create explore controller in `src/controllers/explore.controller.ts`
  - [ ] Reads query params: `q` (search), `categoryId`, `sort`, `page`, `limit`
  - [ ] Fetches links from `GET /api/links` with params
  - [ ] Fetches categories from `GET /api/categories` (for filter dropdown)
  - [ ] Handles pagination (calculate total pages from response)
  - [ ] Passes data to template: links, categories, pagination

- [ ] **FE-4.2** Create explore template in `views/pages/explore.ejs`
  - [ ] Search bar with debounced input (or submit on enter)
  - [ ] Filter sidebar: Sort (recent, likes, views, favorites), Category dropdown
  - [ ] Links grid/list using `link-card.ejs` partial
  - [ ] Pagination component (`pagination.ejs` partial)
  - [ ] Results count ("Showing X-Y of Z links")
  - [ ] Empty state ("No links found. Try different filters.")
  - [ ] Loading state (skeleton or spinner)
  - [ ] Mobile responsive (filters collapsible or stacked)

- [ ] **FE-4.3** Create pagination component in `views/partials/pagination.ejs`
  - [ ] Shows current page, total pages
  - [ ] Previous button (disabled on page 1)
  - [ ] Next button (disabled on last page)
  - [ ] Page number links (1, 2, 3, ... last)
  - [ ] Maintains query params when changing pages (`?q=bun&page=2`)
  - [ ] URL updates correctly on navigation

- [ ] **FE-4.4** Search functionality
  - [ ] Full-text search works via backend FTS5 (`?q=keyword`)
  - [ ] Search input updates URL param
  - [ ] Search results update without page reload (or with reload)
  - [ ] Empty search shows all links (clears filter)

- [ ] **FE-4.5** Filter functionality
  - [ ] Sort dropdown works (recent, likes, views, favorites)
  - [ ] Category dropdown populates from API
  - [ ] Filters persist in URL (shareable URLs)
  - [ ] Clear filters button resets to default view

- [ ] **FE-4.6** SEO optimization
  - [ ] Title: "Explore Links - URLoft" (or dynamic with search query)
  - [ ] Meta description: "Discover and save links shared by the community"
  - [ ] OG tags for social sharing
  - [ ] Canonical URL (self-referencing)

**Acceptance Criteria:**
- Explore page loads with default filters
- Search returns relevant results
- Filters (sort, category) work correctly
- Pagination works and maintains filters
- URL updates correctly (shareable)
- Empty states handled gracefully
- Mobile responsive

---

### Phase FE-5: Public Pages - User Profiles ✅ VERIFIED

> **Goal:** Public profile page showing user info and their links
>
> **Files:** `src/controllers/profile.controller.ts`, `views/pages/profile.ejs`

- [x] **FE-5.1** Create profile controller in `src/controllers/profile.controller.ts`
  - [ ] Extracts `:username` from route params
  - [ ] Fetches user data from `GET /api/users/:username`
  - [ ] Handles 404 if user not found (redirect to `/explore` with error)
  - [ ] Fetches user's public links from response or separate endpoint
  - [ ] Calculates stats (total links, total likes, total views)
  - [ ] Passes data to template

- [ ] **FE-5.2** Create profile template in `views/pages/profile.ejs`
  - [ ] Profile header: Avatar, name, username, bio, rank badge
  - [ ] Stats section: Links count, likes received, total views
  - [ ] Links grid/list using `link-card.ejs` partial
  - [ ] Tabs for filtering: "All", "Public", "Top Liked" (client-side or server-side)
  - [ ] Empty state if user has no public links
  - [ ] Follow button (if feature exists) or "Share profile" button
  - [ ] Mobile responsive (profile header stacks)

- [ ] **FE-5.3** Avatar fallback
  - [ ] Shows user avatar if uploaded
  - [ ] Falls back to initial-based avatar (first letter of username)
  - [ ] Default placeholder if no avatar and no username
  - [ ] Alt text for accessibility

- [ ] **FE-5.4** SEO optimization
  - [ ] Dynamic title: "@username - URLoft" or "username's links - URLoft"
  - [ ] Meta description: Uses bio or default description
  - [ ] OG tags with user avatar as image
  - [ ] Canonical URL

- [ ] **FE-5.5** Error handling
  - [ ] 404 if user not found → Redirect to `/explore` with flash error
  - [ ] Graceful degradation if API fails

**Acceptance Criteria:**
- Profile page loads for valid usernames
- User info displays correctly (avatar, name, bio, stats)
- Links display with correct filtering
- 404 redirects correctly for invalid usernames
- SEO tags are dynamic per user
- Mobile responsive

---

### Phase FE-6: Auth Pages - Login ⚠️ VERIFIED (Security Warning)

> **Goal:** User authentication with email/password
>
> **Files:** `src/controllers/auth/login.controller.ts`, `views/pages/auth/login.ejs`

> **⚠️ VERIFIED:** Funcional pero falta CSRF protection. "Remember me" checkbox no funcional.

- [x] **FE-6.1** Create login controller in `src/controllers/auth/login.controller.ts`
  - [ ] GET handler: Renders login form
  - [ ] POST handler: Extracts email, password from form data
  - [ ] Calls `POST /api/auth/login` with credentials
  - [ ] Handles success: Redirects to `/dashboard` or `?next=` URL
  - [ ] Handles errors: Displays error message (invalid credentials, etc.)
  - [ ] Implements "Remember me" checkbox (if backend supports)
  - [ ] Rate limiting feedback (if applicable)

- [ ] **FE-6.2** Create login template in `views/pages/auth/login.ejs`
  - [ ] Login form: Email input, Password input, Remember me checkbox
  - [ ] Submit button: "Log In"
  - [ ] Link to register: "Don't have an account? Sign up"
  - [ ] Link to forgot password: "Forgot password?"
  - [ ] Form validation: Required fields, email format
  - [ ] Error message display (inline or flash)
  - [ ] Loading state on submit (disable button, show spinner)
  - [ ] Accessible labels and ARIA attributes
  - [ ] Mobile responsive

- [ ] **FE-6.3** Integration
  - [ ] On successful login, session cookie set correctly
  - [ ] Redirects to `/dashboard` or `?next=` URL
  - [ ] User menu shows in nav after login
  - [ ] Flash message shows on successful login (optional)

- [ ] **FE-6.4** Security
  - [ ] Password input type="password"
  - [ ] CSRF token (if implemented)
  - [ ] Error messages don't leak sensitive info

**Acceptance Criteria:**
- Login form displays correctly
- Valid credentials redirect to dashboard
- Invalid credentials show error message
- "Remember me" works (if backend supports)
- "Forgot password" link works
- Form validation works client-side
- Session persists after login

---

### Phase FE-7: Auth Pages - Register ✅ FIXED & VERIFIED

> **Goal:** New user registration with email verification
>
> **Files:** `src/controllers/auth/register.controller.ts`, `views/pages/auth/register.ejs`

> **✅ FIXED:** Endpoint corregido a `/api/auth/register`, payload arreglado (quitado username), template actualizado.

- [x] **FE-7.1** Create register controller in `src/controllers/auth/register.controller.ts`
  - [ ] GET handler: Renders registration form
  - [ ] POST handler: Extracts name, username, email, password, confirm password
  - [ ] Client-side validation: Required fields, email format, password match, username format
  - [ ] Calls `POST /api/auth/register` with user data
  - [ ] Handles success: Redirects to `/dashboard` or verification pending page
  - [ ] Handles errors: Displays error message (email taken, username taken, weak password, etc.)

- [ ] **FE-7.2** Create register template in `views/pages/auth/register.ejs`
  - [ ] Registration form: Name input, Username input, Email input, Password input, Confirm password input
  - [ ] Submit button: "Create Account"
  - [ ] Link to login: "Already have an account? Log in"
  - [ ] Password strength indicator (optional)
  - [ ] Terms of service checkbox (if applicable)
  - [ ] Error message display
  - [ ] Loading state on submit
  - [ ] Accessible labels and ARIA
  - [ ] Mobile responsive

- [ ] **FE-7.3** Client-side validation
  - [ ] Username: Alphanumeric, 3-20 chars (or similar constraints)
  - [ ] Email: Valid email format
  - [ ] Password: Min 8 chars, shows strength indicator
  - [ ] Confirm password: Matches password
  - [ ] Real-time validation feedback (optional)

- [ ] **FE-7.4** Post-registration flow
  - [ ] Success message: "Account created! Check your email to verify."
  - [ ] Redirect to `/dashboard` or stay on page with message
  - [ ] Email verification instructions visible

**Acceptance Criteria:**
- Register form displays correctly
- Form validation works client-side
- Valid registration creates user and redirects
- Duplicate email/username shows appropriate error
- Weak password shows error
- Password confirmation works
- Success message displays after registration

---

### Phase FE-8: Auth Pages - Forgot Password ✅ VERIFIED

> **Goal:** Password recovery via email
>
> **Files:** `src/controllers/auth/forgot-password.controller.ts`, `views/pages/auth/forgot-password.ejs`

- [x] **FE-8.1** Create forgot password controller
  - [ ] GET handler: Renders email input form
  - [ ] POST handler: Extracts email, calls `POST /api/auth/forgot-password`
  - [ ] Handles success: "Check your email for reset link"
  - [ ] Handles errors: Invalid email, rate limit, etc.

- [ ] **FE-8.2** Create forgot password template
  - [ ] Form: Email input, Submit button "Send Reset Link"
  - [ ] Instructions: "Enter your email and we'll send you a reset link"
  - [ ] Link back to login
  - [ ] Success state: "Email sent! Check your inbox."
  - [ ] Error message display
  - [ ] Mobile responsive

**Acceptance Criteria:**
- Form displays correctly
- Valid email shows success message
- Invalid email shows error
- Success message is clear and actionable
- Link to login works

---

### Phase FE-9: Auth Pages - Reset Password ✅ VERIFIED

> **Goal:** Set new password with reset token
>
> **Files:** `src/controllers/auth/reset-password.controller.ts`, `views/pages/auth/reset-password.ejs`

- [x] **FE-9.1** Create reset password controller
  - [ ] GET handler: Extracts `:token` from params, validates token (or just shows form)
  - [ ] POST handler: Extracts token, password, confirm password
  - [ ] Calls `POST /api/auth/reset-password` with token and new password
  - [ ] Handles success: "Password updated! Log in with new password"
  - [ ] Handles errors: Invalid token, expired token, passwords don't match, weak password

- [ ] **FE-9.2** Create reset password template
  - [ ] Form: Password input, Confirm password input, Submit button "Reset Password"
  - [ ] Token passed via hidden input or URL param
  - [ ] Link to request new reset if token expired
  - [ ] Success state: Redirect to login with success message
  - [ ] Error message display
  - [ ] Password strength indicator
  - [ ] Mobile responsive

**Acceptance Criteria:**
- Form displays correctly with token
- Valid token and matching passwords update password
- Invalid/expired token shows error
- Success redirects to login
- Password confirmation works
- Link to request new reset works

---

### Phase FE-10: Auth Pages - Verify Email ✅ VERIFIED

> **Goal:** Email verification after registration
>
> **Files:** `src/controllers/auth/verify.controller.ts`, `views/pages/auth/verify.ejs`

- [x] **FE-10.1** Create verify controller
  - [ ] GET handler: Extracts `:token` from params
  - [ ] Calls `GET /api/auth/verify/:token`
  - [ ] Handles success: "Email verified! You can now log in"
  - [ ] Handles errors: Invalid token, expired token, already verified

- [ ] **FE-10.2** Create verify template
  - [ ] Success state: Checkmark animation, "Email verified!", link to login
  - [ ] Error state: "Invalid or expired token", link to request new verification
  - [ ] Auto-redirect to login after 3 seconds (optional)

**Acceptance Criteria:**
- Valid token shows success message
- Invalid/expired token shows error
- Success links to login
- Error allows requesting new verification

---

### Phase FE-11: Dashboard - Home ✅ VERIFIED (Minor gaps)

> **Goal:** Dashboard landing with user stats and quick actions
>
> **Files:** `src/controllers/dashboard/index.controller.ts`, `views/pages/dashboard/index.ejs`

- [x] **FE-11.1** Create dashboard home controller
  - [ ] Checks auth (redirects to `/auth/login` if not authenticated)
  - [ ] Fetches user stats from `GET /api/stats/me`
  - [ ] Fetches recent links from `GET /api/links/me?limit=5`
  - [ ] Fetches recent favorites (optional)
  - [ ] Passes data to template

- [ ] **FE-11.2** Create dashboard home template
  - [ ] Stats cards: Total links, Total likes received, Total views, Rank badge
  - [ ] Quick actions: "New Link", "Import Bookmarks", "Edit Profile"
  - [ ] Recent links table: Title, URL, Created date, Actions (edit, delete)
  - [ ] Empty state if no links yet
  - [ ] Mobile responsive (stats stack, table scrolls)

- [ ] **FE-11.3** Navigation
  - [ ] Dashboard sidebar/nav visible
  - [ ] Active page highlighted
  - [ ] Quick links to other dashboard pages

**Acceptance Criteria:**
- Dashboard loads only for authenticated users
- Stats display correctly
- Recent links show with correct data
- Quick actions navigate to correct pages
- Empty state displays for new users
- Mobile responsive

---

### Phase FE-12: Dashboard - Links CRUD ✅ VERIFIED (Warning: gaps)

> **Goal:** Create, read, update, delete user's links
>
> **Files:** `src/controllers/dashboard/links.controller.ts`, `views/pages/dashboard/links.ejs`

- [x] **FE-12.1** Create links controller
  - [ ] GET handler: Fetches user's links from `GET /api/links/me`
  - [ ] Supports filters: category, search, sort, pagination
  - [ ] POST create handler: Extracts URL, title, description, category, is_public
  - [ ] POST edit handler: Extracts link ID and updated fields
  - [ ] POST delete handler: Extracts link ID, confirms deletion
  - [ ] Handles errors (validation, not found, unauthorized)
  - [ ] Generates short code if not provided

- [ ] **FE-12.2** Create links template
  - [ ] Links table/grid: Title, URL (short link), Category, Created date, Views, Likes, Actions
  - [ ] Create link button → Opens modal or form
  - [ ] Create/edit modal: URL input, Title input, Description textarea, Category dropdown, Public/Private toggle, Submit button
  - [ ] Delete confirmation modal
  - [ ] Pagination (if many links)
  - [ ] Search bar (client-side or server-side)
  - [ ] Filter by category dropdown
  - [ ] Empty state: "No links yet. Create your first link!"
  - [ ] Mobile responsive

- [ ] **FE-12.3** Link preview
  - [ ] When URL entered, fetches OG metadata via `POST /api/links/preview`
  - [ ] Auto-fills title, description from preview
  - [ ] Shows loading state while fetching
  - [ ] Handles preview errors (graceful degradation)

- [ ] **FE-12.4** Short code generation
  - [ ] Auto-generates short code if not provided
  - [ ] Validates short code uniqueness
  - [ ] Shows short link in table after creation

- [ ] **FE-12.5** Integration
  - [ ] Create link → Redirects back to links page with success message
  - [ ] Edit link → Updates in place, shows success message
  - [ ] Delete link → Removes from list, shows success message
  - [ ] Errors show inline or via flash

**Acceptance Criteria:**
- Links list loads with user's links
- Create link works with validation
- Edit link updates correctly
- Delete link removes with confirmation
- Link preview auto-fills metadata
- Short codes generate correctly
- Pagination works
- Search/filter works
- Mobile responsive

---

### Phase FE-13: Dashboard - Categories CRUD ✅ VERIFIED

> **Goal:** Create, read, update, delete user's categories
>
> **Files:** `src/controllers/dashboard/categories.controller.ts`, `views/pages/dashboard/categories.ejs`

- [x] **FE-13.1** Create categories controller
  - [ ] GET handler: Fetches user's categories from `GET /api/categories`
  - [ ] POST create handler: Extracts name, color
  - [ ] POST edit handler: Extracts category ID and updated fields
  - [ ] POST delete handler: Extracts category ID, handles reassign or delete links
  - [ ] Handles errors (validation, duplicate name, not found)

- [ ] **FE-13.2** Create categories template
  - [ ] Categories list/grid: Name, Color preview, Links count, Actions (edit, delete)
  - [ ] Create category button → Opens modal or form
  - [ ] Create/edit modal: Name input, Color picker, Submit button
  - [ ] Delete confirmation with option: "Reassign links to category" or "Delete all links in category"
  - [ ] Empty state: "No categories yet. Create one to organize your links!"
  - [ ] Mobile responsive

- [ ] **FE-13.3** Color picker
  - [ ] Predefined color palette
  - [ ] Or custom color input (type="color")
  - [ ] Color preview in category list

**Acceptance Criteria:**
- Categories list loads correctly
- Create category works with validation
- Edit category updates correctly
- Delete category handles links (reassign or delete)
- Color picker works
- Duplicate name shows error
- Mobile responsive

---

### Phase FE-14: Dashboard - Favorites ✅ PASS (Checklist Complete)

> **Goal:** View and manage favorited links
>
> **Files:** `src/controllers/dashboard/favorites.controller.ts`, `views/pages/dashboard/favorites.ejs`

- [x] **FE-14.1** Create favorites controller
  - [ ] GET handler: Fetches user's favorites from `GET /api/links/me/favorites`
  - [ ] Supports filters: category, search, sort, pagination
  - [ ] Handles empty state

- [x] **FE-14.2** Create favorites template
  - [ ] Favorites list using `link-card.ejs` partial
  - [ ] Each card has "Remove from favorites" button (unlike)
  - [ ] Search bar
  - [ ] Filter by category
  - [ ] Empty state: "No favorites yet. Like links to save them here!"
  - [ ] Mobile responsive

- [x] **FE-14.3** Integration
  - [ ] Unlike button works via HTMX (calls `POST /links/:id/favorite`)
  - [ ] Removes from list immediately
  - [ ] Success feedback

**Acceptance Criteria:**
- Favorites list loads correctly
- Unlike button removes from favorites
- Search/filter works
- Empty state displays
- Mobile responsive

---

### Phase FE-15: Dashboard - Profile Editing ✅ FIXED (Functional)

> **Goal:** Edit user profile (name, bio, avatar, password)
>
> **Files:** `src/controllers/dashboard/profile.controller.ts`, `views/pages/dashboard/profile.ejs`

- [x] **FE-15.1** Create profile controller
  - [ ] GET handler: Fetches user data from `GET /api/users/me` (or session data)
  - [ ] POST profile handler: Extracts name, bio, avatar
  - [ ] POST password handler: Extracts current password, new password, confirm password
  - [ ] Handles file upload for avatar (multipart form)
  - [ ] Handles errors (validation, wrong current password, weak password)

- [ ] **FE-15.2** Create profile template
  - [ ] Profile form:
    - Name input
    - Username input (readonly or editable with warning)
    - Bio textarea
    - Avatar upload (file input or drag-drop)
    - Current avatar preview
    - Submit button "Save Changes"
  - [ ] Password form (separate section or modal):
    - Current password input
    - New password input
    - Confirm new password input
    - Submit button "Change Password"
  - [ ] Success messages for each form
  - [ ] Error messages inline
  - [ ] Loading states
  - [ ] Mobile responsive

- [ ] **FE-15.3** Avatar upload
  - [ ] File input accepts images (jpg, png, gif)
  - [ ] Drag-drop zone for file upload
  - [ ] Preview of selected image before upload
  - [ ] File size validation (max 2MB or similar)
  - [ ] Shows loading state during upload
  - [ ] Updates avatar preview after successful upload

- [ ] **FE-15.4** Password change validation
  - [ ] Current password required
  - [ ] New password min 8 chars
  - [ ] Confirm password matches new password
  - [ ] Shows error if current password is wrong
  - [ ] Shows success message on update

**Acceptance Criteria:**
- Profile loads with current user data
- Name/bio update works
- Avatar upload works with preview
- Password change works with validation
- Success/error messages display correctly
- Mobile responsive

---

### Phase FE-16: Dashboard - API Keys ✅ VERIFIED

> **Goal:** Create and revoke API keys for external integrations
>
> **Files:** `src/controllers/dashboard/keys.controller.ts`, `views/pages/dashboard/keys.ejs`

- [x] **FE-16.1** Create API keys controller
  - [ ] GET handler: Fetches user's API keys from `GET /api/keys`
  - [ ] POST create handler: Calls `POST /api/keys`, returns new key
  - [ ] POST delete handler: Extracts key ID, calls `DELETE /api/keys/:id`
  - [ ] Handles errors (validation, not found, unauthorized)

- [ ] **FE-16.2** Create API keys template
  - [ ] API keys list: Name, Key prefix (urlk_***), Last used, Created date, Actions (delete, copy)
  - [ ] Create key button → Opens modal or form
  - [ ] Create modal: Name input, Submit button "Create API Key"
  - [ ] New key display: Shows full key, Copy button, Warning ("Save this key, you won't see it again!")
  - [ ] Delete confirmation modal
  - [ ] Empty state: "No API keys yet. Create one to integrate with external tools."
  - [ ] Mobile responsive

- [ ] **FE-16.3** Key security
  - [ ] New key shown only once
  - [ ] Copy to clipboard button works
  - [ ] Key masked in list (urlk_a1b2...)
  - [ ] Delete confirmation prevents accidental deletion

**Acceptance Criteria:**
- API keys list loads correctly
- Create key generates new key and shows it
- Copy button works
- Delete key removes with confirmation
- Security warnings displayed
- Mobile responsive

---

### Phase FE-17: Dashboard - Import Bookmarks ✅ PASS

> **Goal:** Import bookmarks from browser HTML export
>
> **Files:** `src/controllers/dashboard/import.controller.ts`, `views/pages/dashboard/import.ejs`

- [x] **FE-17.1** Create import controller
  - [ ] GET handler: Renders import page with instructions
  - [ ] POST handler: Accepts file upload (multipart form)
  - [ ] Validates file is HTML
  - [ ] Parses Netscape Bookmark File format
  - [ ] Extracts links: URL, title, description, folder (category)
  - [ ] Detects duplicates (URLs already in database)
  - [ ] Calls `POST /api/links/import` with processed data
  - [ ] Handles success: Shows summary (imported, duplicates, categories created)
  - [ ] Handles errors: Invalid file format, parse errors, API errors

- [x] **FE-17.2** Create import template
  - [ ] Instructions section: How to export from Chrome, Firefox
  - [ ] File upload zone: Drag-drop support, file input, "Select file" button
  - [ ] Format info: "Accepts Netscape Bookmark File format (.html)"
  - [ ] Upload progress indicator
  - [ ] Summary view (post-upload):
    - Stats: X links imported, Y duplicates skipped, Z categories created
    - Table of imported links (preview)
    - "View my links" button → `/dashboard/links`
    - "Import more" button → Reset form
  - [ ] Error states: Invalid file, parse error, API error
  - [ ] Mobile responsive

- [x] **FE-17.3** Parser logic
  - [ ] Handles Netscape Bookmark File format correctly
  - [ ] Extracts `<A HREF="...">Title</A>` links
  - [ ] Extracts `<DD>` descriptions
  - [ ] Converts folders (`<H3>`) to categories
  - [ ] Handles nested folders (flattens or preserves hierarchy)
  - [ ] Ignores non-link elements
  - [ ] Handles encoding (UTF-8)

- [x] **FE-17.4** Integration
  - [ ] Backend endpoint `POST /api/links/import` called correctly
  - [ ] Response displays correctly in summary
  - [ ] Imported links visible in `/dashboard/links`
  - [ ] Categories created visible in `/dashboard/categories`

**Acceptance Criteria:**
- Import page loads with instructions
- File upload works with drag-drop and file input
- Parser handles standard browser exports
- Duplicates detected and skipped
- Categories created from folders
- Summary shows correct stats
- Imported links appear in dashboard
- Mobile responsive

---

### Phase FE-18: Short Links Redirect ✅ PASS

> **Goal:** Redirect short codes to original URLs and track views
>
> **Files:** `src/controllers/short-link.controller.ts`

- [x] **FE-18.1** Create short link controller
  - [ ] Extracts `:code` from route params
  - [ ] Calls backend `GET /s/:code` or directly queries DB
  - [ ] Handles success: Redirects to original URL (301 or 302)
  - [ ] Handles 404: Shows "Link not found" page or redirects to home
  - [ ] Tracks view count (if not handled by backend)

- [x] **FE-18.2** Error handling
  - [ ] Invalid code shows 404 page
  - [ ] Private links show auth required page
  - [ ] Graceful degradation if backend down

**Acceptance Criteria:**
- Valid short codes redirect correctly
- View count increments
- Invalid codes show 404
- Private links require auth

---

### Phase FE-19: HTMX Partials - Like Button ✅ PASS

> **Goal:** Toggle like on links without page reload
>
> **Files:** `src/controllers/links/like.controller.ts`, `views/partials/like-button.ejs`

- [x] **FE-19.1** Create like controller
  - [ ] POST handler: Extracts link ID, user session
  - [ ] Calls `POST /api/links/:id/like`
  - [ ] Returns updated `like-button.ejs` partial with new state
  - [ ] Handles errors (not found, unauthorized)

- [x] **FE-19.2** Create like button partial
  - [ ] Shows "Like" button if not liked
  - [ ] Shows "Liked" button (filled) if liked
  - [ ] Shows like count
  - [ ] HTMX attributes: `hx-post="/links/:id/like"`, `hx-target="this"`, `hx-swap="outerHTML"`
  - [ ] Loading state (hx-indicator)
  - [ ] Accessible ARIA labels

**Acceptance Criteria:**
- Like button toggles without reload
- Like count updates
- Visual state changes (empty/filled)
- Works on explore, home, profile pages
- Mobile responsive

---

### Phase FE-20: HTMX Partials - Favorite Button ✅ PASS

> **Goal:** Toggle favorite on links without page reload
>
> **Files:** `src/controllers/links/favorite.controller.ts`, `views/partials/favorite-button.ejs`

- [x] **FE-20.1** Create favorite controller
  - [ ] POST handler: Extracts link ID, user session
  - [ ] Calls `POST /api/links/:id/favorite`
  - [ ] Returns updated `favorite-button.ejs` partial with new state
  - [ ] Handles errors (not found, unauthorized)

- [x] **FE-20.2** Create favorite button partial
  - [ ] Shows "Favorite" button (star outline) if not favorited
  - [ ] Shows "Favorited" button (star filled) if favorited
  - [ ] HTMX attributes: `hx-post="/links/:id/favorite"`, `hx-target="this"`, `hx-swap="outerHTML"`
  - [ ] Loading state (hx-indicator)
  - [ ] Accessible ARIA labels

**Acceptance Criteria:**
- Favorite button toggles without reload
- Visual state changes (outline/filled)
- Works on explore, home, profile, dashboard pages
- Mobile responsive

---

### Phase FE-21: Link Card Component ✅ PASS

> **Goal:** Reusable link card with consistent styling
>
> **Files:** `views/partials/link-card.ejs`

- [x] **FE-21.1** Create link card partial
  - [ ] Displays OG image or favicon fallback
  - [ ] Shows title (links to `/s/:code` for tracking)
  - [ ] Shows description (truncated if long)
  - [ ] Shows domain name or short URL
  - [ ] Shows stats: Views, Likes, Favorites count
  - [ ] Includes like-button and favorite-button partials
  - [ ] Hover effects
  - [ ] Mobile responsive (stacks on small screens)

- [x] **FE-21.2** Data binding
  - [ ] Accepts link object with all fields
  - [ ] Handles missing OG image (graceful fallback)
  - [ ] Handles missing description
  - [ ] Shows user avatar/username (if on explore/profile)

**Acceptance Criteria:**
- Card displays all link info correctly
- Fallbacks work for missing data
- Like/favorite buttons work
- Mobile responsive
- Consistent styling across pages

---

### Phase FE-22: Error Pages ✅ PASS

> **Goal:** User-friendly error pages
>
> **Files:** `views/pages/error.ejs`, error handling middleware

- [x] **FE-22.1** Create error template
  - [ ] Dynamic error code (404, 500, 403, etc.)
  - [ ] User-friendly error message
  - [ ] Illustration or icon
  - [ ] "Go home" button
  - [ ] "Go back" button
  - [ ] Contact link (if 500)
  - [ ] Mobile responsive

- [x] **FE-22.2** Error handling
  - [ ] 404: Page not found (invalid route)
  - [ ] 403: Forbidden (no access to private resource)
  - [ ] 500: Server error (API down, exception)
  - [ ] Custom error messages per context

**Acceptance Criteria:**
- 404 page shows for invalid routes
- 500 page shows for server errors
- Error pages are user-friendly
- Navigation back to home works
- Mobile responsive

---

### Phase FE-23: PWA Configuration (OPTIONAL)

> **Goal:** Progressive Web App setup for mobile install
>
> **Files:** `public/manifest.json`, `public/sw.js`

- [ ] **FE-23.1** Create PWA manifest
  - [ ] App name, short name
  - [ ] Description
  - [ ] Icons (192x192, 512x512)
  - [ ] Start URL: `/`
  - [ ] Display mode: standalone
  - [ ] Theme color, background color
  - [ ] Orientation: any

- [ ] **FE-23.2** Create service worker
  - [ ] Cache static assets (CSS, JS, images)
  - [ ] Offline fallback page
  - [ ] Cache strategy: cache-first for static, network-first for API
  - [ ] Cache versioning for updates

- [ ] **FE-23.3** Install prompt
  - [ ] Detect `beforeinstallprompt` event
  - [ ] Show "Install App" button
  - [ ] Handle install click
  - [ ] Hide button after install

**Acceptance Criteria:**
- App is installable on mobile
- Works offline (cached pages)
- Service worker updates correctly
- Install prompt works

---

### Phase FE-24: Security Hardening (OPTIONAL)

> **Goal:** CSRF protection and security headers
>
> **Files:** `src/utils/csrf.ts`, middleware

- [ ] **FE-24.1** Implement CSRF tokens
  - [ ] Generate CSRF token on session start
  - [ ] Include token in all forms (hidden input)
  - [ ] Validate token on POST/PUT/DELETE
  - [ ] Reject invalid tokens with 403

- [ ] **FE-24.2** Add security headers
  - [ ] Content-Security-Policy
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Referrer-Policy

**Acceptance Criteria:**
- CSRF tokens present in forms
- Invalid tokens rejected
- Security headers set correctly

---

### Phase FE-25: Production Optimizations (OPTIONAL)

> **Goal:** Optimize assets and performance
>
> **Files:** Build scripts, asset optimization

- [ ] **FE-25.1** Migrate Tailwind CDN to bundling
  - [ ] Install `@tailwindcss/vite`
  - [ ] Configure Vite for CSS bundling
  - [ ] Purge unused Tailwind classes
  - [ ] Minify CSS

- [ ] **FE-25.2** Optimize images
  - [ ] Compress logo/favicon
  - [ ] Use modern formats (WebP)
  - [ ] Lazy load images

- [ ] **FE-25.3** Asset hashing
  - [ ] Add hash to filenames for cache busting
  - [ ] Update references in templates

**Acceptance Criteria:**
- CSS bundled and minified
- Images compressed
- Asset hashing works
- Cache busting functional

---

### Phase FE-26: Testing (OPTIONAL)

> **Goal:** E2E tests for critical flows
>
> **Files:** Playwright tests

- [ ] **FE-26.1** Setup Playwright
  - [ ] Install Playwright
  - [ ] Configure browsers (Chrome, Firefox)
  - [ ] Set up test database

- [ ] **FE-26.2** Write E2E tests
  - [ ] Test: Register → Login → Create link → Verify in dashboard
  - [ ] Test: Explore search and filters
  - [ ] Test: Like/favorite toggles
  - [ ] Test: Profile viewing
  - [ ] Test: Import bookmarks

**Acceptance Criteria:**
- All critical flows tested
- Tests pass consistently
- CI/CD integration (optional)

---

## 🔌 Backend API Integration

All frontend phases must integrate correctly with these backend endpoints:

### Auth Endpoints
- `POST /api/auth/register` → Registro de usuario
- `POST /api/auth/login` → Iniciar sesión (setea cookie)
- `POST /api/auth/logout` → Cerrar sesión
- `GET /api/auth/verify/:token` → Verificar email
- `POST /api/auth/forgot-password` → Solicitar recuperación
- `POST /api/auth/reset-password` → Restablecer contraseña

### Links Endpoints
- `GET /api/links` → Listar links públicos (con filtros)
- `POST /api/links` → Crear link
- `PUT /api/links/:id` → Editar link
- `DELETE /api/links/:id` → Eliminar link
- `GET /api/links/me` → Mis links (con stats)
- `GET /api/links/me/favorites` → Mis favoritos
- `POST /api/links/:id/like` → Dar/quitar like
- `POST /api/links/:id/favorite` → Agregar/quitar favorito
- `POST /api/links/preview` → Extraer metadata OG
- `POST /api/links/import` → Importar bookmarks HTML

### Categories Endpoints
- `GET /api/categories` → Listar categorías del usuario
- `POST /api/categories` → Crear categoría
- `PUT /api/categories/:id` → Editar categoría
- `DELETE /api/categories/:id` → Eliminar categoría

### Stats Endpoints
- `GET /api/stats/me` → Stats del usuario
- `GET /api/stats/global` → Stats globales

### Users Endpoints
- `GET /api/users/:username` → Perfil público
- `PUT /api/users/me` → Editar perfil
- `PUT /api/users/me/password` → Cambiar contraseña

### Short Links
- `GET /s/:code` → Redirect al link original

---

## 🚀 Development Workflow

### Correr el frontend EJS

```bash
# Terminal 1: Backend
cd backend
bun run dev

# Terminal 2: Frontend EJS
cd frontend-bun-ejs
bun run dev
```

- Backend corre en `http://localhost:3000`
- Frontend EJS corre en `http://localhost:3001` (o puerto configurado)
- Frontend hace fetch a `http://localhost:3000/api/*`

### Debugging Tips

- Check browser console for JS errors
- Check Network tab for API call failures
- Check backend logs for server errors
- Use `console.log()` in controllers for debugging
- Test forms with invalid data to see error handling

---

## 📝 Documentación Adicional

- **Backend API Docs:** `documentacion/api-doc.md`
- **Backend Tasks:** `tasks/Phase01.md` - `tasks/Phase06.md`
- **Main Tasks:** `TASKS.md` (backend-focused)
- **Technical Architecture:** `AGENTS.md`

---

**Última actualización:** 2026-03-27 (consistency pass de estados FE)
**Status:** 🔄 MIXED - FE-17..FE-22 en PASS; el resto mantiene su estado actual por fase

**Next Step:** Continuar verificación/cierre por fase según el estado indicado en cada bloque
