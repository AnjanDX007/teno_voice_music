# --- Stage: build whisper.cpp (speech-to-text engine) ---
FROM node:22-slim AS whisper-build
RUN apt-get update && \
    apt-get install -y --no-install-recommends git cmake build-essential ca-certificates wget && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /whisper
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git . && \
    cmake -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DGGML_NATIVE=OFF \
      -DGGML_CPU_ALL_VARIANTS=OFF && \
    cmake --build build -j --config Release
# base.en: a good accuracy/speed balance for a first pass. Swap for
# tiny.en (faster, less accurate) or small.en (slower, more accurate)
# in models/download-ggml-model.sh below if needed later.
RUN bash ./models/download-ggml-model.sh base.en

# --- Stage: build the bot itself ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# --- Final image ---
FROM node:22-slim
WORKDIR /app

# yt-dlp: the plain release asset is a Python zipapp, not a fully
# standalone binary — it needs a real python3 on PATH to run. Used to
# resolve YouTube queries into direct audio stream URLs (see
# src/resolveYoutubeAudio.ts). ffmpeg converts raw voice PCM into the
# 16kHz mono WAV whisper-cli needs.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

COPY --from=whisper-build /whisper/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper-build /whisper/models/ggml-base.en.bin /app/models/ggml-base.en.bin

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
