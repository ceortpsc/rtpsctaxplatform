# Cursor Cloud Agent environment image for RTPSC Tax Platform.
# Do not COPY the application tree — Cursor checks out the workspace separately.
#
# Required Cloud helpers:
#   tmux     — environment.json "terminals" + configure-terminals / start-all
#   ffmpeg   — recordScreen / demo artifacts
#   sudo     — Cursor Dockerfile guidance for privileged helpers
#   locales  — computer-use / remote-desktop bootstrap on custom Ubuntu images
#   xz-utils — Node tarball extract + desktop package tooling
# Bump comment when forcing a Cloud environment rebuild: cloud-helpers-v1
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_VERSION=22.14.0 \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    PATH=/usr/local/node/bin:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    sudo \
    tmux \
    ffmpeg \
    locales \
    xz-utils \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    openssl \
    jq \
    make \
  && locale-gen en_US.UTF-8 \
  && update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
  && rm -rf /var/lib/apt/lists/*

# Non-root helper user expected by some Cursor Cloud desktop tooling.
RUN id -u ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu \
  && echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu \
  && chmod 0440 /etc/sudoers.d/ubuntu

RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    -o /tmp/node.tar.xz \
  && mkdir -p /usr/local/node \
  && tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1 \
  && rm /tmp/node.tar.xz \
  && node --version \
  && npm --version \
  && python3 --version \
  && command -v tmux \
  && command -v ffmpeg \
  && tmux -V \
  && ffmpeg -version >/dev/null

WORKDIR /workspace
