# Refund Optimization Intelligence (ROI)

Core identity:

```text
Refund = Withholding + Refundable Credits − Tax Liability
```

(with nonrefundable credits applied against liability first)

## Engine

- `@rtp/refund-optimization-engine` — deterministic ROI workflow
- `@rtp/refund-intelligence-engine` — lifecycle, guard level, ETA, ROI handoff

## Workflow

1. Identify filing status  
2. Validate dependents  
3. Calculate refundable credits  
4. Calculate nonrefundable credits  
5. Calculate adjustments  
6. Calculate taxable income  
7. Calculate tax liability  
8. Calculate withholding  
9. Compute refund  
10. Run optimization scenarios (HOH/MFJ, standard vs itemized, SE vs S-Corp, …)  
11. Generate refund-boost recommendations  
12. Generate audit-grade explanation block  

## Rules wired

- Refundables first (EITC, ACTC, AOTC, PTC, …)
- Auto-compare standard vs itemized
- Auto-evaluate HOH eligibility
- Under-withholding detection
- SE vs S-Corp scaffold simulation
- Compliance-safe audit flags (fake dependent / SE-for-EITC / unsupported credits)

## Programmatic use

```js
import { runOptimizationWorkflow } from '@rtp/refund-optimization-engine';
import { buildRefundIntelligence } from '@rtp/refund-intelligence-engine';

const roi = runOptimizationWorkflow({
  withholding: 8000,
  taxLiability: 3200,
  earnedIncome: 28000,
  qualifyingChildren: 2,
  possibleHoh: true
});

const intel = buildRefundIntelligence({
  signals: { wmrStatus: 'APPROVED', identityFlag: false },
  roi: { withholding: 8000, taxLiability: 3200, earnedIncome: 28000, qualifyingChildren: 2 }
});
```
