#!/usr/bin/env bash
set -Eeuo pipefail

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
AMPLIFY_APP_ID="${AMPLIFY_APP_ID:-}"
BRANCH_NAME="${BRANCH_NAME:-main}"
PORTAL_API_BASE_URL="${PORTAL_API_BASE_URL:-}"

fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || fail 'AWS CLI is required.'
[[ -n "$AMPLIFY_APP_ID" ]] || fail 'Set AMPLIFY_APP_ID.'
[[ "$PORTAL_API_BASE_URL" =~ ^https:// ]] || fail 'PORTAL_API_BASE_URL must use HTTPS.'
aws sts get-caller-identity --region "$AWS_REGION" >/dev/null || fail 'AWS credentials are not active.'
aws amplify get-app --region "$AWS_REGION" --app-id "$AMPLIFY_APP_ID" >/dev/null || fail 'Amplify app was not found.'

if ! aws amplify get-branch --region "$AWS_REGION" --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH_NAME" >/dev/null 2>&1; then
  aws amplify create-branch \
    --region "$AWS_REGION" \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$BRANCH_NAME" \
    --stage PRODUCTION \
    --enable-auto-build >/dev/null
fi

aws amplify update-app \
  --region "$AWS_REGION" \
  --app-id "$AMPLIFY_APP_ID" \
  --environment-variables "PORTAL_API_BASE_URL=$PORTAL_API_BASE_URL" >/dev/null

JOB_ID="$(aws amplify start-job --region "$AWS_REGION" --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH_NAME" --job-type RELEASE --query 'jobSummary.jobId' --output text)"
printf 'Amplify release started. app=%s branch=%s job=%s\n' "$AMPLIFY_APP_ID" "$BRANCH_NAME" "$JOB_ID"

while :; do
  STATUS="$(aws amplify get-job --region "$AWS_REGION" --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH_NAME" --job-id "$JOB_ID" --query 'job.summary.status' --output text)"
  printf 'Amplify job status: %s\n' "$STATUS"
  case "$STATUS" in
    SUCCEED) break ;;
    FAILED|CANCELLED) fail "Amplify deployment ended with $STATUS." ;;
  esac
  sleep 10
done

DOMAIN="$(aws amplify get-app --region "$AWS_REGION" --app-id "$AMPLIFY_APP_ID" --query 'app.defaultDomain' --output text)"
printf 'Amplify portal front door: https://%s.%s\n' "$BRANCH_NAME" "$DOMAIN"
