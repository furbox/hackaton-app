#!/bin/bash
# =============================================================================
# URLoft VPS Setup Script
# =============================================================================
# Este script configura todo lo necesario en el VPS CubePath
# Ejecutar como root en: /root
# =============================================================================

set -e  # Exit on error

echo "🚀 Iniciando setup de URLoft VPS..."
echo "================================================"

# =============================================================================
# 1. ACTUALIZAR SISTEMA
# =============================================================================
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# =============================================================================
# 2. INSTALAR DEPENDENCIAS BÁSICAS
# =============================================================================
echo "📦 Instalando dependencias básicas..."
apt install -y git curl wget vim ufw nginx

# Instalar Node.js (requerido por algunos packages)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalaciones
echo "✓ Git: $(git --version)"
echo "✓ Nginx: $(nginx -v)"
echo "✓ Node: $(node --version)"

# =============================================================================
# 3. INSTALAR BUN RUNTIME
# =============================================================================
echo "🥟 Instalando Bun..."
curl -fsSL https://bun.sh/install | bash

# Agregar Bun al PATH permanente
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "✓ Bun: $(bun --version)"

# =============================================================================
# 4. INSTALAR PM2 GLOBALMENTE
# =============================================================================
echo "🔧 Instalando PM2..."
bun install -g pm2
echo "✓ PM2: $(pm2 --version)"

# =============================================================================
# 5. CREAR DIRECTORIO DEL PROYECTO
# =============================================================================
echo "📁 Creando directorio del proyecto..."
if [ -d "/home/urloft" ]; then
  echo "⚠️  Directorio existe, limpiando..."
  rm -rf /home/urloft
fi
mkdir -p /home/urloft
cd /home/urloft

# =============================================================================
# 6. CLONAR RAMA PROD
# =============================================================================
echo "📥 Clonando rama prod (limpia)..."
git clone --branch prod --single-branch https://github.com/furbox/hackaton-app.git .

echo "✓ Estructura clonada:"
ls -la

# =============================================================================
# 7. INSTALAR DEPENDENCIAS
# =============================================================================
echo "📦 Instalando dependencias del backend..."
bun install --cwd backend --frozen-lockfile

echo "📦 Instalando dependencias del frontend..."
bun install --cwd frontend-bun-ejs --frozen-lockfile

# =============================================================================
# 8. BUILD DEL FRONTEND
# =============================================================================
echo "⚡ Frontend no necesita build (Bun + EJS)..."
echo "✓ Listo para iniciar directamente"

# =============================================================================
# 9. CREAR VARIABLES DE ENTORNO
# =============================================================================
echo "🔐 Creando variables de entorno..."

# Backend .env
cat > backend/.env << 'EOF'
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
BETTER_AUTH_URL=https://api.urloft.site
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
TRUST_PROXY=true
DATABASE_URL=/home/urloft/backend/database.sqlite
RESEND_API_KEY=tu-key-de-resend
EMAIL_FROM=noreply@urloft.site
BASE_URL=https://urloft.site
SHORT_PREFIX=s
API_KEY_PREFIX=urlk
API_RATE_LIMIT=100
MCP_CORS_ORIGINS=https://urloft.site
EOF

# Frontend .env
cat > frontend-bun-ejs/.env << 'EOF'
PORT=3001
URL_BACKEND=https://api.urloft.site
EOF

echo "✓ Variables de entorno creadas"

# =============================================================================
# 10. CONFIGURAR NGINX
# =============================================================================
echo "🌐 Configurando Nginx..."
cp server/nginx/urloft.site.conf /etc/nginx/sites-available/
cp server/nginx/api.urloft.site.conf /etc/nginx/sites-available/

ln -s /etc/nginx/sites-available/urloft.site.conf /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api.urloft.site.conf /etc/nginx/sites-enabled/

rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "✓ Nginx configurado y recargado"

# =============================================================================
# 11. CONFIGURAR FIREWALL
# =============================================================================
echo "🔒 Configurando firewall (UFW)..."

ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

ufw --force enable

ufw status

echo "✓ Firewall configurado"

# =============================================================================
# 12. DAR PERMISOS AL SCRIPT DE DEPLOY
# =============================================================================
echo "📜 Configurando script de deploy..."
chmod +x server/deploy.sh

# =============================================================================
# 13. INICIAR PM2
# =============================================================================
echo "🚀 Iniciando aplicaciones con PM2..."
pm2 start server/ecosystem.config.cjs
pm2 save
pm2 startup

echo "✓ PM2 iniciado y configurado"

# =============================================================================
# 14. VERIFICACIÓN FINAL
# =============================================================================
echo ""
echo "================================================"
echo "✅ SETUP COMPLETADO"
echo "================================================"
echo ""
echo "📊 Servicios corriendo:"
pm2 list
echo ""
echo "🌐 Nginx status:"
systemctl status nginx --no-pager
echo ""
echo "🔗 Prueba los sitios:"
echo "   Frontend: https://urloft.site"
echo "   Backend:  https://api.urloft.site"
echo ""
echo "🚀 Para deploy futuro:"
echo "   Simplemente hace: git push origin prod"
echo "   GitHub Actions hará el resto automáticamente"
echo ""
