# RTPSC Tax Platform — deployable Node service image (api-gateway default).
# Cursor Cloud agents use .cursor/Dockerfile; this root Dockerfile is for
# build-tool detection and conventional container deployment.
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    APP_ENV=prod \
    SERVICE_PORT=3000

COPY package.json RTPSC-package-lock.json aol.config.json ./
COPY scripts ./scripts
COPY tools ./tools
COPY packages ./packages
COPY services ./services
COPY workers ./workers
COPY pipelines ./pipelines
COPY engines ./engines

RUN node ./tools/aol/bin/aol.mjs install

EXPOSE 3000 8820

CMD ["node", "./tools/aol/bin/aol.mjs", "run", "start"]
