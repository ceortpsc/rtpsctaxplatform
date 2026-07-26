#!/usr/bin/env bash
set -Eeuo pipefail

# ROSS.CO Infinite Package Manager production registry deployment.
# Run from AWS CloudShell after authenticating to the intended company account.
# No passwords, access keys, OAuth tokens, or private signing keys are accepted.

EXPECTED_AWS_ACCOUNT_ID="${EXPECTED_AWS_ACCOUNT_ID:?Set EXPECTED_AWS_ACCOUNT_ID before running}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-rossco-infinite-production}"
REGISTRY_DOMAIN="${REGISTRY_DOMAIN:-registry.rosstaxprosoftware.com}"
ROOT_DOMAIN="${ROOT_DOMAIN:-rosstaxprosoftware.com}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-ceortpsc/rtpsctaxplatform}"
TEMPLATE_FILE="${TEMPLATE_FILE:-infra/aws/rossco-registry-production.yaml}"
CREATE_HOSTED_ZONE_IF_MISSING="${CREATE_HOSTED_ZONE_IF_MISSING:-false}"
EXISTING_CERTIFICATE_ARN="${EXISTING_CERTIFICATE_ARN:-}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"

export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION" AWS_PAGER=""

fail() {
  printf 'ROSS.CO BLOCKED: %s\n' "$*" >&2
  exit 1
}

command -v aws >/dev/null 2>&1 || fail "AWS CLI is required."
command -v jq >/dev/null 2>&1 || fail "jq is required."
command -v openssl >/dev/null 2>&1 || fail "OpenSSL is required."
[[ -f "$TEMPLATE_FILE" ]] || fail "Template not found: $TEMPLATE_FILE"
[[ "$AWS_REGION" == "us-east-1" ]] || fail "Use us-east-1 because CloudFront requires its ACM certificate there."

CURRENT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text --no-cli-pager)"
[[ "$CURRENT_ACCOUNT" == "$EXPECTED_AWS_ACCOUNT_ID" ]] || \
  fail "Authenticated account $CURRENT_ACCOUNT does not match EXPECTED_AWS_ACCOUNT_ID."

printf 'ROSS.CO AWS identity verified: %s\n' "$CURRENT_ACCOUNT"

