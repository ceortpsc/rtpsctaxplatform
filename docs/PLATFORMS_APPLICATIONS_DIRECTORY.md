# Ross Platforms & Applications Directory

This repository participates in the Ross Tax Pro Software Co. master platform registry.

## Registry authority

- Identity authority: **Ross Identity Command Engine**
- Protected directory: https://ross-identity-command-engine-rydwth.v2.appdeploy.ai/platform-directory/
- GitHub account indexed: `ceortpsc`
- GitHub repositories discovered: **22**
- AppDeploy applications discovered: **16**

## Registry model

Every mapped Ross repository receives `.ross/platform-registry.json` containing its canonical AppDeploy relationship. Repositories without a credible application relationship remain indexed as `UNMAPPED_REPO` and are not modified simply to force a deployment association.

Mapping classifications:

- `DIRECT_MATCH` — repository clearly corresponds to the deployed application/product.
- `RELATED_REPO` — repository supports or overlaps the application but is not asserted as its native deployment source.
- `UNMAPPED_REPO` — accessible GitHub repository with no verified AppDeploy application mapping.
- `APP_WITHOUT_REPO` — AppDeploy application with no verified GitHub repository mapping.
- `ERROR_REPAIR_REQUIRED` — application exists but is not currently operational.

## Source-binding rule

The current AppDeploy connector does not expose a native GitHub-repository binding operation. Therefore the registry records canonical repo↔application relationships but does **not** falsely claim that AppDeploy builds automatically originate from those repositories. Native CI/CD source binding should be marked active only after a deployment provider exposes and confirms that integration.

Private repository names and mappings are intentionally rendered only through the protected Super Admin directory rather than duplicated into this public documentation file.
