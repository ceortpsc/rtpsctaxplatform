# RTPSC Enterprise Cosmetic Features v2

The cosmetic layer extends the Sovereign Ledger design system without changing tax, refund, enrollment, payment, identity, or transmission logic.

## Automatically loaded assets

Standard operator surfaces receive these assets in order:

1. `theme.css` — color, typography, spacing, elevation, and motion tokens
2. `components.css` — controls, tables, cards, alerts, modals, and states
3. `shell.css` — application shell and responsive navigation
4. `cosmetics.css` — premium cosmetic treatments and presentation utilities
5. `shell.js` — theme and cosmetic preference behavior

## Cosmetic capabilities

- Light and Midnight Ledger themes
- Compact, standard, and comfortable density
- Standard and high-contrast presentation
- System, enabled, and disabled motion preferences
- Glass panels and elevated surfaces
- Premium page headers and branded metric cards
- Button sheen and tactile pressed states
- Focus rings and form-field polish
- Sticky table headers and row highlighting
- Workflow status rails
- Empty, blocked, and skeleton-loading states
- Watermarks, gold rules, icon boxes, chips, and engraved text
- IntersectionObserver reveal animation with no-JavaScript fallback
- Mobile hover suppression and horizontal workflow cards
- Print-safe operator documents
- Reduced-motion and reduced-transparency support

## Markup examples

```html
<section class="rtp-page-header rtp-watermark" data-watermark="RTPSC">
  <p class="eyebrow">Enterprise Solutions v2</p>
  <h1>Refund Integrity Workbench</h1>
</section>

<section class="rtp-card rtp-glass" data-rtp-reveal>
  <span class="rtp-icon-box" aria-hidden="true">✓</span>
  <strong class="rtp-metric-value">24</strong>
  <span class="rtp-metric-trend" data-direction="up">3 resolved</span>
</section>

<div class="rtp-status-rail" aria-label="Case lifecycle">
  <div class="rtp-status-step" data-state="complete">Intake</div>
  <div class="rtp-status-step" data-state="active">Reconciliation</div>
  <div class="rtp-status-step" data-state="blocked">External response</div>
</div>
```

## Preference controls

Buttons may call the global shell API:

```js
window.rtpShell.applyTheme('midnight');
window.rtpShell.applyDensity('compact');
window.rtpShell.applyContrast('high');
window.rtpShell.applyMotion('off');
```

Declarative controls are also supported:

```html
<button data-rtp-density="compact">Compact</button>
<button data-rtp-density="standard">Standard</button>
<button data-rtp-density="comfortable">Comfortable</button>
<button data-rtp-contrast="high">High contrast</button>
<button data-rtp-motion="off">Motion off</button>
```

Preferences are stored locally under the `rtp.cosmetics.*` namespace and do not contain taxpayer, practitioner, return, financial, or authentication data.

## Accessibility requirements

Cosmetic effects must not communicate legal, tax, refund, transmission, or approval status by color alone. Maintain text labels such as `READY`, `LIMITED`, `HOLD`, `BLOCKED_EXTERNAL`, and `FAILED`. Motion must remain optional, focus indicators must stay visible, and hover effects must not be required to discover actions.
