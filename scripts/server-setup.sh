#!/bin/bash
# MIDAS — Server Setup Script (yangi server uchun bir martalik)
# scripts/server-setup.sh
# Ishlatish: sudo bash server-setup.sh

set -euo pipefail

echo "🚀 MIDAS Server Setup boshlandi..."

# ─── Tizim yangilash ──────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl git wget htop ufw fail2ban certbot python3-certbot-nginx

# ─── Docker o'rnatish ─────────────────────
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
apt-get install -y docker-compose-plugin

# ─── Swap (agar RAM kam bo'lsa) ───────────
if [ $(free -m | awk '/^Mem:/{print $2}') -lt 4096 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "✓ 2GB swap yaratildi"
fi

# ─── Firewall ─────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✓ Firewall sozlandi"

# ─── MIDAS papkasi ────────────────────────
mkdir -p /opt/midas /var/log/midas /var/backups/midas
chmod 755 /opt/midas

# ─── Crontab (backup + SSL yangilash) ─────
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/midas/scripts/backup.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --quiet") | crontab -
echo "✓ Crontab sozlandi"

echo ""
echo "✅ Server setup tugadi!"
echo ""
echo "Keyingi qadamlar:"
echo "1. cd /opt/midas && git clone <repo_url> ."
echo "2. cp .env.example .env && nano .env"
echo "3. certbot --nginx -d api.midas.uz -d app.midas.uz -d admin.midas.uz"
echo "4. bash scripts/deploy.sh"
