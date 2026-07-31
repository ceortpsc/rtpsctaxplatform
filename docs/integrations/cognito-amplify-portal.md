# Cognito login gate and Amplify front door

## Scope

This implementation adds a production-capable authentication boundary to `services/web-portal` without claiming that a static Amplify page can replace the stateful Node portal.

- Local development may use `PORTAL_AUTH_MODE=local`.
- Staging and production use `PORTAL_AUTH_MODE=cognito`.
- Cognito uses OAuth 2.0 authorization code flow with PKCE.
- The callback validates state, nonce, issuer, audience, token use, expiration, JWKS key, and RS256 signature.
- Access to `/account`, `/efin`, and `/client-import` requires an authenticated session.
- EFIN APIs no longer accept an unauthenticated `accountId` query as authority.
- Amplify hosts a static secure front door that redirects to the stateful portal.

## Required environment

```bash
PORTAL_AUTH_MODE=cognito
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_example
COGNITO_CLIENT_ID=exampleclientid
COGNITO_DOMAIN=https://rtpsc-example.auth.us-east-1.amazoncognito.com
COGNITO_CALLBACK_URL=https://portal.example.com/auth/callback
COGNITO_LOGOUT_URL=https://portal.example.com/
COGNITO_SCOPES="openid email profile"
```

No app-client secret is used. The Cognito app client is configured as a public client with authorization-code flow and PKCE.

## CloudShell installation

```bash
export AWS_REGION=us-east-1
export ENVIRONMENT_NAME=staging
export DOMAIN_PREFIX=rtpsc-portal-unique-name
export CALLBACK_URL=https://portal.example.com/auth/callback
export LOGOUT_URL=https://portal.example.com/
export CREATE_AMPLIFY_APP=false

bash scripts/cloudshell/install-cognito-portal.sh
```

The script writes generated non-secret identifiers to `build/aws/portal-cognito.env` with mode `0600`. It does not write passwords, client secrets, GitHub tokens, taxpayer data, EFINs, PTINs, or CAF numbers to Git.

## Optional Amplify front door

The optional Amplify app builds `build/amplify-portal/`. It displays no protected data and redirects users to the stateful portal.

```bash
export CREATE_AMPLIFY_APP=true
export GITHUB_TOKEN="$(aws secretsmanager get-secret-value --secret-id rtpsc/github/amplify-token --query SecretString --output text)"
export PORTAL_API_BASE_URL=https://portal-api.example.com
bash scripts/cloudshell/install-cognito-portal.sh
```

Repair an existing Amplify branch and start a controlled release:

```bash
export AMPLIFY_APP_ID=d123example
export BRANCH_NAME=main
export PORTAL_API_BASE_URL=https://portal-api.example.com
bash scripts/cloudshell/repair-amplify-portal.sh
```

## Client import controls

`/client-import` creates a secure transfer message and checks:

1. authenticated portal session;
2. supported source type;
3. expected record count between 1 and 10,000;
4. documented taxpayer consent or lawful firm authority;
5. encrypted portal transfer;
6. malware and file-type scanning before ingestion;
7. row validation and duplicate detection;
8. human import approval;
9. immutable receipt generation.

`READY_FOR_SECURE_UPLOAD` means that upload preparation may proceed. It does not mean records were imported or accepted.

## Verification

```bash
./scripts/aol install
./rtpsc lint
./rtpsc test
./rtpsc build
PORTAL_AUTH_MODE=local ./rtpsc start web-portal
```

Production health is fail-closed: when Cognito mode is selected but required configuration is incomplete, `/health` returns `503 blocked_configuration`.
