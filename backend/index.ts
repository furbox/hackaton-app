// URLoft Backend - Bun Server
// Ultra-fast JavaScript runtime with native SQLite support

import { verifyDatabaseConnection } from "./db/verify.ts";
import { router } from "./router.ts";
import { cors, withCors } from "./middleware/cors.ts";
import { logger } from "./middleware/logger.ts";

const SPLASH_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URLoft Backend</title>
    <style>
        :root {
            --bg: #0f172a;
            --text: #f8fafc;
            --primary: #6366f1;
            --secondary: #94a3b8;
            --accent: #10b981;
        }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
        }
        .container {
            max-width: 600px;
            padding: 2rem;
            border-radius: 1rem;
            background: rgba(30, 41, 59, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(to right, #818cf8, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .status {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(16, 185, 129, 0.1);
            color: var(--accent);
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
        }
        p {
            color: var(--secondary);
            font-size: 1.125rem;
            margin-bottom: 2rem;
        }
        .links {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-bottom: 2rem;
        }
        a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 500;
            transition: opacity 0.2s;
        }
        a:hover {
            opacity: 0.8;
            text-decoration: underline;
        }
        footer {
            font-size: 0.875rem;
            color: var(--secondary);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 URLoft Backend</h1>
        <h2>Christopher Flores</h2>
        <div class="status"><a href="https://urloft.site"> 🔗 URLoft</a></div>
        <div class="status">✅ Running on Bun v${Bun.version}</div>
        <p>Tu biblioteca personal de links, ahora más rápida que nunca.</p>
        <div class="links">
            <a href="/documentacion/README.md">Documentación</a>
            <span>•</span>
            <a href="/documentacion/api-doc.md">API Doc</a>
        </div>
        <footer>Hecho con ❤️ para el Hackathon 2026 Midudev</footer>
    </div>
</body>
</html>
`;

// Verify database before starting server
if (!verifyDatabaseConnection()) {
  console.error("⛔ Cannot start server without a valid database");
  process.exit(1);
}

// Database is ready, start HTTP server
const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    // 1. Logger Middleware
    logger(req);

    // 2. CORS Middleware (Handle OPTIONS)
    const corsResponse = cors(req);
    if (corsResponse) return corsResponse;

    // 3. Centralized Router
    try {
      const response = await router(req);

      // Fallback if no route matched
      const finalResponse = response || new Response(SPLASH_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });

      // 4. Global CORS Headers (on all responses)
      return withCors(finalResponse);
    } catch (error) {
      console.error("❌ Request error:", error);
      return withCors(new Response(JSON.stringify({
        success: false,
        error: "Internal Server Error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
    }
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
