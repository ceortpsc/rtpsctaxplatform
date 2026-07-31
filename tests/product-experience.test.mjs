import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATALOG,
  getProduct,
  productsByCategory,
  productSearch,
  designSystemStylesheets,
  designSystemScripts
} from '../packages/ui-design-system/src/index.mjs';

test('product catalog covers every product category and uses unique ids', () => {
  assert.ok(PRODUCT_CATEGORIES.length >= 7);
  assert.ok(PRODUCT_CATALOG.length >= 15);
  assert.equal(new Set(PRODUCT_CATALOG.map((product) => product.id)).size, PRODUCT_CATALOG.length);
  for (const category of PRODUCT_CATEGORIES) {
    assert.ok(productsByCategory(category.id).length > 0, `${category.id} should contain products`);
  }
});

test('product discovery resolves exact products and keyword search', () => {
  assert.equal(getProduct('client-portal')?.name, 'Secure Client Portal');
  assert.ok(productSearch('secure import').some((product) => product.id === 'client-portal'));
  assert.ok(productSearch('invoice pdf').some((product) => product.id === 'invoice'));
  assert.deepEqual(productSearch('not-a-real-product'), []);
});

test('shared Signal Era product experience assets are published', () => {
  assert.ok(designSystemStylesheets().includes('/rtp-design/product-experience.css'));
  assert.deepEqual(designSystemScripts(), ['/rtp-design/product-tools.js']);
});
