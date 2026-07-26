# ROSS.CO Infinite Package Manager — Production Activation

**Owner:** Ross Tax Pro Software Co.  
**Product:** ROSS.CO Infinite Package Manager  
**Evidence policy:** A resource is not marked live, filed, registered, signed, or verified until the corresponding external receipt or automated evidence exists.

## Production architecture

```text
ROSS.CO native release commands
        ↓
Deterministic package artifact
        ↓
SHA-256 release manifest
        ↓
GitHub OIDC / Sigstore build attestation
        ↓
AWS OIDC deployment role
        ↓
Versioned private S3 registry origin
        ↓
CloudFront TLS distribution
        ↓
registry.rosstaxprosoftware.com
```

## Native release sequence

```bash
./scripts/rossco lifecycle
./scripts/rossco validate
./scripts/rossco test
./scripts/rossco verify
./scripts/rossco register
```

The CI workflow packages the verified ROSS.CO source, creates a checksum and release manifest, and generates an artifact provenance attestation. Production publication occurs only from `main` or a `rossco-v*` tag and only through the protected `rossco-production` environment.

## Infrastructure deployment

Template:

```text
infra/aws/rossco-registry-production.yaml
```

Required CloudFormation parameters:

| Parameter | Required value |
|---|---|
| `RegistryDomainName` | `registry.rosstaxprosoftware.com` |
| `HostedZoneId` | Public Route 53 hosted-zone ID that contains the registry record |
| `ExistingCertificateArn` | Issued ACM certificate ARN in `us-east-1`; may be blank only when the stack should request a new certificate |
| `GitHubOidcProviderArn` | AWS IAM OIDC provider ARN for `token.actions.githubusercontent.com` |
| `GitHubRepository` | `ceortpsc/rtpsctaxplatform` |
| `RegistryBucketName` | Optional globally unique bucket name |

Approved existing certificate for the current production path:

```text
arn:aws:acm:us-east-1:238395401086:certificate/2cf8291f-d58c-43b3-a21b-243fb57f7d5e
```

The approved certificate is issued for `rosstaxprosoftware.com` and `*.rosstaxprosoftware.com`; therefore it covers `registry.rosstaxprosoftware.com`. It does not cover `registry.rosstaxsoftware.com`.

The stack creates:

- Versioned private S3 artifact storage
- CloudFront HTTPS delivery
- Route 53 A and AAAA aliases
- ECC P-256 KMS signing key
- GitHub OIDC deployment role
- Least-privilege publication policy

When `ExistingCertificateArn` is blank, the stack also requests and DNS-validates a new ACM certificate. When it is supplied, the existing issued certificate is reused and no duplicate certificate is requested.

## CloudShell deployment

```bash
cd "$HOME/rtpsctaxplatform"

export EXPECTED_AWS_ACCOUNT_ID="238395401086"
export AWS_REGION="us-east-1"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_PAGER=""
export STACK_NAME="rossco-infinite-production"
export ROOT_DOMAIN="rosstaxprosoftware.com"
export REGISTRY_DOMAIN="registry.rosstaxprosoftware.com"
export EXISTING_CERTIFICATE_ARN="arn:aws:acm:us-east-1:238395401086:certificate/2cf8291f-d58c-43b3-a21b-243fb57f7d5e"
export GITHUB_REPOSITORY="ceortpsc/rtpsctaxplatform"
export CREATE_HOSTED_ZONE_IF_MISSING="false"

./infra/aws/deploy-rossco-registry-cloudshell.sh
```

If the parent domain is not hosted in Route 53, supply the exact Route 53 `HOSTED_ZONE_ID` for a properly delegated `registry.rosstaxprosoftware.com` child zone before running the script.

## Repository production variables

Configure these as GitHub repository or environment variables after the CloudFormation stack completes:

```text
AWS_ROLE_ARN=<GitHubDeployRoleArn output>
AWS_REGION=us-east-1
ROSS_REGISTRY_BUCKET=<RegistryBucket output>
ROSS_CLOUDFRONT_DISTRIBUTION_ID=<RegistryDistributionId output>
```

Do not store long-lived AWS access keys. The workflow is designed for short-lived GitHub OIDC credentials.

## Production environment controls

Create a GitHub environment named:

```text
rossco-production
```

Recommended protections:

- Required reviewer: repository owner or authorized release manager
- Deployment restricted to `main` and `rossco-v*` tags
- No self-approval by an automation account
- Deployment evidence retained for at least 90 days
- Branch protection requiring successful ROSS.CO verification

## Code-signing model

Two complementary mechanisms are defined:

1. **GitHub OIDC/Sigstore artifact attestation** — establishes the repository, workflow, commit, and build identity that produced the release artifact.
2. **AWS KMS signing key** — ECC P-256 `SIGN_VERIFY` key for ROSS.CO registry manifests and package signatures.

Private signing-key material is never exported from KMS and must never be stored in the repository.

## Federal trademark execution gate

The federal trademark application cannot be submitted by CI. Before filing, the authorized corporate signer must confirm:

- Exact mark to file
- Standard-character or design-mark format
- Filing basis: current use or bona fide intent to use
- Correct international class or classes
- Goods and services wording selected from the USPTO ID Manual
- Ownership by Ross Tax Pro Software Co.
- Domicile information entered privately in Trademark Center
- Verified declaration and signature
- Payment authorization
- Specimen and first-use dates when filing based on current use

No repository file may claim federal registration until an official serial number and filing receipt are stored in the private corporate records.

## Copyright execution gate

The computer-program registration cannot be submitted by CI. Before filing, the authorized corporate signer must confirm:

- Work title and version
- Publication status and publication date, if applicable
- Authorship and work-made-for-hire status
- Claimant ownership and transfer basis
- Excluded preexisting or third-party material
- Redacted source-code deposit prepared under Copyright Office rules
- Certification and signature
- Payment authorization

No repository file may claim registration until the Copyright Office issues an official case number and registration record.

## Production verification checklist

| Gate | Evidence required |
|---|---|
| Native ROSS.CO tests | Successful workflow run |
| Release artifact | Uploaded CI artifact |
| Artifact checksum | `SHA256SUMS` |
| Build provenance | GitHub attestation record |
| Registry stack | CloudFormation `CREATE_COMPLETE` |
| TLS certificate | ACM `ISSUED` and hostname coverage confirmed |
| DNS | Public A/AAAA resolution to CloudFront |
| Registry publication | S3 immutable release prefix |
| Distribution health | HTTPS 200 response |
| KMS signing | Successful `Sign` and `Verify` test |
| Trademark filing | USPTO filing receipt and serial number |
| Copyright filing | Copyright Office submission receipt |

## Current state terminology

Use only these labels:

```text
PROPOSED
GENERATED
LOCALLY VALIDATED
AUTOMATICALLY TESTED
OWNER APPROVED
STAGING VERIFIED
PRODUCTION VERIFIED
FILED
REGISTERED
BLOCKED
```

The word `REGISTERED` is reserved for official government registration or an explicitly identified internal registry record. It must never be used ambiguously.
