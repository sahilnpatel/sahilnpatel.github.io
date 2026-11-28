/* Render the AI policy feed on the homepage and policy page. */
(async () => {
  const path = location.pathname;
  const home = path.endsWith('/') || path.endsWith('/index.html');
  const main = document.getElementById('main');
  if (!main || (!home && !path.endsWith('/ai-policy.html'))) return;
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
  const feedStatus = el('p', '', 'sr-only');
  feedStatus.id = 'reading-feed-status';
  feedStatus.setAttribute('role', 'status');
  main.prepend(feedStatus);
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
  try {
    const response = await fetch('reading-ai-policy.json', { cache: 'no-cache' });
    if (!response.ok) return;
    const data = await response.json();
    if (!main.isConnected || location.pathname !== path || !Array.isArray(data.entries)) return;
    const entries = data.entries.filter(e => typeof e.id === 'string' && typeof e.title === 'string' && typeof e.summary === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Array.isArray(e.sources) && e.sources.some(s => safeUrl(s.url))).sort((a,b) => b.date.localeCompare(a.date));
    if (!entries.length) return;
    if (home) {
      const preview = main.querySelector('#home-policy-preview');
      if (!preview) return;
      const latest = entries[0];
      preview.querySelector('.post-meta').textContent = 'AI SAFETY & POLICY · ' + latest.date;
      preview.querySelector('h3 a').textContent = latest.title;
      preview.querySelector('p:not(.post-meta)').textContent = latest.summary.length > 180 ? latest.summary.slice(0,177).trimEnd() + '…' : latest.summary;
      return;
    }
    const section = el('section', null, 'prose daily-entries');
    section.setAttribute('aria-label', 'AI safety and policy readings');
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const article = el('article', null, 'post-preview');
      article.append(el('p', `${entry.date} · AI SAFETY & POLICY`, 'post-meta'), el('h2', entry.title));
      if (typeof entry.quote === 'string' && entry.quote) { const quote = el('blockquote'); quote.append(el('p', `“${entry.quote}”`)); if (typeof entry.attribution === 'string' && entry.attribution) quote.append(el('cite', entry.attribution)); article.append(quote); }
      article.append(el('p', entry.summary));
      if (typeof entry.question === 'string' && entry.question) article.append(el('p', `A question: ${entry.question}`));
      for (const source of entry.sources) { const url = safeUrl(source.url); if (!url) continue; const link = el('a', (source.title || 'Original source') + ' ↗', 'read-more'); link.href = url; article.append(el('div')); article.lastChild.append(link); }
      fragment.append(article);
    }
    section.append(fragment);
    feedStatus.textContent = 'Recent reading notes updated.';
    main.querySelector('.daily-entries')?.remove();
    main.querySelector('.page-heading')?.after(section);
  } catch {}
})();
