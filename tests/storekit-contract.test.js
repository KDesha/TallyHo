const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'www', 'app.js'), 'utf8');
const storePlugin = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'TallyHoStorePlugin.swift'), 'utf8');

test('lifetime Premium uses the same permanent product identifier in web and StoreKit', () => {
  const productID = 'com.kayladeshasier.tallyho.premium.lifetime';
  assert.match(app, new RegExp(`lifetime:'${productID.replaceAll('.', '\\.')}'`));
  assert.match(storePlugin, new RegExp(`lifetimeProductID = "${productID.replaceAll('.', '\\.')}"`));
});

test('lifetime Premium is verified but never exposed as a purchase button', () => {
  assert.match(storePlugin, /entitlementProductIDs\.contains\(transaction\.productID\)/);
  assert.match(storePlugin, /lifetimeTransaction \?\? newestTransaction/);
  assert.match(storePlugin, /Product\.products\(for: Array\(subscriptionProductIDs\)\)/);
  assert.doesNotMatch(storePlugin, /case "lifetime"/);
});
