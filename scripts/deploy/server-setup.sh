#!/usr/bin/env bash
# 首次在服务器上初始化目录与 PM2（从本机执行，通过 SSH）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
load_deploy_env

echo "==> 初始化服务器 ${DEPLOY_HOST}"

ssh_cmd "bash -s" <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
${REMOTE_EXPAND_DEPLOY_PATH}

if ! mkdir -p "\${DEPLOY_PATH}/current" "\${DEPLOY_PATH}/shared" "\${DEPLOY_PATH}/logs"; then
  echo "错误: 无法在 \${DEPLOY_PATH} 创建目录（权限不足）"
  echo ""
  echo "普通用户请将 deploy.env 中 DEPLOY_PATH 改为 ~/todolist"
  echo "或使用 root 预先创建并授权:"
  echo "  sudo mkdir -p /var/www/todolist && sudo chown \$(whoami):\$(whoami) /var/www/todolist"
  exit 1
fi

if [[ ! -f "\${DEPLOY_PATH}/shared/.env" ]]; then
  echo "请在服务器创建 \${DEPLOY_PATH}/shared/.env（参考 shared.env.example）"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "警告: 未检测到 Node.js，请先安装 Node >= 20"
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "未检测到 rsync（推送将自动改用 tar+ssh，如需增量同步可安装）"
  if command -v sudo >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -qq && sudo apt-get install -y rsync || true
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y rsync || true
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y rsync || true
    fi
  fi
fi

${REMOTE_ENSURE_PM2}

echo "目录已就绪: \${DEPLOY_PATH}"
ls -la "\${DEPLOY_PATH}"
EOF

echo ""
echo "下一步:"
echo "  1. 在服务器编辑 ${DEPLOY_PATH}/shared/.env"
echo "  2. 本机执行: pnpm deploy:all"
