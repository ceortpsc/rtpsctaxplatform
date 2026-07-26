/**
 * Shared design-style guidance for the Design Style & Presentation agent.
 * Kept separate from roles to avoid coupling inventory discovery to role assessors.
 */

export const DESIGN_STYLE_GUIDANCE = Object.freeze({
  brandSignals: ['rtpsc', 'ross tax', 'efile', 'aol', 'adaptive optimized linker'],
  avoidedLooks: [
    {
      id: 'purple-gradient',
      pattern: /(#7c3aed|#8b5cf6|#a855f7|purple\s*to\s*indigo|from-purple|to-indigo)/i,
      message: 'Avoid default purple/indigo gradient AI themes.'
    },
    {
      id: 'cream-terracotta',
      pattern: /(#f4f1ea|#f5f0e6|terracotta|#c45c26)/i,
      message: 'Avoid warm-cream + terracotta serif default look.'
    },
    {
      id: 'system-sans',
      pattern: /\b(font-family\s*:\s*(inter|roboto|arial|system-ui|sans-serif)\b)/i,
      message: 'Prefer expressive purposeful fonts over default system stacks for presentation surfaces.'
    },
    {
      id: 'glow-stack',
      pattern: /(box-shadow\s*:[^;]{0,80}(0\s+0\s+\d+px|glow)|filter\s*:\s*drop-shadow)/i,
      message: 'Avoid glow / multi-layer shadow noise on presentation surfaces.'
    }
  ]
});
