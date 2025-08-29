FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-slim AS build
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:20-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl wget \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Create minimal tsconfig for runtime alias resolution (@/ -> dist)
RUN printf '{"compilerOptions":{"baseUrl":"./dist","paths":{"@/*":["src/*"]}}}\n' > tsconfig.json
COPY --from=build /app/prisma ./prisma
ENV PORT=3000
EXPOSE 3000
CMD sh -c "npx prisma migrate deploy && node -r tsconfig-paths/register dist/src/main.js"


