SHELL := /bin/bash
AOL := node ./tools/aol/bin/aol.mjs

.PHONY: setup lint test build start gateway workers bench aol ross ross-dev ross-doctor

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
	$(AOL) run start:gateway

workers:
	$(AOL) run worker:tds && $(AOL) run worker:transcript-pull && $(AOL) run worker:live-source

bench:
	$(AOL) bench

aol:
	$(AOL) $(ARGS)

ross:
	python3 ./ross.py $(ARGS)

ross-doctor:
	python3 ./ross.py doctor

ross-dev:
	python3 ./ross.py dev
