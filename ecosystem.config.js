module.exports = {
  apps: [
    {
      name: 'telegram-bot',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot:*',
      },
      watch: false,
      max_memory_restart: '256M',
      instances: 1,
      autorestart: true,
    },
  ],
};
