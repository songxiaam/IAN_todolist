#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_ENV="$SCRIPT_DIR/deploy.env"

load_deploy_env() {
  if [[ ! -f "$DEPLOY_ENV" ]]; then
    echo "缺少 $DEPLOY_ENV"
    echo "请先执行: cp scripts/deploy/deploy.env.example scripts/deploy/deploy.env"
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a
  source "$DEPLOY_ENV"
  set +a

  : "${DEPLOY_HOST:?请在 deploy.env 中设置 DEPLOY_HOST}"
  # 从文件原样读取，避免本机把 ~/todolist 展开成 /Users/xxx/todolist
  DEPLOY_PATH="$(grep -E '^DEPLOY_PATH=' "$DEPLOY_ENV" | tail -1 | sed -E 's/^DEPLOY_PATH=//' | sed -E "s/^['\"]//; s/['\"]$//")"
  : "${DEPLOY_PATH:?请在 deploy.env 中设置 DEPLOY_PATH}"

  DEPLOY_PORT="${DEPLOY_PORT:-22}"
  DEPLOY_APP_PORT="${DEPLOY_APP_PORT:-3000}"
  DEPLOY_APP_NAME="${DEPLOY_APP_NAME:-todolist}"
}

# 在服务器 shell 中展开 DEPLOY_PATH（处理 ~/xxx）
REMOTE_EXPAND_DEPLOY_PATH='if [[ "$DEPLOY_PATH" == "~/"* ]]; then DEPLOY_PATH="$HOME/${DEPLOY_PATH:2}"; elif [[ "$DEPLOY_PATH" == "~" ]]; then DEPLOY_PATH="$HOME"; fi'

# 普通用户无 sudo 时，PM2 安装到 ~/.local
REMOTE_ENSURE_PM2='export PATH="$HOME/.local/bin:$PATH"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "安装 PM2 到 ~/.local ..."
  mkdir -p "$HOME/.local"
  npm install -g pm2 --prefix "$HOME/.local"
  export PATH="$HOME/.local/bin:$PATH"
  if [[ -f "$HOME/.bashrc" ]] && ! grep -q ".local/bin" "$HOME/.bashrc"; then
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$HOME/.bashrc"
  fi
fi'

ssh_cmd() {
  local ssh_args=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
  if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
    ssh_args+=(-i "$DEPLOY_SSH_KEY")
  fi
  ssh "${ssh_args[@]}" "$DEPLOY_HOST" "$@"
}

rsync_to_server() {
  local src="$1"
  local dest="$2"
  local rsync_ssh="ssh -p $DEPLOY_PORT -o StrictHostKeyChecking=accept-new"
  if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
    rsync_ssh="ssh -p $DEPLOY_PORT -i $DEPLOY_SSH_KEY -o StrictHostKeyChecking=accept-new"
  fi
  rsync -avz --delete -e "$rsync_ssh" "$src" "${DEPLOY_HOST}:${dest}"
}

# 远端无 rsync 时通过 tar 管道推送（仅需 ssh + tar，常见于最小化 Linux 镜像）
tar_push_to_server() {
  local src="${1%/}"
  local dest="$2"
  local ssh_args=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
  if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
    ssh_args+=(-i "$DEPLOY_SSH_KEY")
  fi
  ssh_cmd "mkdir -p '$dest' && find '$dest' -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
  tar -C "$src" -czf - . | ssh "${ssh_args[@]}" "$DEPLOY_HOST" "tar -xzf - -C '$dest'"
}

remote_has_rsync() {
  ssh_cmd "command -v rsync >/dev/null 2>&1"
}

push_to_server() {
  local src="$1"
  local dest="$2"
  if remote_has_rsync; then
    rsync_to_server "$src" "$dest"
  else
    echo "    远端未安装 rsync，改用 tar+ssh 推送"
    tar_push_to_server "$src" "$dest"
  fi
}
