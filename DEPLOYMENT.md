# DEPLOYMENT — Hostinger VPS (Ubuntu)

This app is a single Node.js process (Express) that serves both the API
(`/api/*`) and the built React SPA (everything else), backed by a SQLite
file. There is no separate frontend server in production.

## 1. First-time server setup

```bash
# As root or a sudo user on the fresh Ubuntu VPS:
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# PM2 (process manager, keeps the app running + restarts on crash/reboot)
sudo npm install -g pm2

# Nginx (reverse proxy + TLS termination)
sudo apt install -y nginx
```

## 2. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # opens 80 + 443
sudo ufw enable
sudo ufw status
```

Do **not** open port 4000 (the Node app) to the public internet — only
Nginx (80/443) should be exposed; it proxies to 127.0.0.1:4000 internally.

## 3. Clone and configure the app

```bash
cd /var/www
sudo git clone https://github.com/karthiktagcorporation/TAG-Patrolling.git
sudo chown -R $USER:$USER TAG-Patrolling
cd TAG-Patrolling

cp .env.example server/.env
nano server/.env
# Set at minimum:
#   NODE_ENV=production
#   SESSION_SECRET=<generate a long random string>
#   APP_PASSWORD=Tag@2026   (or your production password)
#   DATABASE_URL="file:./dev.db"
```

## 4. Install, migrate, seed, build

```bash
npm install --prefix server
npm install --prefix client

npm run prisma:migrate --prefix server   # first run creates prisma/dev.db
npm run prisma:seed --prefix server      # seeds the 7 plants (idempotent upserts)

npm run build   # builds server/dist and client/dist
```

## 5. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # prints a systemd command to run once, so PM2 survives reboot — run the printed command
```

Check it's alive: `pm2 status`, `pm2 logs tag-patrolling-server`.

## 6. Nginx reverse proxy

```bash
sudo cp docs/nginx/tag-patrolling.conf /etc/nginx/sites-available/tag-patrolling.conf
sudo ln -s /etc/nginx/sites-available/tag-patrolling.conf /etc/nginx/sites-enabled/
# Edit the file first to set the real server_name / domain.
sudo nginx -t
sudo systemctl reload nginx
```

## 7. HTTPS (recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d patrol.yourdomain.com
```

Certbot edits the Nginx config in place to add the 443 server block and
sets up auto-renewal (`systemctl status certbot.timer`).

## 8. SQLite persistence

- The database lives at `server/prisma/dev.db` (resolved relative to
  `prisma/schema.prisma`'s `DATABASE_URL`). It is a single file — back it
  up by copying it (stop the app first, or use `sqlite3 dev.db ".backup
  backup.db"` for a hot backup).
- Uploaded PDFs are stored under `server/uploads/`. Both `dev.db` and
  `uploads/` are excluded from git (`.gitignore`) — they are runtime data,
  not source, and must persist across deploys. **Do not delete or
  `git clean` this directory when redeploying.**
- Recommended: a nightly cron job copying `server/prisma/dev.db` and
  `server/uploads/` to off-box storage.

## 9. Redeploying after code changes

```bash
cd /var/www/TAG-Patrolling
git pull
bash scripts/deploy-hostinger.sh
```

This installs any new dependencies, applies new Prisma migrations,
rebuilds both client and server, and reloads the PM2 process without
downtime (`pm2 reload`).

## 10. Reboot survival checklist

- [ ] `pm2 startup` command has been run once (see step 5)
- [ ] `pm2 save` has been run after the app is started
- [ ] Nginx is enabled: `sudo systemctl enable nginx`
- [ ] UFW is enabled: `sudo ufw status` shows "active"
