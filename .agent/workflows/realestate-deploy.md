---
description: Docker Compose production deployment for Real Estate PWA (Postgres, backend, PWA, Moltbot)
---

# W7 — Deploy Workflow

Production-ready Docker Compose deployment for all services.

---

## Goal

Create deployable infrastructure with:
- Postgres with volume persistence
- Backend API
- PWA (Next.js)
- Moltbot gateway (loopback only)
- Health checks
- Security best practices

---

## Hard Rules

- Gateway expose only 127.0.0.1:18789 on host
- Secrets via env vars / secret manager (never committed)
- Health checks for all services
- Postgres data persistence with named volume

---

## Files to Create

```
/infra/
├── docker-compose.yml
├── .env.example
├── nginx.conf              # Optional reverse proxy
└── README-deploy.md        # Deployment runbook
```

---

## docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: realestate-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-realestate}
      POSTGRES_USER: ${POSTGRES_USER:-realestate}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-realestate}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - internal
    restart: unless-stopped

  backend:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile
    container_name: realestate-backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-realestate}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-realestate}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required}
      SERVICE_TOKEN: ${SERVICE_TOKEN:?SERVICE_TOKEN required}
      MOLTBOT_GATEWAY_URL: http://moltbot:18789
      MOLTBOT_TOKEN: ${MOLTBOT_TOKEN:?MOLTBOT_TOKEN required}
      NODE_ENV: production
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - internal
    restart: unless-stopped

  pwa:
    build:
      context: ../apps/pwa
      dockerfile: Dockerfile
    container_name: realestate-pwa
    environment:
      BACKEND_URL: http://backend:3001
      BACKEND_SERVICE_TOKEN: ${SERVICE_TOKEN}
      NEXT_PUBLIC_API_URL: /api
      NODE_ENV: production
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - internal
    restart: unless-stopped

  moltbot:
    image: moltbot/gateway:latest
    container_name: realestate-moltbot
    environment:
      MOLTBOT_TOKEN: ${MOLTBOT_TOKEN}
      HOOKS_TOKEN: ${HOOKS_TOKEN}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}
    volumes:
      - ./moltbot/moltbot.json:/app/config/moltbot.json:ro
      - ./moltbot/agents:/app/config/agents:ro
    # Expose only on loopback!
    ports:
      - "127.0.0.1:18789:18789"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - internal
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: realestate-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - pwa
      - backend
    networks:
      - internal
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  internal:
    driver: bridge
```

---

## .env.example

```env
# Database
POSTGRES_DB=realestate
POSTGRES_USER=realestate
POSTGRES_PASSWORD=change_me_strong_password

# Auth
JWT_SECRET=change_me_64_char_minimum_secret_key
SERVICE_TOKEN=change_me_service_token_for_moltbot_tools

# Moltbot
MOLTBOT_TOKEN=change_me_gateway_token
HOOKS_TOKEN=change_me_webhook_token
TELEGRAM_BOT_TOKEN=optional_telegram_bot_token

# Optional: WhatsApp (Meta API)
WHATSAPP_API_TOKEN=optional_whatsapp_token
WHATSAPP_PHONE_ID=optional_phone_number_id
```

---

## nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream pwa {
        server pwa:3000;
    }
    
    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name _;
        
        # Redirect to HTTPS in production
        # return 301 https://$host$request_uri;
        
        # PWA static files
        location / {
            proxy_pass http://pwa;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        # Backend API
        location /api/ {
            proxy_pass http://backend/api/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Health checks
        location /health {
            proxy_pass http://backend/health;
        }
    }
}
```

---

## Backend Dockerfile

```dockerfile
# apps/backend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

---

## PWA Dockerfile

```dockerfile
# apps/pwa/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

---

## README-deploy.md

```markdown
# Deployment Runbook

## Prerequisites

- Docker 24+
- Docker Compose v2+
- Domain with DNS pointing to server
- SSL certificates (optional: use Let's Encrypt)

## Quick Deploy

1. Clone repo and navigate to infra:
   \`\`\`bash
   cd infra
   \`\`\`

2. Create environment file:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with real values
   \`\`\`

3. Start services:
   \`\`\`bash
   docker compose up -d
   \`\`\`

4. Verify health:
   \`\`\`bash
   docker compose ps
   curl http://localhost/health
   \`\`\`

## Logs

\`\`\`bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
\`\`\`

## Migrations

\`\`\`bash
docker compose exec backend npm run db:migrate
\`\`\`

## Scaling

\`\`\`bash
docker compose up -d --scale backend=3
\`\`\`

## Backup Database

\`\`\`bash
docker compose exec postgres pg_dump -U realestate realestate > backup.sql
\`\`\`

## Restore Database

\`\`\`bash
cat backup.sql | docker compose exec -T postgres psql -U realestate realestate
\`\`\`

## Security Notes

1. Gateway (Moltbot) is ONLY exposed on 127.0.0.1:18789
2. To access remotely, use Tailscale or SSH tunnel:
   \`\`\`bash
   ssh -L 18789:127.0.0.1:18789 user@server
   \`\`\`
3. Never expose gateway directly to internet
```

---

## Acceptance Criteria

- [ ] `docker compose up -d` works from VPS
- [ ] All health checks pass
- [ ] PWA accessible on port 80
- [ ] API accessible at /api
- [ ] Gateway only on 127.0.0.1:18789
- [ ] Postgres data persists across restarts

---

## Rollback

```bash
# Stop services
docker compose down

# If needed, remove volumes (WARNING: data loss)
docker compose down -v

# Restore previous version
git checkout HEAD~1 -- infra/
docker compose up -d
```
