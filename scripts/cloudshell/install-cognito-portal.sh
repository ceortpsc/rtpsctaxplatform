#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK_NAME="${STACK_NAME:-rtpsc-cognito-portal}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-staging}"
DOMAIN_PREFIX="${DOMAIN_PREFIX:-}"
CALLBACK_URL="${CALLBACK_URL:-}"
LOGOUT_URL="${LOGOUT_URL:-}"
CREATE_AMPLIFY_APP="${CREATE_AMPLIFY_APP:-false}"
REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/ceortpsc/rtpsctaxplatform}"
BRANCH_NAME="${BRANCH_NAME:-main}"
PORTAL_API_BASE_URL="${PORTAL_API_BASE_URL:-}"

fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || fail 'AWS CLI is required.'
aws sts get-caller-identity --region "$AWS_REGION" >/dev/null || fail 'AWS credentials are not active.'
[[ -n "$DOMAIN_PREFIX" ]] || fail 'Set DOMAIN_PREFIX to a globally unique Cognito domain prefix.'
[[ "$CALLBACK_URL" =~ ^https:// ]] || fail 'CALLBACK_URL must use HTTPS.'
[[ "$LOGOUT_URL" =~ ^https:// ]] || fail 'LOGOUT_URL must use HTTPS.'
[[ "$CREATE_AMPLIFY_APP" == "true" || "$CREATE_AMPLIFY_APP" == "false" ]] || fail 'CREATE_AMPLIFY_APP must be true or false.'
if [[ "$CREATE_AMPLIFY_APP" == "true" ]]; then
  [[ -n "${GITHUB_TOKEN:-}" ]] || fail 'GITHUB_TOKEN must be supplied through the CloudShell environment or secret retrieval command.'
  [[ "$PORTAL_API_BASE_URL" =~ ^https:// ]] || fail 'PORTAL_API_BASE_URL must use HTTPS when Amplify is enabled.'
fi

parameters=(
  "EnvironmentName=$ENVIRONMENT_NAME"
  "DomainPrefix=$DOMAIN_PREFIX"
  "CallbackUrl=$CALLBACK_URL"
  "LogoutUrl=$LOGOUT_URL"
  "CreateAmplifyApp=$CREATE_AMPLIFY_APP"
  "RepositoryUrl=$REPOSITORY_URL"
  "BranchName=$BRANCH_NAME"
  "PortalApiBaseUrl=$PORTAL_API_BASE_URL"
)
if [[ "$CREATE_AMPLIFY_APP" == "true" ]]; then
  parameters+=("RepositoryAccessToken=$GITHUB_TOKEN")
fi

aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$REPO_ROOT/infra/aws/cognito-amplify-portal.yaml" \
  --parameter-overrides "${parameters[@]}" \
  --no-fail-on-empty-changeset \
  --tags Application=RTPSC Environment="$ENVIRONMENT_NAME" ManagedBy=CloudFormation

output(){
  aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text
}

USER_POOL_ID="$(output UserPoolId)"
CLIENT_ID="$(output UserPoolClientId)"
COGNITO_DOMAIN="$(output CognitoDomain)"
mkdir -p "$REPO_ROOT/build/aws"
ENV_FILE="$REPO_ROOT/build/aws/portal-cognito.env"
umask 077
cat > "$ENV_FILE" <<EOF
PORTAL_AUTH_MODE=cognito
COGNITO_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_CLIENT_ID=$CLIENT_ID
COGNITO_DOMAIN=$COGNITO_DOMAIN
COGNITO_CALLBACK_URL=$CALLBACK_URL
COGNITO_LOGOUT_URL=$LOGOUT_URL
COGNITO_SCOPES=openid email profile
EOF
chmod 600 "$ENV_FILE"

printf 'Cognito portal stack deployed.\n'
printf 'Stack: %s\nRegion: %s\nConfiguration: %s\n' "$STACK_NAME" "$AWS_REGION" "$ENV_FILE"
printf 'No user password, app-client secret, GitHub token, taxpayer record, EFIN, PTIN, or CAF number was written to the repository.\n'
