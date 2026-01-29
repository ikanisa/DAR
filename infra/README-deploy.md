# Deployment Runbook

## Prerequisites

- Docker 24+
- Docker Compose v2+
- Domain with DNS pointing to server
- SSL certificates (optional: use Let's Encrypt)

## Quick Deploy

1. Clone repo and navigate to infra:
   ```bash
   cd infra
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with real values
   ```

3. Start services:
   ```bash
   docker compose up -d
   ```

4. Verify health:
   ```bash
   docker compose ps
   curl http://localhost/health
   ```

## Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

## Migrations

```bash
docker compose exec backend npm run db:migrate
```

## Scaling

```bash
docker compose up -d --scale backend=3
```

## Backup Database

```bash
docker compose exec postgres pg_dump -U realestate realestate > backup.sql
```

## Restore Database

```bash
cat backup.sql | docker compose exec -T postgres psql -U realestate realestate
```

## Security Notes

1. Gateway (Moltbot) is ONLY exposed on 127.0.0.1:18789
2. To access remotely, use Tailscale or SSH tunnel:
   ```bash
   ssh -L 18789:127.0.0.1:18789 user@server
   ```
3. Never expose gateway directly to internet
