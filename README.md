# 学生作业管理系统

家长录入作业，学生自行安排做作业并设置倒计时。

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (邮箱登录)

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目配置：

```bash
cp .env.example .env.local
```

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥（服务端 API 使用） |

### 3. 启动开发服务器

```bash
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 4. 构建与生产部署

```bash
pnpm build
pnpm start
```

## 项目结构

```
src/
├── app/
│   ├── api/                  # API 路由
│   ├── login/                # 登录页
│   ├── setup/                # 角色/家庭设置页
│   ├── page.tsx              # 主页（家长端/学生端）
│   └── layout.tsx
├── components/ui/            # shadcn/ui 组件
├── db/
│   └── schema.ts             # Drizzle 数据表定义
├── lib/
│   ├── supabase/
│   │   └── server.ts         # 服务端 Supabase Client
│   ├── supabase-browser.ts   # 浏览器 Supabase Client
│   ├── supabase-config-inject.tsx
│   ├── constants.ts
│   └── utils.ts
└── hooks/
```

## 数据库迁移

表结构定义在 `src/db/schema.ts`，迁移 SQL 在 `drizzle/` 目录。

```bash
# 首次同步到 Supabase（需配置 DATABASE_URL）
pnpm db:migrate

# 修改 schema 后生成新迁移
pnpm db:generate
pnpm db:migrate
```

详见 [drizzle/README.md](./drizzle/README.md)。

## 常用命令

```bash
pnpm dev          # 开发环境
pnpm build        # 生产构建
pnpm start        # 启动生产服务
pnpm ts-check     # TypeScript 类型检查
pnpm lint:build   # ESLint 检查
pnpm validate     # 类型检查 + Lint
pnpm db:migrate   # 执行数据库迁移
pnpm db:generate  # 根据 schema 生成迁移文件
```

## 功能说明

### 家长端
- 创建家庭，获取家庭码
- 添加作业（标题、科目、时间、截止日期、分配学生）
- 查看作业统计（待完成/进行中/已完成）
- 删除作业

### 学生端
- 使用家庭码加入家庭
- 查看作业列表
- 开始作业（启动倒计时）
- 完成作业（记录完成时间）

## API 认证

除 `/api/supabase-config` 外，所有业务 API 需在 Header 中携带 `x-session`：

```typescript
headers: { 'x-session': session.access_token }
```

## 设计文档

UI 设计风格详见 [DESIGN.md](./DESIGN.md)，AI 开发指南详见 [AGENTS.md](./AGENTS.md)。
