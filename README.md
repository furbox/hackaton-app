# urloft.site

A multi-user link management web app built with Bun, Elysia, and SvelteKit.

## Features

- **Link Management**: Create, organize, and share short URLs
- **Categories**: Organize links with custom categories
- **Social Features**: Like and favorite public links
- **Analytics**: Track views, likes, and saves on your links
- **Rank System**: Earn badges (Iron → Bronze → Silver → Gold → Diamond) based on your public link count
- **Public Profiles**: Showcase your links with customizable profiles
- **Public Homepage**: Featured links and platform stats
- **Rate Limiting**: Protection against abuse on redirect endpoints

## Tech Stack

### Backend
- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: SQLite (WAL mode)
- **Auth**: JWT (access tokens, 24h expiry)
- **Email**: Resend
- **Rate Limiting**: In-memory IP-based rate limiter

### Frontend
- **Framework**: SvelteKit
- **Styling**: Tailwind CSS
- **State**: Svelte stores
- **API Client**: Custom fetch wrapper with JWT handling

## Project Structure

```
hackaton-app/
├── apps/
│   ├── backend/      # Elysia REST API
│   │   ├── src/
│   │   │   ├── db/          # Database schema and client
│   │   │   ├── middleware/  # Auth and rate limiting
│   │   │   ├── modules/     # Domain modules (auth, users, links, etc.)
│   │   │   └── utils/       # Utility functions
│   │   └── package.json
│   └── frontend/     # SvelteKit web app
│       ├── src/
│       │   ├── lib/         # Components, stores, API client
│       │   └── routes/      # Pages and layouts
│       └── package.json
├── docs/             # Technical documentation
├── package.json      # Workspace configuration
├── AGENTS.md         # AI agent instructions
└── README.md
```

## Setup

### Prerequisites
- Bun >= 1.1
- Node.js >= 18 (for some frontend dependencies)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/furbox/hackaton-app.git
cd hackaton-app
```

2. Install dependencies:
```bash
bun install
```

3. Create environment files:
```bash
cp .env.example .env
```

4. Configure your environment variables (see `.env.example`):
- Get a free Resend API key from https://resend.com
- Set your `JWT_SECRET` to a random string (use: `openssl rand -base64 32`)
- Configure `APP_URL` (e.g., http://localhost:5173 for dev)
- Configure `DATABASE_PATH` (default: ./database.sqlite)

5. Run the development servers:
```bash
bun run dev
```

This starts both backend (http://localhost:3000) and frontend (http://localhost:5173).

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/verify?token=` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Links
- `GET /api/links/public` - Get latest public links (no auth)
- `GET /api/links` - List own links (authenticated)
- `POST /api/links` - Create new link
- `GET /api/links/:id` - Get link details
- `PATCH /api/links/:id` - Update link
- `DELETE /api/links/:id` - Delete link
- `POST /api/links/:id/like` - Like a link
- `DELETE /api/links/:id/like` - Unlike a link
- `POST /api/links/:id/favorite` - Favorite a link
- `DELETE /api/links/:id/favorite` - Unfavorite a link

### Redirect
- `GET /r/:code` - Short URL redirect (rate limited: 60/min per IP)

### Stats
- `GET /api/stats/top?period=&metric=` - Get top links by period/metric
- `GET /api/stats/link/:id?period=` - Get link analytics

### Users
- `GET /api/users/me` - Get own profile
- `PATCH /api/users/me` - Update profile
- `GET /api/users/:username` - Get public profile

### Badges
- `GET /api/badges/me` - Get own badges
- `GET /api/badges/:username` - Get public badges

### Categories
- `GET /api/categories` - List own categories
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/:id/links/:linkId` - Add link to category
- `DELETE /api/categories/:id/links/:linkId` - Remove link from category

### Dashboard
- `GET /api/dashboard` - Get dashboard links with filters

## Security Features

- **JWT Authentication**: Stateless tokens with 24h expiry
- **Password Hashing**: Argon2id algorithm via Bun.password
- **Rate Limiting**: 60 requests/minute per IP on redirect endpoint
- **IP Hashing**: SHA-256 for GDPR-compliant analytics
- **Input Validation**: All endpoints validate input
- **SQL Injection Prevention**: Parameterized queries only
- **CORS**: Configured for production domain

## Rank System

Users earn ranks based on their total public link count:
- **Iron**: 1+ public links
- **Bronze**: 10+ public links
- **Silver**: 100+ public links
- **Gold**: 1,000+ public links
- **Diamond**: 1,000,000+ public links

Ranks are automatically recalculated when links are created or deleted.

## Contributing

This project uses Spec-Driven Development (SDD). See `AGENTS.md` for AI agent instructions.

### Development Workflow
1. Features are implemented in ordered phases (see design doc)
2. Each phase has its own branch
3. All changes must pass type checking: `bun run --cwd apps/backend tsc --noEmit`
4. Follow the code style conventions in AGENTS.md

## Deployment

### Backend
```bash
cd apps/backend
bun run start
```

### Frontend
```bash
cd apps/frontend
bun run build
bun run start
```

### Environment Variables (Production)
- `DATABASE_PATH` - Path to SQLite database
- `JWT_SECRET` - Strong random string for JWT signing
- `JWT_EXPIRY` - Token expiry in seconds (default: 86400)
- `RESEND_API_KEY` - Resend API key for emails
- `EMAIL_FROM` - Sender email address
- `APP_URL` - Public URL of the application
- `PORT` - Backend port (default: 3000)

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
