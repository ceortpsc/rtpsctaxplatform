export const IP = Object.freeze({
  productName: 'ROSS.CO',
  productExpansion: 'Infinite Transfer Rate Package Manager',
  productFull: 'ROSS.CO — Infinite Transfer Rate Package Manager',
  shortName: 'ITR',
  version: '0.1.0',
  copyrightYear: 2026,
  copyrightHolder: 'RTPSC / Ross Tax Software',
  copyrightLine:
    'Copyright (c) 2026 RTPSC / Ross Tax Software. ROSS.CO and Infinite Transfer Rate marks reserved where not licensed.',
  spdxLicense: 'MIT',
  licenseFile: 'LICENSE',
  noticeFile: 'tools/rossco/NOTICE',
  repoPath: 'tools/rossco',
  domain: 'ross.co',
  contact: 'ceo@rosstaxsoftware.com',
  marks: Object.freeze([
    {
      mark: 'ROSS.CO',
      kind: 'product brand',
      meaning: 'Ross Tax Software package-velocity product line',
      note: 'Original brand for RTPSC / Ross Tax Software package manager lifecycle suite.'
    },
    {
      mark: 'Infinite Transfer Rate',
      kind: 'product descriptor',
      meaning: 'Unbounded parallel workspace transfer / link velocity mode',
      note: 'Original product phrasing for ROSS.CO ITR.'
    },
    {
      mark: 'ITR',
      kind: 'product acronym',
      meaning: 'Infinite Transfer Rate',
      note: 'Used solely as acronym for Infinite Transfer Rate within this repository.'
    },
    {
      mark: '◈',
      kind: 'signal mark',
      meaning: 'ROSS.CO transfer-rate glyph',
      note: 'Original CLI trade-dress element.'
    }
  ]),
  disclaimer:
    'ROSS.CO Infinite Transfer Rate Package Manager is an original product of RTPSC / Ross Tax Software. ' +
    'It delegates local workspace linking to AOL (Adaptive Optimized Linker). ' +
    'It does not claim affiliation with unrelated third-party trademarks.',
  rights: Object.freeze([
    'Copyright in source code, schemas, lifecycle maps, SEO presence assets, and CLI trade dress',
    'Copyright in documentation volumes (plan, scope, stage, validate, verify, register)',
    'Right to license under the MIT License as distributed in the repository LICENSE file',
    'Right to enforce product identification for ROSS.CO / ITR within the RTPSC Tax Platform'
  ]),
  registrationChecklist: Object.freeze([
    'Record copyright notice in NOTICE and LICENSE',
    'Seal product version in rossco.config.json and package.json',
    'Publish presence site with canonical domain metadata',
    'File trademark-style internal register entry (register command)',
    'Archive SEO sitemap and robots policy with release artifacts'
  ])
});

export function copyrightBanner() {
  return [
    `${IP.productFull} v${IP.version}`,
    IP.copyrightLine,
    `License: ${IP.spdxLicense}`,
    `Contact: ${IP.contact}`,
    IP.disclaimer
  ].join('\n');
}

export function copyrightJson() {
  return {
    product: IP.productFull,
    version: IP.version,
    copyright: IP.copyrightLine,
    holder: IP.copyrightHolder,
    year: IP.copyrightYear,
    spdx: IP.spdxLicense,
    marks: IP.marks,
    rights: IP.rights,
    registrationChecklist: IP.registrationChecklist,
    disclaimer: IP.disclaimer
  };
}