if [[ -n "$EXISTING_CERTIFICATE_ARN" ]]; then
  case "$EXISTING_CERTIFICATE_ARN" in
    arn:aws:acm:us-east-1:"${CURRENT_ACCOUNT}":certificate/*)
      ;;
    *)
      fail "Existing certificate must be an ACM certificate in us-east-1 and AWS account $CURRENT_ACCOUNT."
      ;;
  esac

  CERTIFICATE_STATUS="$({
    aws acm describe-certificate \
      --certificate-arn "$EXISTING_CERTIFICATE_ARN" \
      --query 'Certificate.Status' \
      --output text \
      --no-cli-pager
  })"
  [[ "$CERTIFICATE_STATUS" == "ISSUED" ]] || \
    fail "Existing ACM certificate status is $CERTIFICATE_STATUS, not ISSUED."

  CERTIFICATE_NAMES="$({
    aws acm describe-certificate \
      --certificate-arn "$EXISTING_CERTIFICATE_ARN" \
      --query 'Certificate.SubjectAlternativeNames' \
      --output text \
      --no-cli-pager
  })"

  REGISTRY_PARENT="${REGISTRY_DOMAIN#*.}"
  REGISTRY_WILDCARD="*.${REGISTRY_PARENT}"
  CERTIFICATE_MATCH=false
  for CERTIFICATE_NAME in $CERTIFICATE_NAMES; do
    if [[ "$CERTIFICATE_NAME" == "$REGISTRY_DOMAIN" || "$CERTIFICATE_NAME" == "$REGISTRY_WILDCARD" ]]; then
      CERTIFICATE_MATCH=true
      break
    fi
  done
  [[ "$CERTIFICATE_MATCH" == "true" ]] || \
    fail "Existing ACM certificate does not cover $REGISTRY_DOMAIN."

  printf 'Using issued ACM certificate: %s\n' "$EXISTING_CERTIFICATE_ARN"
fi

if [[ -z "$HOSTED_ZONE_ID" ]]; then
  HOSTED_ZONE_ID="$({
    aws route53 list-hosted-zones-by-name \
      --dns-name "$ROOT_DOMAIN" \
      --query "HostedZones[?Name=='${ROOT_DOMAIN}.' && Config.PrivateZone==\`false\`]|[0].Id" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  })"
  HOSTED_ZONE_ID="${HOSTED_ZONE_ID#/hostedzone/}"
fi

if [[ -z "$HOSTED_ZONE_ID" || "$HOSTED_ZONE_ID" == "None" ]]; then
  if [[ "$CREATE_HOSTED_ZONE_IF_MISSING" != "true" ]]; then
    fail "No public Route 53 hosted zone found for $ROOT_DOMAIN. Supply HOSTED_ZONE_ID or create/delegate the correct zone."
  fi

  CALLER_REFERENCE="rossco-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
  HOSTED_ZONE_ID="$({
    aws route53 create-hosted-zone \
      --name "$ROOT_DOMAIN" \
      --caller-reference "$CALLER_REFERENCE" \
      --hosted-zone-config Comment='ROSS.CO Infinite production DNS',PrivateZone=false \
      --query 'HostedZone.Id' \
      --output text \
      --no-cli-pager
  })"
  HOSTED_ZONE_ID="${HOSTED_ZONE_ID#/hostedzone/}"
  printf 'Created hosted zone %s. Update the registrar nameservers before expecting public DNS resolution.\n' "$HOSTED_ZONE_ID"
fi

printf 'Using hosted zone: %s\n' "$HOSTED_ZONE_ID"

OIDC_PROVIDER_ARN="$({
  aws iam list-open-id-connect-providers \
    --query 'OpenIDConnectProviderList[].Arn' \
    --output text \
    --no-cli-pager \
  | tr '\t' '\n' \
  | grep 'token.actions.githubusercontent.com' \
  | head -n1 || true
})"

if [[ -z "$OIDC_PROVIDER_ARN" ]]; then
  OIDC_PROVIDER_ARN="$({
    aws iam create-open-id-connect-provider \
      --url https://token.actions.githubusercontent.com \
      --client-id-list sts.amazonaws.com \
      --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
      --query OpenIDConnectProviderArn \
      --output text \
      --no-cli-pager
  })"
  printf 'Created GitHub Actions OIDC provider.\n'
else
  printf 'Using existing GitHub Actions OIDC provider.\n'
fi

aws cloudformation validate-template \
  --template-body "file://${TEMPLATE_FILE}" \
  --no-cli-pager >/dev/null

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    RegistryDomainName="$REGISTRY_DOMAIN" \
    HostedZoneId="$HOSTED_ZONE_ID" \
    ExistingCertificateArn="$EXISTING_CERTIFICATE_ARN" \
    GitHubOidcProviderArn="$OIDC_PROVIDER_ARN" \
    GitHubRepository="$GITHUB_REPOSITORY"

aws cloudformation wait stack-create-complete \
  --stack-name "$STACK_NAME" \
  --no-cli-pager 2>/dev/null || \
aws cloudformation wait stack-update-complete \
  --stack-name "$STACK_NAME" \
  --no-cli-pager 2>/dev/null || true

STACK_STATUS="$({
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' \
    --output text \
    --no-cli-pager
})"

case "$STACK_STATUS" in
  CREATE_COMPLETE|UPDATE_COMPLETE)
    ;;
  *)
    aws cloudformation describe-stack-events \
      --stack-name "$STACK_NAME" \
      --max-items 20 \
      --no-cli-pager || true
    fail "CloudFormation did not complete successfully: $STACK_STATUS"
    ;;
esac

OUTPUTS_JSON="$({
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs' \
    --output json \
    --no-cli-pager
})"

output_value() {
  local key="$1"
  jq -r --arg key "$key" '.[] | select(.OutputKey == $key) | .OutputValue' <<<"$OUTPUTS_JSON"
}

REGISTRY_URL="$(output_value RegistryUrl)"
REGISTRY_BUCKET="$(output_value RegistryBucket)"
DISTRIBUTION_ID="$(output_value RegistryDistributionId)"
CERTIFICATE_ARN="$(output_value RegistryCertificateArn)"
SIGNING_KEY_ARN="$(output_value RegistrySigningKeyArn)"
DEPLOY_ROLE_ARN="$(output_value GitHubDeployRoleArn)"

CERTIFICATE_STATUS="$({
  aws acm describe-certificate \
    --certificate-arn "$CERTIFICATE_ARN" \
    --query 'Certificate.Status' \
    --output text \
    --no-cli-pager
})"
[[ "$CERTIFICATE_STATUS" == "ISSUED" ]] || fail "ACM certificate status is $CERTIFICATE_STATUS, not ISSUED."

printf 'ROSS.CO KMS acceptance test\n'
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
printf 'ROSS.CO Infinite Package Manager production signing acceptance test\n' > "$TMP_DIR/message.txt"
openssl dgst -sha256 -binary "$TMP_DIR/message.txt" > "$TMP_DIR/digest.bin"

aws kms sign \
  --key-id "$SIGNING_KEY_ARN" \
  --message-type DIGEST \
  --message "fileb://${TMP_DIR}/digest.bin" \
  --signing-algorithm ECDSA_SHA_256 \
  --query Signature \
  --output text \
  --no-cli-pager \
| base64 --decode > "$TMP_DIR/signature.bin"

SIGNATURE_VALID="$({
  aws kms verify \
    --key-id "$SIGNING_KEY_ARN" \
    --message-type DIGEST \
    --message "fileb://${TMP_DIR}/digest.bin" \
    --signature "fileb://${TMP_DIR}/signature.bin" \
    --signing-algorithm ECDSA_SHA_256 \
    --query SignatureValid \
    --output text \
    --no-cli-pager
})"
[[ "$SIGNATURE_VALID" == "True" ]] || fail "KMS Sign/Verify acceptance test failed."

DNS_TARGET="$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.DomainName' --output text --no-cli-pager)"
DNS_STATUS="$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.Status' --output text --no-cli-pager)"
[[ "$DNS_STATUS" == "Deployed" ]] || printf 'CloudFront status is %s; public propagation may still be completing.\n' "$DNS_STATUS"

mkdir -p build
cat > build/rossco-production-outputs.env <<EOF
AWS_ROLE_ARN=$DEPLOY_ROLE_ARN
AWS_REGION=$AWS_REGION
ROSS_REGISTRY_BUCKET=$REGISTRY_BUCKET
ROSS_CLOUDFRONT_DISTRIBUTION_ID=$DISTRIBUTION_ID
ROSS_REGISTRY_URL=$REGISTRY_URL
ROSS_SIGNING_KEY_ARN=$SIGNING_KEY_ARN
ROSS_ACM_CERTIFICATE_ARN=$CERTIFICATE_ARN
ROSS_HOSTED_ZONE_ID=$HOSTED_ZONE_ID
ROSS_CLOUDFRONT_DOMAIN=$DNS_TARGET
EOF
chmod 600 build/rossco-production-outputs.env

cat > build/rossco-production-evidence.json <<EOF
{
  "schema": "ross.co.production-evidence.v1",
  "product": "ROSS.CO Infinite Package Manager",
  "owner": "Ross Tax Pro Software Co.",
  "awsAccountId": "$CURRENT_ACCOUNT",
  "region": "$AWS_REGION",
  "stack": "$STACK_NAME",
  "stackStatus": "$STACK_STATUS",
  "certificateStatus": "$CERTIFICATE_STATUS",
  "cloudFrontStatus": "$DNS_STATUS",
  "kmsSignatureValid": true,
  "registryUrl": "$REGISTRY_URL",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
chmod 600 build/rossco-production-evidence.json

printf '\nROSS.CO production infrastructure completed.\n'
printf 'Stack status:       %s\n' "$STACK_STATUS"
printf 'Certificate status: %s\n' "$CERTIFICATE_STATUS"
printf 'KMS signature:      VERIFIED\n'
printf 'Registry URL:       %s\n' "$REGISTRY_URL"
printf 'CloudFront target:  %s\n' "$DNS_TARGET"
printf 'Private outputs:    build/rossco-production-outputs.env\n'
printf 'Evidence record:    build/rossco-production-evidence.json\n'
printf '\nDo not commit either generated build file; they contain infrastructure identifiers.\n'
