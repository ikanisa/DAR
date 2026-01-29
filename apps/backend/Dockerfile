# apps/backend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy db and migrations for runtime scripts
COPY --from=builder /app/db ./db
COPY --from=builder /app/migrations ./migrations

EXPOSE 3001
CMD ["node", "dist/server.js"]
