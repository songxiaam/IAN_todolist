# AGENTS.md

## 项目概览

学生作业管理系统 - 家长录入作业，学生自行安排做作业并设置倒计时。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (邮箱登录)

## 目录结构

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── supabase-config/route.ts  # Supabase 配置接口
│   │   │   ├── profile/route.ts          # 用户资料 API
│   │   │   ├── family/route.ts           # 家庭创建 API
│   │   │   ├── family/[id]/route.ts      # 家庭信息 API
│   │   │   ├── family-members/route.ts   # 家庭成员 API
│   │   │   ├── homework/route.ts         # 作业列表/创建 API
│   │   │   ├── homework/[id]/route.ts    # 作业更新/删除 API
│   │   ├── login/page.tsx                # 登录页面
│   │   ├── setup/page.tsx                # 角色设置页面
│   │   ├── page.tsx                      # 主页面（家长端/学生端）
│   │   └── layout.tsx                    # 根布局
│   ├── components/ui/                    # Shadcn UI 组件
│   ├── db/
│   │   └── schema.ts                     # 数据表 Schema (Drizzle)
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── server.ts                 # 后端 Supabase Client
│   │   ├── supabase-browser.ts           # 前端 Supabase Client
│   │   ├── supabase-config-inject.tsx    # Supabase 配置注入
│   │   ├── constants.ts                  # 应用常量
│   │   └── utils.ts                      # 工具函数
```

## 构建和测试命令

```bash
# 安装依赖
pnpm install

# 开发环境
pnpm dev

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint:build --quiet

# 构建
pnpm build

# 生产环境
pnpm start
```

## 数据表结构

### profiles (用户资料)
- id: UUID (auth.uid)
- role: varchar (parent/student)
- family_id: UUID (家庭关联)
- name: varchar (姓名)

### families (家庭)
- id: UUID
- name: varchar (家庭名称)

### homeworks (作业)
- id: serial
- title: varchar (作业标题)
- description: text (作业描述)
- subject: varchar (科目)
- deadline: timestamp (截止时间)
- estimated_minutes: integer (预计时间)
- family_id: UUID (家庭关联)
- created_by: UUID (创建者)
- assigned_to: UUID (分配对象)
- status: varchar (pending/in_progress/completed)
- started_at: timestamp (开始时间)
- completed_at: timestamp (完成时间)

## API 接口认证

所有业务接口（除 `/api/supabase-config`）都需要在 Header 中携带 `x-session` 字段：
```typescript
headers: { 'x-session': session.access_token }
```

## 代码风格指南

- 字段名使用 snake_case（数据库）
- 所有 API 调用必须检查 `{ data, error }`
- 禁止隐式 any
- 使用 'use client' 标记客户端组件
- 动态数据需用 useEffect + useState 防止 Hydration 错误

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
- 倒计时显示（预计时间倒计时）

## UI 设计风格

### 手绘风格 (Sketchy Style)
- **字体**: Patrick Hand（手写风格字体）
- **边框**: 不规则圆角、铅笔线条质感 (`sketchy-border`, `sketchy-card`)
- **按钮**: 蜡笔涂抹效果 (`crayon-button`, `crayon-button-orange`)
- **输入框**: 铅笔素描风格 (`pencil-input`)
- **背景**: 纸张纹理 (`paper-bg`)
- **动画**: 手绘晃动入场 (`sketchy-enter`)

### CSS 类名参考
```css
.sketchy-card      /* 手绘卡片 */
.sketchy-border    /* 手绘边框 */
.crayon-button     /* 蜡笔绿按钮 */
.crayon-button-orange /* 蜡笔橙按钮 */
.pencil-input      /* 铅笔输入框 */
.paper-bg          /* 纸张纹理背景 */
.timer-sketchy     /* 手绘倒计时 */
.status-sketchy    /* 手绘状态标签 */
.sketchy-enter     /* 手绘入场动画 */
```