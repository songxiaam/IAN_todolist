#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
load_deploy_env

RELEASE_DIR="$ROOT_DIR/.deploy/release"
REMOTE_CURRENT="${DEPLOY_PATH}/current"

if [[ ! -f "$RELEASE_DIR/server.js" ]]; then
  echo "未找到发布包，请先运行: pnpm deploy:build"
  exit 1
fi

echo "==> 确保服务器目录存在"
ssh_cmd "DEPLOY_PATH='${DEPLOY_PATH}'; ${REMOTE_EXPAND_DEPLOY_PATH}; mkdir -p \"\${DEPLOY_PATH}/current\" \"\${DEPLOY_PATH}/shared\" \"\${DEPLOY_PATH}/logs\""

echo "==> 推送到 ${DEPLOY_HOST}:${REMOTE_CURRENT}"
# 远端路径使用字面 ~/ 时由 ssh 登录用户 home 解析
if [[ "$DEPLOY_PATH" == "~/"* ]] || [[ "$DEPLOY_PATH" == "~" ]]; then
  push_to_server "$RELEASE_DIR/" "${DEPLOY_PATH}/current/"
else
  push_to_server "$RELEASE_DIR/" "$REMOTE_CURRENT/"
fi

echo "==> 推送完成"
