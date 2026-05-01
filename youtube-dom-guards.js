(function attachModule(root, factory) {
  const exported = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }

  if (root) {
    root.WardYoutubeDomGuards = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWardYoutubeDomGuards() {
  const WATCH_PAGE_SELECTORS = [
    'ytd-ad-slot-renderer',
    'ytd-companion-slot-renderer',
    'ytd-companion-ad-slot-renderer',
    'ytd-ads-engagement-panel-content-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-page-top-ad-layout-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-sparkles-text-search-renderer',
    'ytd-compact-promoted-item-renderer',
    'ytd-compact-promoted-video-renderer',
    'ytd-promoted-video-renderer',
    '#panels ytd-action-companion-ad-renderer',
    '#secondary ytd-action-companion-ad-renderer',
  ];

  const DISCOVERY_PAGE_SELECTORS = [
    'ytd-display-ad-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-banner-promo-renderer',
    'ytd-search-pyv-renderer',
    '.ytd-display-ad-renderer',
    '#masthead-ad',
  ];

  const WRAPPER_REMOVAL_SELECTORS = [
    'ytd-rich-item-renderer:has(ytd-display-ad-renderer)',
    'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
    'ytd-rich-section-renderer:has(ytd-display-ad-renderer)',
    'ytd-compact-video-renderer:has(ytd-display-ad-renderer)',
    'ytd-watch-next-secondary-results-renderer:has(ytd-action-companion-ad-renderer)',
  ];

  const SPONSORED_PANEL_SELECTORS = [
    'ytd-action-companion-ad-renderer',
    'ytd-engagement-panel-section-list-renderer',
    'ytd-page-top-ad-layout-renderer',
    '#panels > *',
    '#secondary > *',
  ];

  const SPONSORED_LABELS = [
    'sponsored',
    'patrocinado',
    'publicidad',
    'anuncio',
    'annonce',
    'gesponsert',
    'reklama',
  ];

  const CSS_ONLY_HIDE_SELECTORS = Array.from(
    new Set([...WATCH_PAGE_SELECTORS, ...DISCOVERY_PAGE_SELECTORS, ...WRAPPER_REMOVAL_SELECTORS])
  );

  const SKIP_WORDS = ['skip', 'skip ad', 'saltar', 'saltar anuncio', 'pular', 'ignorar', 'omitir'];
  const SKIP_BUTTON_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-skip-ad-button__button',
    '.ytp-ad-skip-button-slot',
    '[class*="ytp-ad-skip"]',
    '[class*="skip-ad"]',
  ];

  function buildCss(selectors) {
    return `${selectors.join(',\n')} {\n  display: none !important;\n  visibility: hidden !important;\n}`;
  }

  function createTickScheduler(run, options = {}) {
    const delay = typeof options.delay === 'number' ? options.delay : 80;
    const setTimer = options.setTimer || setTimeout;
    const clearTimer = options.clearTimer || clearTimeout;

    let timerId = null;
    let disposed = false;

    return {
      schedule() {
        if (disposed || timerId !== null) {
          return false;
        }

        timerId = setTimer(() => {
          timerId = null;
          if (!disposed) {
            run();
          }
        }, delay);

        return true;
      },

      cancel() {
        disposed = true;
        if (timerId !== null) {
          clearTimer(timerId);
          timerId = null;
        }
      },
    };
  }

  function hasSponsoredLabel(text) {
    const normalized = String(text || '').toLowerCase();
    return SPONSORED_LABELS.some((label) => normalized.includes(label));
  }

  function installYoutubePageGuards(pageWindow = window, pageDocument = document) {
    if (!pageWindow || !pageDocument) {
      return null;
    }

    if (pageWindow.__wardDomGuards) {
      pageWindow.__wardDomGuards.ensureStyles();
      pageWindow.__wardDomGuards.scheduleTick();
      return pageWindow.__wardDomGuards;
    }

    const css = buildCss(CSS_ONLY_HIDE_SELECTORS);
    const styleId = 'ward-ad-guards';

    const ensureStyles = () => {
      if (pageDocument.getElementById(styleId)) {
        return;
      }

      const style = pageDocument.createElement('style');
      style.id = styleId;
      style.textContent = css;
      (pageDocument.head || pageDocument.documentElement).appendChild(style);
    };

    const hardClick = (element) => {
      if (!element) {
        return false;
      }

      try {
        element.click();
      } catch {}

      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true, view: pageWindow })
        );
      }

      return true;
    };

    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = pageWindow.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const hasSkipText = (element) => {
      const text = (element.innerText || element.textContent || '').toLowerCase();
      const label = (element.getAttribute('aria-label') || '').toLowerCase();
      const title = (element.getAttribute('title') || '').toLowerCase();
      return SKIP_WORDS.some((word) => text.includes(word) || label.includes(word) || title.includes(word));
    };

    const clickSkipIfAny = () => {
      let clicked = false;

      pageDocument
        .querySelectorAll(SKIP_BUTTON_SELECTORS.join(', '))
        .forEach((button) => {
          if (isVisible(button)) {
            clicked = hardClick(button) || clicked;
          }
        });

      pageDocument
        .querySelectorAll('#movie_player button, #movie_player [role="button"], #movie_player .ytp-button')
        .forEach((element) => {
          if (isVisible(element) && hasSkipText(element)) {
            clicked = hardClick(element) || clicked;
          }
        });

      pageDocument.querySelectorAll('#movie_player *').forEach((element) => {
        const text = (element.innerText || element.textContent || '').trim();
        if (!text || text.length > 60 || !isVisible(element) || !hasSkipText(element)) {
          return;
        }

        const target = element.closest('button, [role="button"], .ytp-button, [class*="skip"]') || element;
        clicked = hardClick(target) || clicked;
      });

      return clicked;
    };

    const removeSponsoredPanels = () => {
      for (const selector of SPONSORED_PANEL_SELECTORS) {
        pageDocument.querySelectorAll(selector).forEach((node) => {
          if (hasSponsoredLabel(node.innerText || node.textContent || '')) {
            node.remove();
          }
        });
      }
    };

    const removeKnownAdNodes = () => {
      for (const selector of [...WATCH_PAGE_SELECTORS, ...DISCOVERY_PAGE_SELECTORS, ...WRAPPER_REMOVAL_SELECTORS]) {
        pageDocument.querySelectorAll(selector).forEach((node) => node.remove());
      }

      removeSponsoredPanels();
    };

    const isAdShowing = () => {
      const player = pageDocument.getElementById('movie_player');
      if (!player) {
        return false;
      }

      if (player.classList.contains('ad-showing')) {
        return true;
      }

      const playerText = (player.innerText || player.textContent || '').toLowerCase();
      return hasSponsoredLabel(playerText) || SKIP_WORDS.some((word) => playerText.includes(word));
    };

    const maybeSkipPlayerAd = () => {
      const player = pageDocument.getElementById('movie_player');

      if (!player || !isAdShowing()) {
        return false;
      }

      clickSkipIfAny();

      if (typeof player.skipAd === 'function') {
        try {
          player.skipAd();
        } catch {}
      }

      return true;
    };

    const adPlaybackState = {
      active: false,
      muted: null,
      playbackRate: null,
    };

    const speedUpPlayerAd = () => {
      const player = pageDocument.getElementById('movie_player');
      const video = pageDocument.querySelector('video');

      if (!isAdShowing() || !video) {
        if (adPlaybackState.active && video) {
          if (typeof adPlaybackState.muted === 'boolean') {
            video.muted = adPlaybackState.muted;
          }

          if (typeof adPlaybackState.playbackRate === 'number') {
            video.playbackRate = adPlaybackState.playbackRate;
          }
        }

        adPlaybackState.active = false;
        adPlaybackState.muted = null;
        adPlaybackState.playbackRate = null;
        return false;
      }

      if (!adPlaybackState.active) {
        adPlaybackState.active = true;
        adPlaybackState.muted = video.muted;
        adPlaybackState.playbackRate = video.playbackRate;
      }

      video.muted = true;
      video.playbackRate = 16;
      return true;
    };

    const setAdCoverVisible = (visible) => {
      const player = pageDocument.getElementById('movie_player');
      if (!player) {
        return;
      }

      const coverId = 'ward-ad-cover';
      let cover = pageDocument.getElementById(coverId);

      if (!visible) {
        if (cover) {
          cover.remove();
        }
        return;
      }

      if (!cover) {
        if (pageWindow.getComputedStyle(player).position === 'static') {
          player.style.position = 'relative';
        }

        cover = pageDocument.createElement('div');
        cover.id = coverId;
        cover.textContent = 'Saltando anuncio...';
        cover.style.cssText = [
          'position:absolute',
          'inset:0',
          'z-index:2147483646',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'background:#000',
          'color:#f4f4f4',
          'font:600 18px/1.4 Arial,sans-serif',
          'pointer-events:none',
        ].join(';');
        player.appendChild(cover);
      }
    };

    let adPoller = null;

    const scheduler = createTickScheduler(
      () => {
        ensureStyles();
        removeKnownAdNodes();
        clickSkipIfAny();

        const skippedPlayerAd = maybeSkipPlayerAd();
        const spedUpPlayerAd = speedUpPlayerAd();
        const handlingPlayerAd = skippedPlayerAd || spedUpPlayerAd || isAdShowing();
        setAdCoverVisible(handlingPlayerAd);

        if (handlingPlayerAd) {
          if (adPoller === null) {
            adPoller = pageWindow.setInterval(() => {
              scheduler.schedule();
            }, 100);
          }

          return;
        }

        if (adPoller !== null) {
          pageWindow.clearInterval(adPoller);
          adPoller = null;
        }
        setAdCoverVisible(false);
      },
      {
        delay: 80,
        setTimer: pageWindow.setTimeout.bind(pageWindow),
        clearTimer: pageWindow.clearTimeout.bind(pageWindow),
      }
    );

    const observer = new MutationObserver(() => {
      scheduler.schedule();
    });

    const armObserver = () => {
      if (pageDocument.documentElement) {
        observer.observe(pageDocument.documentElement, { childList: true, subtree: true });
        return;
      }

      pageWindow.setTimeout(armObserver, 10);
    };

    pageDocument.addEventListener('yt-navigate-finish', () => scheduler.schedule(), true);
    pageWindow.addEventListener('load', () => scheduler.schedule(), true);

    ensureStyles();
    armObserver();
    scheduler.schedule();

    pageWindow.__wardInstallYoutubeGuards = () => {
      ensureStyles();
      scheduler.schedule();
      return pageWindow.__wardDomGuards;
    };

    pageWindow.__wardDomGuards = {
      ensureStyles,
      scheduleTick() {
        scheduler.schedule();
      },
    };

    return pageWindow.__wardInstallYoutubeGuards();
  }

  function buildFallbackInjectionScript() {
    return `
      (() => {
        const selectors = ${JSON.stringify(CSS_ONLY_HIDE_SELECTORS)};
        const sponsoredSelectors = ${JSON.stringify(SPONSORED_PANEL_SELECTORS)};
        const sponsoredLabels = ${JSON.stringify(SPONSORED_LABELS)};
        const skipWords = ${JSON.stringify(SKIP_WORDS)};
        const css = ${JSON.stringify(buildCss(CSS_ONLY_HIDE_SELECTORS))};
        const styleId = 'ward-ad-guards-fallback';

        const ensureStyles = () => {
          if (document.getElementById(styleId)) return;
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        };

        const hasSponsoredLabel = (text) => {
          const normalized = String(text || '').toLowerCase();
          return sponsoredLabels.some((label) => normalized.includes(label));
        };

        const hardClick = (element) => {
          if (!element) return false;
          try { element.click(); } catch {}
          for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
            element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
          }
          return true;
        };

        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };

        const hasSkipText = (element) => {
          const text = (element.innerText || element.textContent || '').toLowerCase();
          const label = (element.getAttribute('aria-label') || '').toLowerCase();
          const title = (element.getAttribute('title') || '').toLowerCase();
          return skipWords.some((word) => text.includes(word) || label.includes(word) || title.includes(word));
        };

        const clickSkipIfAny = () => {
          document
            .querySelectorAll(${JSON.stringify(SKIP_BUTTON_SELECTORS.join(', '))})
            .forEach((element) => {
              if (isVisible(element)) hardClick(element);
            });

          document.querySelectorAll('#movie_player button, #movie_player [role="button"], #movie_player .ytp-button').forEach((element) => {
            if (isVisible(element) && hasSkipText(element)) hardClick(element);
          });

          document.querySelectorAll('#movie_player *').forEach((element) => {
            const text = (element.innerText || element.textContent || '').trim();
            if (!text || text.length > 60 || !isVisible(element) || !hasSkipText(element)) return;
            const target = element.closest('button, [role="button"], .ytp-button, [class*="skip"]') || element;
            hardClick(target);
          });
        };

        const adPlaybackState = { active: false, muted: null, playbackRate: null };

        const isAdShowing = () => {
          const player = document.getElementById('movie_player');
          if (!player) return false;
          if (player.classList.contains('ad-showing')) return true;
          const playerText = (player.innerText || player.textContent || '').toLowerCase();
          return hasSponsoredLabel(playerText) || skipWords.some((word) => playerText.includes(word));
        };

        const speedUpPlayerAd = () => {
          const video = document.querySelector('video');

          if (!isAdShowing() || !video) {
            if (adPlaybackState.active && video) {
              if (typeof adPlaybackState.muted === 'boolean') video.muted = adPlaybackState.muted;
              if (typeof adPlaybackState.playbackRate === 'number') video.playbackRate = adPlaybackState.playbackRate;
            }
            adPlaybackState.active = false;
            adPlaybackState.muted = null;
            adPlaybackState.playbackRate = null;
            return false;
          }

          if (!adPlaybackState.active) {
            adPlaybackState.active = true;
            adPlaybackState.muted = video.muted;
            adPlaybackState.playbackRate = video.playbackRate;
          }

          video.muted = true;
          video.playbackRate = 16;
          return true;
        };

        const setAdCoverVisible = (visible) => {
          const player = document.getElementById('movie_player');
          if (!player) return;

          const coverId = 'ward-ad-cover';
          let cover = document.getElementById(coverId);

          if (!visible) {
            if (cover) cover.remove();
            return;
          }

          if (!cover) {
            if (window.getComputedStyle(player).position === 'static') {
              player.style.position = 'relative';
            }

            cover = document.createElement('div');
            cover.id = coverId;
            cover.textContent = 'Saltando anuncio...';
            cover.style.cssText = [
              'position:absolute',
              'inset:0',
              'z-index:2147483646',
              'display:flex',
              'align-items:center',
              'justify-content:center',
              'background:#000',
              'color:#f4f4f4',
              'font:600 18px/1.4 Arial,sans-serif',
              'pointer-events:none',
            ].join(';');
            player.appendChild(cover);
          }
        };

        const tick = () => {
          ensureStyles();
          for (const selector of selectors) {
            document.querySelectorAll(selector).forEach((node) => node.remove());
          }
          for (const selector of sponsoredSelectors) {
            document.querySelectorAll(selector).forEach((node) => {
              if (hasSponsoredLabel(node.innerText || node.textContent || '')) node.remove();
            });
          }
          const player = document.getElementById('movie_player');
          if (player && isAdShowing() && typeof player.skipAd === 'function') {
            try { player.skipAd(); } catch {}
          }
          const handlingPlayerAd = speedUpPlayerAd() || isAdShowing();
          setAdCoverVisible(handlingPlayerAd);
          clickSkipIfAny();
        };

        if (!window.__wardFallbackGuards) {
          window.__wardFallbackGuards = true;
          new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
          document.addEventListener('yt-navigate-finish', tick, true);
          setInterval(tick, 100);
        }
        tick();
        return true;
      })();
    `;
  }

  function injectYoutubeDomGuards(webview) {
    const css = buildCss(CSS_ONLY_HIDE_SELECTORS);

    webview.insertCSS(css).catch((error) => {
      console.error('[WardAds] insertCSS error:', error);
    });

    webview
      .executeJavaScript(buildFallbackInjectionScript())
      .catch((error) => {
        console.error('[WardAds] executeJavaScript fallback error:', error);
      });

  }

  return {
    CSS_ONLY_HIDE_SELECTORS,
    DISCOVERY_PAGE_SELECTORS,
    WATCH_PAGE_SELECTORS,
    WRAPPER_REMOVAL_SELECTORS,
    SKIP_BUTTON_SELECTORS,
    buildCss,
    createTickScheduler,
    injectYoutubeDomGuards,
    installYoutubePageGuards,
  };
});
