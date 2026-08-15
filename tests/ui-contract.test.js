const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'www');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('Settings keeps profile fields in a button-opened modal', () => {
  assert.match(html, /id="updateProfile"[^>]*>Update information</);
  assert.match(html, /id="profileModal"[^>]*hidden/);
  assert.match(app, /\$\('#updateProfile'\)\.onclick=openProfileEditor/);
});

test('Settings money editor is collapsed and includes payments and income', () => {
  const details = html.match(/<details id="settingsMoneyDetails"[^>]*>/)?.[0] || '';
  assert.ok(details, 'scheduled money details exists');
  assert.doesNotMatch(details, /\sopen(?:\s|>)/);
  assert.match(app, /\['payment','income'\]\.includes\(entry\.type\)/);
  assert.match(html, /Edit payments &amp; income/);
});

test('Rainbow supplies colorful editor and profile modal treatments', () => {
  assert.match(styles, /body\[data-theme="rainbow"\] \.money-editor-details/);
  assert.match(styles, /body\[data-theme="rainbow"\] \.swipe-edit/);
  assert.match(styles, /body\[data-theme="rainbow"\] #profileModal \.modal/);
});

test('Home exposes dynamic cadence labels', () => {
  for (const id of ['periodKindLabel', 'kpiSavingsTitle', 'cashFlowHeading', 'allocationEyebrow']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /currentHomePeriod\(\)/);
});

test('routine pages omit repeated explainer copy', () => {
  for (const copy of [
    'The whole month from the 1st onward',
    'Every scheduled item, generated from your recurrence rules',
    'Home follows your',
    'let the plan side-eye surprises',
    'The same calendar month grouped from the 1st'
  ]) {
    assert.doesNotMatch(`${html}\n${app}`, new RegExp(copy));
  }
  assert.doesNotMatch(html, /id="periodNarrative"/);
  assert.doesNotMatch(html, /id="coachSummary"/);
});

test('App Review credentials stay fixed without bypassing StoreKit', () => {
  assert.match(app, /isReviewDemoUser\(user\)&&sensitiveChange/);
  assert.match(app, /email===REVIEW_DEMO_EMAIL[\s\S]*ensureReviewDemoProfile\(\)/);
  assert.match(app, /storeManaged:true,reviewAccess:false/);
  assert.doesNotMatch(app, /isReviewAccessUser/);
  assert.doesNotMatch(app, /subscription:'review'/);
});
