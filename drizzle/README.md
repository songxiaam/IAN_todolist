# 数据库迁移

本目录包含 Supabase PostgreSQL 的 SQL 迁移文件，由 Drizzle Kit 管理。

## 迁移文件

| 文件 | 说明 |
|------|------|
| `0000_initial_schema.sql` | 创建 `families`、`profiles`、`homeworks` 表及索引 |
| `0001_rls_policies.sql` | 启用 RLS 并配置行级安全策略 |

## 方式一：命令行自动迁移（推荐）

### 1. 配置数据库连接

在 `.env.local` 中添加 `DATABASE_URL`（Supabase Dashboard → Settings → Database → Connection string → URI）：

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-xxx.pooler.supabase.com:6543/postgres
```

### 2. 执行迁移

```bash
pnpm db:migrate
```

Drizzle 会按顺序执行尚未应用的迁移，并记录到 `drizzle.__drizzle_migrations` 表。

## 方式二：Supabase SQL Editor 手动执行

1. 打开 Supabase Dashboard → **SQL Editor**
2. 依次打开并执行 `0000_initial_schema.sql`、`0001_rls_policies.sql` 的全部内容
3. 每个文件执行一次即可

> 手动执行后，若后续要用 `pnpm db:migrate`，需确保 Drizzle 迁移记录表与已执行文件一致。

## 后续改表流程

1. 修改 `src/db/schema.ts`
2. 生成新迁移文件：

```bash
pnpm db:generate
```

3. 检查 `drizzle/` 下新生成的 SQL 文件
4. 同步到 Supabase：

```bash
pnpm db:migrate
```

## 其他命令

```bash
pnpm db:generate   # 根据 schema.ts 生成迁移 SQL
pnpm db:migrate    # 执行未应用的迁移
pnpm db:push       # 开发环境快速同步（不生成迁移文件，慎用生产）
pnpm db:studio     # 可视化查看数据库
```
