(() => {
  const initPageFeatures = () => {
    const photoDialog = document.querySelector('.photo-dialog');
    if (photoDialog && !photoDialog.dataset.bound) {
      photoDialog.dataset.bound = 'true';
      const full = photoDialog.querySelector('.full-photo');
      document.querySelectorAll('.photo-open').forEach(link => link.addEventListener('click', event => {
        event.preventDefault();
        full.src = link.href;
        full.alt = link.querySelector('img').alt;
        photoDialog.querySelector('.photo-caption').textContent = link.dataset.caption;
        photoDialog.showModal();
      }));
      photoDialog.querySelector('.photo-close').addEventListener('click', () => photoDialog.close());
      photoDialog.addEventListener('click', event => {
        if (event.target === photoDialog) {
          const rect = photoDialog.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) photoDialog.close();
        }
      });
    }
  };

  const mountSoundtrack = () => {
    if (document.getElementById('site-soundtrack')) return;
    const dock = document.createElement('aside');
    dock.id = 'site-soundtrack';
    dock.className = 'site-soundtrack';
    dock.setAttribute('aria-label', 'Site soundtrack');
    dock.innerHTML = '<button class="soundtrack-toggle" type="button" aria-expanded="false" aria-controls="soundtrack-panel"><span class="soundtrack-star" aria-hidden="true">✦</span><span>soundtrack</span></button><section class="soundtrack-panel" id="soundtrack-panel" aria-label="Site soundtrack player" hidden><div class="soundtrack-heading"><div><p class="soundtrack-kicker">A LITTLE MUSIC FOR THE JOURNEY</p><p class="soundtrack-title">Les</p><p class="soundtrack-artist">Childish Gambino</p></div><button class="soundtrack-close" type="button" aria-label="Close soundtrack controls">×</button></div><div class="soundtrack-embed"></div><p class="soundtrack-caption">Press play to start. The player stays with you as you browse. · <a href="https://open.spotify.com/track/7ghKr0pCYyPPyp7t1FH8k4" target="_blank" rel="noopener noreferrer">Open in Spotify ↗</a></p></section>';
    document.body.append(dock);
    const toggle = dock.querySelector('.soundtrack-toggle');
    const panel = dock.querySelector('.soundtrack-panel');
    const close = dock.querySelector('.soundtrack-close');
    let loaded = false;
    const setOpen = open => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Hide soundtrack controls' : 'Open soundtrack player');
      if (open && !loaded) {
        const frame = document.createElement('iframe');
        frame.title = 'Spotify player for Les by Childish Gambino';
        frame.src = 'https://open.spotify.com/embed/track/7ghKr0pCYyPPyp7t1FH8k4?utm_source=generator&theme=1';
        frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        frame.setAttribute('loading', 'lazy');
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        frame.setAttribute('allowfullscreen', '');
        dock.querySelector('.soundtrack-embed').append(frame);
        loaded = true;
      }
    };
    toggle.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));
  };

  const pagePaths = new Set(['/', '/index.html', '/work.html', '/interests.html', '/hobbies.html', '/writing.html', '/philosophy.html', '/ai-policy.html', '/quotes.html']);
  let navigating = false;
  const showPage = async (address, addHistory) => {
    if (navigating) return;
    navigating = true;
    try {
      const response = await fetch(address, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Page unavailable');
      const nextDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextHeader = nextDocument.querySelector('header');
      const nextMain = nextDocument.querySelector('#main');
      const currentHeader = document.querySelector('header');
      const currentMain = document.querySelector('#main');
      if (!nextHeader || !nextMain || !currentHeader || !currentMain) throw new Error('Page layout unavailable');

      currentHeader.replaceWith(nextHeader);
      currentMain.replaceWith(nextMain);
      document.title = nextDocument.title;
      document.body.className = nextDocument.body.className;

      document.head.querySelectorAll('style[data-page-style]').forEach(style => style.remove());
      nextDocument.head.querySelectorAll('style').forEach(style => {
        const copy = style.cloneNode(true);
        copy.dataset.pageStyle = 'true';
        document.head.append(copy);
      });

      if (addHistory) history.pushState({}, '', address);
      nextMain.setAttribute('tabindex', '-1');
      nextMain.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      initPageFeatures();

      const pageScripts = ['daily-reading.js', 'interest-map.js', 'interest-field.js'];
      document.querySelectorAll('script[src]').forEach(script => {
        try {
          const pathname = new URL(script.src).pathname;
          if (pageScripts.some(file => pathname.endsWith('/' + file))) script.remove();
        } catch {}
      });
      for (const file of pageScripts) {
        const needed = Array.from(nextDocument.querySelectorAll('script[src]'))
          .some(script => {
            try { return new URL(script.src).pathname.endsWith('/' + file); } catch { return false; }
          });
        if (!needed) continue;
        const pageScript = document.createElement('script');
        pageScript.src = new URL(file, location.href).href;
        pageScript.dataset.pageScript = file;
        document.body.append(pageScript);
      }
    } catch {
      location.assign(address);
    } finally {
      navigating = false;
    }
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || !pagePaths.has(destination.pathname) || destination.pathname === location.pathname) return;
    event.preventDefault();
    showPage(destination.href, true);
  });
  window.addEventListener('popstate', () => showPage(location.href, false));

  initPageFeatures();
  mountSoundtrack();
})();