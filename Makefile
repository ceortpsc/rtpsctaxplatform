SHELL := /bin/bash

.PHONY: setup lint test build start gateway workers

setup:
	./scripts/setup.sh

lint:
	./scripts/lint.sh

test:
	./scripts/test.sh

build:
	./scripts/build.sh

start:
	./scripts/start.sh

gateway:
	pnpm run start:gateway

workers:
	pnpm run worker:tds && pnpm run worker:transcript-pull && pnpm run worker:live-source
