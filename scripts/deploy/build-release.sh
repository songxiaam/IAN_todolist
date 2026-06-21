#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

RELEASE_DIR="$ROOT_DIR/.deploy/release"
STANDALONE_DIR="$ROOT_DIR/.next/standalone"

echo "==> [1/4] 安装依赖"
cd "$ROOT_DIR"
pnpm install --frozen-lockfile

echo "==> [2/4] 构建（standalone）"
if [[ -f "$ROOT_DIR/.env.production.local" ]]; then
  echo "    加载 .env.production.local（NEXT_PUBLIC_* 会写入构建产物）"
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.production.local"
  set +a
elif [[ -f "$ROOT_DIR/.env.local" ]]; then
  echo "    警告: 未找到 .env.production.local，使用 .env.local 构建"
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

pnpm build

if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  NESTED_SERVER="$(find "$STANDALONE_DIR" -mindepth 2 -name server.js -print -quit 2>/dev/null || true)"
  if [[ -n "$NESTED_SERVER" ]]; then
    echo "错误: standalone 输出路径异常（$NESTED_SERVER）"
    echo "      Next.js 可能误判了 workspace 根目录（上级目录存在 package-lock.json 等）"
    echo "      请在 next.config.ts 中设置 turbopack.root 与 outputFileTracingRoot 为项目根目录"
  else
    echo "错误: 未生成 .next/standalone/server.js，请确认 next.config.ts 中 output: 'standalone'"
  fi
  exit 1
fi

echo "==> [3/4] 组装发布包"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

rsync -a "$STANDALONE_DIR/" "$RELEASE_DIR/"
mkdir -p "$RELEASE_DIR/.next"
rsync -a "$ROOT_DIR/.next/static/" "$RELEASE_DIR/.next/static/"

if [[ -d "$ROOT_DIR/public" ]]; then
  rsync -a "$ROOT_DIR/public/" "$RELEASE_DIR/public/"
fi

if [[ -d "$ROOT_DIR/config" ]]; then
  rsync -a "$ROOT_DIR/config/" "$RELEASE_DIR/config/"
fi

cp "$SCRIPT_DIR/ecosystem.config.cjs" "$RELEASE_DIR/ecosystem.config.cjs"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$RELEASE_DIR/BUILD_TIME"

echo "==> [4/4] 完成"
du -sh "$RELEASE_DIR"
echo "发布包: $RELEASE_DIR"
