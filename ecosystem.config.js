module.exports = {
  apps: [
    {
      name: "tag-patrolling-server",
      cwd: "./server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      max_memory_restart: "300M",
      autorestart: true,
      watch: false
    }
  ]
};
