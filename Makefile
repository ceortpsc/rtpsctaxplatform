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
	npm run start:gateway

workers:
	npm run worker:tds && npm run worker:transcript-pull && npm run worker:live-source
