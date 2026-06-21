module.exports = {
  apps: [
    {
      name: 'todolist',
      script: './node_modules/next/dist/bin/next',
      // 核心修正：直接在这里把端口锁死在 3100
      args: 'start -p 3100',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3100 // 双重保险
      }
    }
  ]
}