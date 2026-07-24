/**
 * AOL Intellectual Property — copyright, trademark, and attribution constants.
 *
 * Product name "AOL" herein means Adaptive Optimized Linker only.
 * This software is NOT affiliated with America Online, AOL LLC, or Yahoo.
 */

export const IP = Object.freeze({
  productName: 'AOL',
  productExpansion: 'Adaptive Optimized Linker',
  productFull: 'AOL — Adaptive Optimized Linker',
  version: '0.1.0',
  copyrightYear: 2026,
  copyrightHolder: 'RTPSC / Ross Tax Software',
  copyrightLine: 'Copyright (c) 2026 RTPSC / Ross Tax Software. All rights reserved where not licensed.',
  spdxLicense: 'MIT',
  licenseFile: 'LICENSE',
  noticeFile: 'tools/aol/NOTICE',
  repoPath: 'tools/aol',
  marks: Object.freeze([
    {
      mark: 'AOL',
      kind: 'product acronym',
      meaning: 'Adaptive Optimized Linker',
      note: 'Used solely as an acronym for Adaptive Optimized Linker within this repository.'
    },
    {
      mark: 'Adaptive Optimized Linker',
      kind: 'product name',
      meaning: 'First-party monorepo package manager',
      note: 'Original work of RTPSC / Ross Tax Software.'
    },
    {
      mark: "You've got packages.",
      kind: 'tagline',
      meaning: 'Original stylized greeting for AOL PM',
      note: 'Homage-inspired wording; not a claim on third-party slogans.'
    },
    {
      mark: '▲',
      kind: 'signal chevron trade dress',
      meaning: 'Brand mark for AOL PM CLI',
      note: 'Original trade-dress element for this product.'
    }
  ]),
  disclaimer:
    'AOL (Adaptive Optimized Linker) is an original software product of RTPSC / Ross Tax Software. ' +
    'It is not affiliated with, endorsed by, sponsored by, or related to America Online, AOL LLC, Yahoo, ' +
    'or any similarly named consumer online service. Any resemblance in naming or nostalgic aesthetic ' +
    'is conceptual homage only and does not imply common source or endorsement.',
  rights: Object.freeze([
    'Copyright in source code, documentation, configuration schemas, signal codes, and CLI trade dress',
    'Copyright in original ASCII/ANSI UI motifs and documentation copy',
    'Right to license under the MIT License as distributed in the repository LICENSE file',
    'Right to enforce trademark-style product identification within the RTPSC Tax Platform'
  ]),
  contact: 'ceo@rosstaxsoftware.com'
});

export function copyrightBanner() {
  return [
    IP.productFull,
    IP.copyrightLine,
    `License: ${IP.spdxLicense} — see ${IP.licenseFile}`,
    `Notice:  ${IP.noticeFile}`,
    '',
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
    license: IP.spdxLicense,
    marks: IP.marks,
    disclaimer: IP.disclaimer,
    rights: IP.rights,
    contact: IP.contact
  };
}
