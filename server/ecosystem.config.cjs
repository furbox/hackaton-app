module.exports = {
  apps: [
    {
      name: "urloft-backend",
      cwd: "/home/urloft/backend",
      script: "index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3000
      }
    },
    {
      name: "urloft-frontend",
      cwd: "/home/urloft/frontend-bun-ejs",
      script: "build/index.js",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 4173,
        ORIGIN: "https://urloft.site"
      }
    }
  ]
};
