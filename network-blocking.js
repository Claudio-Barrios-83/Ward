const path = require('path');
const { promises: fs } = require('fs');

const ENGINE_CACHE_FILE = 'ward-adblock-engine.bin';
const FALLBACK_BLOCK_PATTERNS = [
  '*://*.doubleclick.net/*',
  '*://*.googlesyndication.com/*',
  '*://*.googleadservices.com/*',
  '*://*.2mdn.net/*',
];

const GOOGLE_AD_HOST_SUFFIXES = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  '2mdn.net',
];

const YOUTUBE_AD_PATH_FRAGMENTS = [
  '/pagead/',
  '/api/stats/ads',
  '/get_midroll_info',
];

function mapResourceType(electronType) {
  if (!electronType) {
    return 'other';
  }

  const map = {
    mainFrame: 'main_frame',
    subFrame: 'sub_frame',
    xmlhttprequest: 'xmlhttprequest',
  };

  return map[electronType] || String(electronType).toLowerCase();
}

function hostMatches(hostname, suffixes) {
  const normalized = String(hostname || '').toLowerCase();
  return suffixes.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

function isYoutubeAdLikeUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathWithQuery = `${parsed.pathname}${parsed.search}`;

    if (hostMatches(hostname, GOOGLE_AD_HOST_SUFFIXES)) {
      return true;
    }

    if (hostname.endsWith('youtube.com')) {
      return YOUTUBE_AD_PATH_FRAGMENTS.some((fragment) => pathWithQuery.includes(fragment));
    }

    return false;
  } catch {
    return false;
  }
}

function isGoogleVideoPlaybackUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      (hostname === 'googlevideo.com' || hostname.endsWith('.googlevideo.com')) &&
      parsed.pathname.includes('/videoplayback')
    );
  } catch {
    return false;
  }
}

function attachFallbackDomainBlock(session) {
  session.webRequest.onBeforeRequest({ urls: FALLBACK_BLOCK_PATTERNS }, (_details, callback) => {
    callback({ cancel: true });
  });

  return () => {
    session.webRequest.onBeforeRequest(null);
  };
}

function wrapSupplementalYoutubeBlocking(blocker) {
  const originalOnBeforeRequest = blocker.onBeforeRequest;

  blocker.onBeforeRequest = (details, callback) => {
    const resourceType = mapResourceType(details.resourceType);
    if (isGoogleVideoPlaybackUrl(details.url)) {
      callback({});
      return;
    }

    if (resourceType !== 'main_frame' && isYoutubeAdLikeUrl(details.url)) {
      callback({ cancel: true });
      return;
    }

    originalOnBeforeRequest(details, callback);
  };

  return () => {
    blocker.onBeforeRequest = originalOnBeforeRequest;
  };
}

async function initNetworkBlocking(session) {
  const { app } = require('electron');
  const { ElectronBlocker } = require('@cliqz/adblocker-electron');
  const fetch = require('cross-fetch');

  const cachePath = path.join(app.getPath('userData'), ENGINE_CACHE_FILE);

  try {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cachePath,
      read: fs.readFile,
      write: fs.writeFile,
    });

    blocker.config.loadCosmeticFilters = false;
    blocker.config.guessRequestTypeFromUrl = true;

    const restoreOnBeforeRequest = wrapSupplementalYoutubeBlocking(blocker);
    blocker.enableBlockingInSession(session);

    console.log('[WardAds] ElectronBlocker listo con cache:', cachePath);

    return {
      disable() {
        restoreOnBeforeRequest();

        if (blocker.isBlockingEnabled(session)) {
          blocker.disableBlockingInSession(session);
        }
      },
    };
  } catch (error) {
    console.error('[WardAds] Error cargando motor principal, usando fallback por dominios:', error);

    const disableFallback = attachFallbackDomainBlock(session);

    return {
      disable() {
        disableFallback();
      },
    };
  }
}

module.exports = {
  FALLBACK_BLOCK_PATTERNS,
  initNetworkBlocking,
  isGoogleVideoPlaybackUrl,
  isYoutubeAdLikeUrl,
  mapResourceType,
};
