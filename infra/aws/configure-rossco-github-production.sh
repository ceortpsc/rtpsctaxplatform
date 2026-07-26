#!/usr/bin/env bash
set -Eeuo pipefail

# Configures the GitHub production environment and non-secret variables after
# infra/aws/deploy-rossco-registry-cloudshell.sh completes.
# Requires an authenticated GitHub CLI session with repository administration rights.

REPOSITORY="${GITHUB_REPOSITORY:-ceortpsc/rtpsctaxplatform}"
ENVIRONMENT_NAME="${ROSS_GITHUB_ENVIRONMENT:-rossco-production}"
OUTPUT_FILE="${ROSS_PRODUCTION_OUTPUT_FILE:-build/rossco-production-outputs.env}"

fail() {
  printf 'ROSS.CO BLOCKED: %s\n' "$*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || fail "GitHub CLI is required. Install or launch this script where gh is available."
gh auth status >/dev/null 2>&1 || fail "Authenticate GitHub CLI before running."
[[ -f "$OUTPUT_FILE" ]] || fail "Missing deployment output file: $OUTPUT_FILE"

# shellcheck disable=SC1090
set -a
source "$OUTPUT_FILE"
set +a

: "${AWS_ROLE_ARN:?Missing AWS_ROLE_ARN}"
: "${AWS_REGION:?Missing AWS_REGION}"
: "${ROSS_REGISTRY_BUCKET:?Missing ROSS_REGISTRY_BUCKET}"
: "${ROSS_CLOUDFRONT_DISTRIBUTION_ID:?Missing ROSS_CLOUDFRONT_DISTRIBUTION_ID}"

printf 'Creating or updating GitHub environment %s...\n' "$ENVIRONMENT_NAME"
gh api \
  --method PUT \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "repos/${REPOSITORY}/environments/${ENVIRONMENT_NAME}" \
  --input - <<< '{"wait_timer":0,"prevent_self_review":false}' >/dev/null

set_environment_variable() {
  local name="$1"
  local value="$2"
  gh variable set "$name" \
    --repo "$REPOSITORY" \
    --env "$ENVIRONMENT_NAME" \
    --body "$value"
}

set_environment_variable AWS_ROLE_ARN "$AWS_ROLE_ARN"
set_environment_variable AWS_REGION "$AWS_REGION"
set_environment_variable ROSS_REGISTRY_BUCKET "$ROSS_REGISTRY_BUCKET"
set_environment_variable ROSS_CLOUDFRONT_DISTRIBUTION_ID "$ROSS_CLOUDFRONT_DISTRIBUTION_ID"

printf '\nROSS.CO GitHub production environment configured.\n'
printf 'Repository:   %s\n' "$REPOSITORY"
printf 'Environment:  %s\n' "$ENVIRONMENT_NAME"
printf 'Variables:    AWS_ROLE_ARN, AWS_REGION, ROSS_REGISTRY_BUCKET, ROSS_CLOUDFRONT_DISTRIBUTION_ID\n'
printf '\nAdd required reviewers and deployment-branch restrictions in GitHub Settings before the first production release.\n'
