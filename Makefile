SHELL := /bin/bash
AOL := node ./tools/aol/bin/aol.mjs

ROSSCO := node ./tools/rossco/bin/rossco.mjs

.PHONY: setup lint test build start gateway workers bench aol rossco itr compliance compliance-checklist compliance-log
.PHONY: setup lint test build start gateway workers bench aol ross ross-dev ross-doctor
.PHONY: setup lint test build start gateway workers bench aol compliance compliance-checklist compliance-log

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

compliance:
	$(AOL) run compliance

compliance-checklist:
	$(AOL) run compliance:checklist

compliance-log:
	$(AOL) run compliance:log

aol:
	$(AOL) $(ARGS)

rossco itr:
	$(ROSSCO) $(ARGS)
ross:
	python3 ./ross.py $(ARGS)

ross-doctor:
	python3 ./ross.py doctor

ross-dev:
	python3 ./ross.py dev
