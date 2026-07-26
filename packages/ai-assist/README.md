# @rtp/ai-assist

Enterprise AI assist scaffold for the RTPSC Tax Platform.

- **Default mode:** `local` (heuristic / catalog grounding — no external LLM)
- **Guardrails:** refuses unauthorized IRS access and scraping intents
- **Human-in-the-loop:** required for filing or refund-impacting recommendations

```js
import { createAiAssist } from '@rtp/ai-assist';

const assist = createAiAssist();
const answer = assist.ask('Explain refund tracking modules');
```

See `docs/enterprise-tax-software-checklist.md` section **AI assist**.
