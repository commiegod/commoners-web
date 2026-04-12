#!/bin/bash
# scrolls-cron.sh — weekly Scrolls update runner
#
# Install as cron job (runs Monday 9am):
#   crontab -e
#   0 9 * * 1 ~/common/web/scripts/scrolls-cron.sh >> ~/scrolls-update.log 2>&1
#
# Or run manually:
#   ~/common/web/scripts/scrolls-cron.sh
#   ~/common/web/scripts/scrolls-cron.sh --dry-run
#   ~/common/web/scripts/scrolls-cron.sh --no-push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "=========================================="
echo "  Scrolls Cron — $(date)"
echo "=========================================="

cd "$WEB_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules/playwright" ]; then
  echo "Installing playwright..."
  npm install playwright
  npx playwright install chromium
fi

# Run the update script, passing any flags through
node scripts/scrolls-update.mjs "$@"

echo ""
echo "Cron complete at $(date)"
