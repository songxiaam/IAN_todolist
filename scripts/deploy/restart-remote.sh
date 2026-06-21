#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
load_deploy_env

echo "==> 远程重启 ${DEPLOY_APP_NAME} @ ${DEPLOY_HOST}"

ssh_cmd "bash -s" <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
${REMOTE_EXPAND_DEPLOY_PATH}
DEPLOY_APP_NAME="${DEPLOY_APP_NAME}"
DEPLOY_APP_PORT="${DEPLOY_APP_PORT}"
cd "\${DEPLOY_PATH}/current"

if [[ ! -f "\${DEPLOY_PATH}/shared/.env" ]]; then
  echo "错误: 缺少 \${DEPLOY_PATH}/shared/.env"
  echo "请先在服务器创建环境变量文件（参考 scripts/deploy/shared.env.example）"
  exit 1
fi

set -a
source "\${DEPLOY_PATH}/shared/.env"
set +a
export PORT="\${PORT:-${DEPLOY_APP_PORT}}"
export DEPLOY_APP_NAME="${DEPLOY_APP_NAME}"
export DEPLOY_APP_PORT="\${PORT}"

${REMOTE_ENSURE_PM2}

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
pm2 status "\${DEPLOY_APP_NAME}" || pm2 status

echo "==> 应用已重启，端口 \${PORT}"
EOF

echo "==> 完成"
