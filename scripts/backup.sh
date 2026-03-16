#!/bin/bash
# MIDAS — DB Backup Script
# scripts/backup.sh
# Crontab: 0 2 * * * /opt/midas/scripts/backup.sh

set -euo pipefail

APP_DIR="/opt/midas"
BACKUP_DIR="/var/backups/midas"
DATE=$(date +%Y%m%d-%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

cd "$APP_DIR"

# DB dump
BACKUP_FILE="$BACKUP_DIR/db-$DATE.sql.gz"
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U midas_user midas_db | gzip > "$BACKUP_FILE"

echo "✓ Backup saqlandi: $BACKUP_FILE ($(du -sh $BACKUP_FILE | cut -f1))"

# Eski backuplarni o'chirish
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "✓ $KEEP_DAYS kundan eski backuplar o'chirildi"

# Redis backup
REDIS_BACKUP="$BACKUP_DIR/redis-$DATE.rdb"
docker-compose -f docker-compose.prod.yml exec -T redis \
  redis-cli -a "$REDIS_PASSWORD" --rdb /data/backup.rdb 2>/dev/null \
  && docker cp midas_redis:/data/backup.rdb "$REDIS_BACKUP" \
  && echo "✓ Redis backup: $REDIS_BACKUP" \
  || echo "⚠ Redis backup muvaffaqiyatsiz (muhim emas)"

echo "Backup yakunlandi: $(date)"
