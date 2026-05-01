const test = require('node:test');
const assert = require('node:assert/strict');

const { isGoogleVideoPlaybackUrl, isYoutubeAdLikeUrl, mapResourceType } = require('../network-blocking');

test('mapResourceType normalizes known Electron resource types', () => {
  assert.equal(mapResourceType('mainFrame'), 'main_frame');
  assert.equal(mapResourceType('subFrame'), 'sub_frame');
  assert.equal(mapResourceType('xmlhttprequest'), 'xmlhttprequest');
  assert.equal(mapResourceType('MEDIA'), 'media');
  assert.equal(mapResourceType(), 'other');
});

test('isYoutubeAdLikeUrl detects explicit YouTube ad endpoints and ad hosts', () => {
  assert.equal(isYoutubeAdLikeUrl('https://www.youtube.com/pagead/viewthroughconversion/123'), true);
  assert.equal(isYoutubeAdLikeUrl('https://www.youtube.com/api/stats/ads?ver=2'), true);
  assert.equal(isYoutubeAdLikeUrl('https://pubads.g.doubleclick.net/gampad/ads?slotname=test'), true);
});

test('isYoutubeAdLikeUrl does not block ordinary YouTube pages', () => {
  assert.equal(isYoutubeAdLikeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
  assert.equal(isYoutubeAdLikeUrl('https://www.youtube.com/results?search_query=ward'), false);
  assert.equal(isYoutubeAdLikeUrl('https://rr1---sn.googlevideo.com/videoplayback?ctier=A&range=0-1'), false);
  assert.equal(isYoutubeAdLikeUrl('nota-url-valida'), false);
});

test('isGoogleVideoPlaybackUrl detects media streams that must not be blocked by the wrapper', () => {
  assert.equal(isGoogleVideoPlaybackUrl('https://rr1---sn.googlevideo.com/videoplayback?range=0-1'), true);
  assert.equal(isGoogleVideoPlaybackUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
  assert.equal(isGoogleVideoPlaybackUrl('nota-url-valida'), false);
});
