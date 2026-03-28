### Frontend build stage
FROM node:22-alpine AS frontend-builder

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /Super_Market/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ .
RUN pnpm run build

### Backend dependencies stage
FROM node:22-alpine AS backend-builder

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /Super_Market/backend

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY backend/ .

### Production runtime stage
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /Super_Market

RUN apk add --no-cache nginx curl && \
    mkdir -p /var/log/nginx /run/nginx

COPY --from=backend-builder /Super_Market/backend /Super_Market/backend
COPY --from=frontend-builder /Super_Market/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /Super_Market/backend/uploads/items /Super_Market/backend/uploads/returns

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -f http://localhost/api/health || exit 1

CMD ["sh", "-c", "node backend/server.js & exec nginx -g 'daemon off;'"]