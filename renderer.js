const HOME_URL = 'https://www.youtube.com/';

const webview = document.getElementById('youtubeView');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const homeBtn = document.getElementById('homeBtn');
const reloadBtn = document.getElementById('reloadBtn');

let loadFailRetries = 0;

function applyDomGuards() {
  const guards = window.WardYoutubeDomGuards;
  if (!guards || typeof guards.injectYoutubeDomGuards !== 'function') {
    console.error('[WardAds] injectYoutubeDomGuards no esta disponible');
    return;
  }

  guards.injectYoutubeDomGuards(webview);
}

function updateNavState() {
  backBtn.disabled = !webview.canGoBack();
  forwardBtn.disabled = !webview.canGoForward();
}

backBtn.addEventListener('click', () => {
  if (webview.canGoBack()) {
    webview.goBack();
  }
});

forwardBtn.addEventListener('click', () => {
  if (webview.canGoForward()) {
    webview.goForward();
  }
});

homeBtn.addEventListener('click', () => {
  webview.loadURL(HOME_URL);
});

reloadBtn.addEventListener('click', () => {
  webview.reload();
});

webview.addEventListener('did-navigate', updateNavState);
webview.addEventListener('did-navigate-in-page', updateNavState);

webview.addEventListener('did-fail-load', (event) => {
  if (event.isMainFrame === false) {
    return;
  }

  if (loadFailRetries >= 5) {
    return;
  }

  loadFailRetries += 1;
  const delay = 250 * loadFailRetries;
  console.warn('[Ward] Fallo al cargar guest, reintento', loadFailRetries, event.errorCode);
  setTimeout(() => webview.loadURL(HOME_URL), delay);
});

webview.addEventListener('did-finish-load', () => {
  loadFailRetries = 0;
});

webview.addEventListener('dom-ready', () => {
  updateNavState();
  applyDomGuards();
});

webview.addEventListener('did-stop-loading', applyDomGuards);

window.addEventListener('keydown', (event) => {
  if (event.altKey && event.key === 'ArrowLeft') {
    event.preventDefault();
    if (webview.canGoBack()) {
      webview.goBack();
    }
  }

  if (event.altKey && event.key === 'ArrowRight') {
    event.preventDefault();
    if (webview.canGoForward()) {
      webview.goForward();
    }
  }

  if (event.altKey && event.key === 'Home') {
    event.preventDefault();
    webview.loadURL(HOME_URL);
  }
});
