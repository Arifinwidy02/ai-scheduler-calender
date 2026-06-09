FROM oven/bun:1-slim

# Paksa update dan install chromium untuk melengkapi semua shared libraries (.so)
RUN apt-get update && apt-get install -y \
    chromium \
    wget \
    ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Set environment path agar Puppeteer langsung mengenali lokasi binary Chromium Debian
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["bun", "run", "index.ts"]