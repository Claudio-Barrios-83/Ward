const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const { SKIP_BUTTON_SELECTORS, WATCH_PAGE_SELECTORS, createTickScheduler } = require('../youtube-dom-guards');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('createTickScheduler coalesces duplicate schedules into one run', async () => {
  let runs = 0;
  const scheduler = createTickScheduler(() => {
    runs += 1;
  }, { delay: 5 });

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();

  await wait(25);
  scheduler.cancel();

  assert.equal(runs, 1);
});

test('createTickScheduler allows a later schedule after the pending run finishes', async () => {
  let runs = 0;
  const scheduler = createTickScheduler(() => {
    runs += 1;
  }, { delay: 5 });

  scheduler.schedule();
  await wait(20);
  scheduler.schedule();
  await wait(20);
  scheduler.cancel();

  assert.equal(runs, 2);
});

test('watch page selectors do not hide the video ad stream container', () => {
  assert.equal(WATCH_PAGE_SELECTORS.includes('.video-ads'), false);
});

test('watch page selectors do not remove YouTube player internals', () => {
  assert.equal(WATCH_PAGE_SELECTORS.includes('#player-ads'), false);
  assert.equal(WATCH_PAGE_SELECTORS.includes('ytd-player-legacy-desktop-watch-ads-renderer'), false);
  assert.equal(WATCH_PAGE_SELECTORS.includes('.ytp-ad-module'), false);
});

test('skip button selectors include current YouTube skip variants', () => {
  assert.equal(SKIP_BUTTON_SELECTORS.includes('.ytp-ad-skip-button-modern'), true);
  assert.equal(SKIP_BUTTON_SELECTORS.includes('.ytp-skip-ad-button__button'), true);
  assert.equal(SKIP_BUTTON_SELECTORS.includes('[class*="skip-ad"]'), true);
});

test('guards do not seek the video element manually', () => {
  const source = readFileSync(path.join(__dirname, '..', 'youtube-dom-guards.js'), 'utf8');
  assert.equal(source.includes('currentTime ='), false);
});
