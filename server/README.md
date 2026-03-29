# Deploy server (CubePath + PM2 + Nginx + Cloudflare)

Esta carpeta centraliza la logica de despliegue para correr backend y frontend en el mismo VPS.

## Objetivo

- Frontend: `https://urloft.site`
- Backend API: `https://api.urloft.site`
- Deploy automatico al hacer push a `prod` en GitHub
- Procesos administrados por PM2
- Nginx como reverse proxy para ambos subdominios

## Flujo recomendado

1. Push a `prod`.
2. GitHub Actions detecta que carpetas cambiaron (`backend`, `frontend`, `server`).
3. El workflow calcula el target de deploy (`backend`, `frontend` o `all`).
4. En el VPS, `server/deploy.sh <target> prod` actualiza codigo e instala/build solo lo necesario.
5. PM2 recarga solo la app afectada (o ambas si corresponde).
5. Nginx sigue exponiendo los dominios publicos.

## Archivos de esta carpeta

- `ecosystem.config.cjs`: definicion de apps PM2.
- `deploy.sh`: script de despliegue en VPS con target (`backend|frontend|all`).
- `nginx/urloft.site.conf`: virtual host del frontend.
- `nginx/api.urloft.site.conf`: virtual host del backend.
- `github-actions-deploy.yml`: workflow de ejemplo para `.github/workflows/deploy.yml` con path filtering.

## Estrategia de ramas recomendada

- `main`: integracion general (codigo completo, tests y documentacion).
- `prod`: rama de release para despliegue automatico.

No se recomienda crear una rama `prod` "limpia" borrando tests o `.md`: esos archivos no afectan runtime y mantenerlos evita perdida de contexto tecnico.

## Uso de deploy.sh

```bash
# Deploy completo desde prod
./server/deploy.sh all prod

# Solo backend
./server/deploy.sh backend prod

# Solo frontend
./server/deploy.sh frontend prod
```

## Variables de entorno importantes

Backend:

- `BETTER_AUTH_URL=https://api.urloft.site`
- `TRUST_PROXY=true`
- `PORT=3000`

Frontend:

- `PUBLIC_BACKEND_URL=https://api.urloft.site`
- `PORT=4173`
- `HOST=127.0.0.1`
- `ORIGIN=https://urloft.site`

## Cloudflare

- DNS `A` para `urloft.site` y `api.urloft.site` apuntando al VPS.
- SSL/TLS en modo `Full (strict)`.
- Recomendado: proxy activado (nube naranja) para ambos.
