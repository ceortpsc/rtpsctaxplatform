SHELL := /bin/bash
AOL := node ./tools/aol/bin/aol.mjs
ROSSCO := node ./tools/rossco/bin/rossco.mjs
ROSS_INFINITE := node ./tools/ross-infinite/bin/ross.mjs

.PHONY: setup lint test build start start-all start-check gateway workers bench aol team team-inventory rossco itr ross-infinite ross ross-dev ross-doctor compliance compliance-checklist compliance-log

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

start-all:
	./scripts/start-all.sh

start-check:
	node ./scripts/start-all.mjs --check-only

gateway:
	$(AOL) run start:gateway

workers:
	$(AOL) run worker:tds && $(AOL) run worker:transcript-pull && $(AOL) run worker:live-source

bench:
	$(AOL) bench

compliance:
	$(AOL) run compliance

compliance-checklist:
	$(AOL) run compliance:checklist

compliance-log:
	$(AOL) run compliance:log

aol:
	$(AOL) $(ARGS)

team:
	$(AOL) run team

team-inventory:
	$(AOL) run team:inventory

rossco:
	$(ROSSCO) $(ARGS)

itr:
	$(ROSSCO) $(ARGS)

ross-infinite:
	$(ROSS_INFINITE) $(ARGS)

ross:
	python3 ./ross.py $(ARGS)

ross-doctor:
	python3 ./ross.py doctor

ross-dev:
	python3 ./ross.py dev
