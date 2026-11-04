FROM node:22-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@12.3.4

EXPOSE 3000

WORKDIR /app

# The project uses pnpm (pnpm-lock.yaml, with the function extension as a
# workspace). Dev dependencies are needed for the build (vite).
COPY . .
RUN pnpm install --frozen-lockfile && pnpm run build

ENV NODE_ENV=production

CMD ["pnpm", "run", "docker-start"]
