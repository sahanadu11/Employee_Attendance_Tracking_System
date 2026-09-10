# ---------- Backend build ----------
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---------- Frontend build ----------
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
WORKDIR /app
COPY --from=frontend-build /app/frontend/build ./frontend/build
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 5000
WORKDIR /app
ENTRYPOINT ["./entrypoint.sh"]
