/** PM2 配置 — 在服务器 ${DEPLOY_PATH}/current 目录下运行 */
module.exports = {
  apps: [
    {
      name: process.env.DEPLOY_APP_NAME || 'todolist',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || process.env.DEPLOY_APP_PORT || 3000,
      },
    },
  ],
};
