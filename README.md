# urloft.site

A multi-user link management web app built with Bun, Elysia, and SvelteKit.

## Features

- **Link Management**: Create, organize, and share short URLs
- **Categories**: Organize links with custom categories
- **Social Features**: Like and favorite public links
- **Analytics**: Track views, likes, and saves on your links
- **Rank System**: Earn badges (Iron → Bronze → Silver → Gold → Diamond) based on your public link count
- **Public Profiles**: Showcase your links with customizable profiles

## Tech Stack

### Backend
- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: SQLite (WAL mode)
- **Auth**: JWT (access tokens, 24h expiry)
- **Email**: Resend

### Frontend
- **Framework**: SvelteKit
- **Styling**: Tailwind CSS
- **State**: Svelte stores

## Project Structure

```
hackaton-app/
├── apps/
│   ├── backend/      # Elysia REST API
│   └── frontend/     # SvelteKit web app
├── docs/             # Technical documentation
├── package.json      # Workspace configuration
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
- Set your `JWT_SECRET` to a random string

5. Run the development servers:
```bash
bun run dev
```

This starts both backend (http://localhost:3000) and frontend (http://localhost:5173).

## API Documentation

API endpoints are documented in `docs/api/` and follow RESTful conventions.

## Contributing

This project uses Spec-Driven Development (SDD). See `AGENTS.md` for AI agent instructions.

## License

MIT
