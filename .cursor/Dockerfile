# Cursor Cloud Agent environment image for RTPSC Tax Platform.
# Do not COPY the application tree — Cursor checks out the workspace separately.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_VERSION=22.14.0 \
    LANG=C.UTF-8 \
    PATH=/usr/local/node/bin:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    openssl \
    jq \
    make \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    -o /tmp/node.tar.xz \
  && mkdir -p /usr/local/node \
  && tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1 \
  && rm /tmp/node.tar.xz \
  && node --version \
  && npm --version \
  && python3 --version

WORKDIR /workspace
