# ROSS.CO Infinite local registry image (optional)
FROM node:22-alpine
WORKDIR /app
COPY package.json NOTICE ./
COPY src ./src
COPY config ./config
COPY schemas ./schemas
ENV PORT=4873
ENV ROSS_REGISTRY_DATA=/data
EXPOSE 4873
CMD ["node", "src/server/registry.mjs"]
