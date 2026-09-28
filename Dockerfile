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
# small.en: notably more accurate than base.en at recognizing less common
# words, at the cost of slower transcription and a bigger download here.
RUN bash ./models/download-ggml-model.sh small.en

# --- Stage: build the bot itself ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# --- Final image: the bot itself ---
FROM node:22-slim AS teno
WORKDIR /app

# yt-dlp: the plain release asset is a Python zipapp, not a fully
# standalone binary — it needs a real python3 on PATH to run. Used to
# resolve YouTube queries into direct audio stream URLs (see
# src/resolveYoutubeAudio.ts). ffmpeg converts raw voice PCM into the
# 16kHz mono WAV the whisper server needs.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]

# --- Final image: persistent whisper transcription server ---
# Separate container so the model loads ONCE and stays in memory,
# instead of whisper-cli's per-call reload (the actual cause of the
# transcription lag). Built from the same whisper-build stage above —
# nothing here needs Node, but reusing node:22-slim as the base keeps
# glibc identical to what whisper-server was actually compiled against.
FROM node:22-slim AS whisper-service
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*
COPY --from=whisper-build /whisper/build/bin/whisper-server /usr/local/bin/whisper-server
COPY --from=whisper-build /whisper/models/ggml-small.en.bin /app/models/ggml-small.en.bin
EXPOSE 8080
CMD ["whisper-server", "-m", "/app/models/ggml-small.en.bin", "--host", "0.0.0.0", "--port", "8080"]
