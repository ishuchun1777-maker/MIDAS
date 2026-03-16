#!/bin/bash
# MIDAS — Production Deploy Script
# Ishlatish: ./scripts/deploy.sh [--env prod|staging] [--skip-tests]
# scripts/deploy.sh

set -euo pipefail

# ─── Konfiguratsiya ───────────────────────
ENV="${1:-prod}"
SKIP_TESTS="${2:-}"
APP_DIR="/opt/midas"
LOG_FILE="/var/log/midas/deploy-$(date +%Y%m%d-%H%M%S).log"
COMPOSE="docker-compose -f docker-compose.prod.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()     { echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠ $1${NC}" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[$(date '+%H:%M:%S')] ✗ $1${NC}" | tee -a "$LOG_FILE"; exit 1; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓ $1${NC}" | tee -a "$LOG_FILE"; }

mkdir -p /var/log/midas
log "MIDAS deploy boshlandi (env: $ENV)"

# ─── 1. Pre-checks ────────────────────────
cd "$APP_DIR"

log "Git pull..."
git pull origin main
GIT_SHA=$(git rev-parse --short HEAD)
log "Commit: $GIT_SHA"

# .env mavjudligini tekshirish
[[ -f ".env" ]] || error ".env fayl topilmadi!"

# ─── 2. DB Backup ─────────────────────────
log "DB backup..."
BACKUP_FILE="/var/backups/midas/db-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p /var/backups/midas
$COMPOSE exec -T postgres pg_dump -U midas_user midas_db > "$BACKUP_FILE" 2>/dev/null \
  && success "DB backup: $BACKUP_FILE" \
  || warn "DB backup muvaffaqiyatsiz (muhim emas — davom etamiz)"

# ─── 3. Docker image pull ─────────────────
log "Docker imagelar yangilanmoqda..."
$COMPOSE pull api bot || error "Image pull muvaffaqiyatsiz"

# ─── 4. DB Migrations ─────────────────────
log "DB migratsiyalar..."
$COMPOSE run --rm api npx prisma migrate deploy \
  && success "Migratsiyalar bajarildi" \
  || error "Migratsiya muvaffaqiyatsiz!"

# ─── 5. Zero-downtime API restart ─────────
log "API zero-downtime restart..."
$COMPOSE up -d --no-deps --scale api=2 api
log "Yangi API instance turgunligini kutmoqda (20s)..."
sleep 20

# Health check
HEALTH=$(curl -sf http://localhost:3001/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','err'))" 2>/dev/null || echo "error")
if [[ "$HEALTH" != "ok" ]]; then
  warn "Health check muvaffaqiyatsiz, rollback amalga oshirilmoqda..."
  $COMPOSE up -d --no-deps --scale api=1 api
  error "Deploy bekor qilindi!"
fi

$COMPOSE up -d --no-deps --scale api=1 api
success "API muvaffaqiyatli yangilandi"

# ─── 6. Bot restart ───────────────────────
log "Bot qayta ishga tushirilmoqda..."
$COMPOSE restart bot
sleep 5
$COMPOSE ps bot | grep -q "Up" && success "Bot ishlayapti" || warn "Bot holati noaniq"

# ─── 7. Nginx reload ──────────────────────
log "Nginx konfiguratsiya tekshiruvi..."
$COMPOSE exec nginx nginx -t 2>/dev/null \
  && $COMPOSE exec nginx nginx -s reload \
  && success "Nginx yangilandi" \
  || warn "Nginx reload muvaffaqiyatsiz"

# ─── 8. Post-deploy verification ──────────
log "Deploy tekshiruvi..."
sleep 5

# API health
API_STATUS=$(curl -sf https://api.midas.uz/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','err'))" 2>/dev/null || echo "error")
[[ "$API_STATUS" == "ok" ]] && success "API: ishlayapti" || warn "API: javob bermayapti (DNS propagation kutilishi mumkin)"

# Container holati
log "Container holati:"
$COMPOSE ps

# ─── 9. Old images cleanup ────────────────
log "Eski imagelar tozalanmoqda..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

# ─── Yakuniy xabar ────────────────────────
echo ""
success "═══════════════════════════════════════"
success "MIDAS deploy muvaffaqiyatli yakunlandi!"
success "Commit: $GIT_SHA"
success "Vaqt: $(date)"
success "═══════════════════════════════════════"
