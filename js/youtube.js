// YouTube helpers: read links, load the player API, make players.

let apiPromise = null;

/** Loads the YouTube IFrame API once. Rejects if offline or blocked. */
export function loadYouTubeApi(timeoutMs = 10000) {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube could not be reached.'));
    document.head.append(script);
    setTimeout(() => reject(new Error('YouTube took too long to load.')), timeoutMs);
  });

  // Let a later call try again if this one failed.
  apiPromise.catch(() => {
    apiPromise = null;
  });
  return apiPromise;
}

function parseTime(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = String(t).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

/** Pulls the video ID (and start time, if any) out of any common YouTube link. */
export function parseYouTube(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (/^[\w-]{11}$/.test(str)) return { id: str, start: 0 };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(str) ? str : `https://${str}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  return { id, start: parseTime(url.searchParams.get('t') || url.searchParams.get('start')) };
}

export function thumbnailUrl(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Creates a YT.Player inside `mountEl` (which gets replaced by the iframe). */
export function createPlayer(mountEl, { videoId, start = 0, controls = true, events = {} }) {
  return new window.YT.Player(mountEl, {
    host: 'https://www.youtube-nocookie.com',
    videoId,
    width: '100%',
    height: '100%',
    playerVars: {
      start: Math.floor(start) || undefined,
      controls: controls ? 1 : 0,
      disablekb: controls ? 0 : 1,
      fs: controls ? 1 : 0,
      rel: 0,
      iv_load_policy: 3,
      playsinline: 1,
      origin: window.location.origin,
    },
    events,
  });
}
