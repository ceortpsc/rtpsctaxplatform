export { IP, copyrightBanner, copyrightJson } from './ip.mjs';
export { LIFECYCLE_STAGES, lifecycleMap, planRelease, scopeRelease } from './lifecycle.mjs';
export { infiniteTransfer, transferGraph } from './transfer.mjs';
export { loadConfig, initConfig, writeConfig, DEFAULT_CONFIG, CONFIG_FILE_NAME } from './config.mjs';
export { registerProduct } from './register.mjs';
export { ensurePresenceSite, presenceStatus } from './presence.mjs';
export { emitSeo } from './seo.mjs';
export { validatePrototype, verifyPrototype } from './validate.mjs';
export { runCli } from './cli.mjs';

export function describeApiSurface() {
  return {
    package: '@rtp/rossco',
    version: '0.1.0',
    entry: 'tools/rossco/src/index.mjs',
    product: 'ROSS.CO Infinite Transfer Rate Package Manager',
    createSurface: {
      lifecycleMap: 'lifecycleMap()',
      infiniteTransfer: 'infiniteTransfer(root, options?)',
      registerProduct: 'registerProduct(root)',
      emitSeo: 'emitSeo(root)',
      validatePrototype: 'validatePrototype(root)'
    }
  };
}
