/**
 * pm2 on the VPS:  pm2 start ecosystem.config.cjs && pm2 save
 * After an update:  npm run deploy:update   (pull, install, build, reload). See DEPLOY.md.
 */
module.exports = {
  apps: [
    {
      name: 'camia',
      script: 'server.cjs',
      cwd: __dirname,
      // .env is read by Node itself (Node 22.13+); data/ (accounts, statistics) stays next to the code.
      node_args: '--env-file=.env',
      // Another Node version than the system one (e.g. installed with nvm): put its full path here.
      // interpreter: '/home/lee/.nvm/versions/node/v22.22.0/bin/node',
      // The port comes from PORT in .env (3010 when not set), so it can differ per server without editing this file.
      env: { HOST: '127.0.0.1' },
      max_memory_restart: '700M',
      time: true,
    },
  ],
};
