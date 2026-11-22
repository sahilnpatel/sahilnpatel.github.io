(() => {
  const title = document.querySelector('.name-title');
  const canvas = document.querySelector('.genome-intro');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!title || !canvas || motion.matches || scrollY > 20) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Each path follows the pen stroke of a letter. Separate strokes leave
  // the counters in a, e and P open even on a narrow screen.
  const strokes = {
    S: ['M85 16 C62 -3 13 1 13 28 C13 52 85 47 85 73 C85 99 38 108 10 86'],
    a: ['M76 50 C59 32 13 38 13 70 C13 99 53 107 76 77', 'M79 41 L79 98'],
    h: ['M16 3 L16 98', 'M16 65 C34 32 78 30 78 59 L78 98'],
    i: ['M48 43 L48 98', 'M48 17 L48 18'],
    l: ['M42 3 L42 98'],
    P: ['M17 98 L17 5 L49 5 C101 5 101 54 52 54 L18 54'],
    t: ['M46 17 L46 81 Q46 104 81 95', 'M13 42 L80 42'],
    e: ['M16 69 L83 64 C83 28 15 29 15 69 C15 101 53 108 82 87'],
    '.': ['M46 96 L46 97']
  };
  const textNode = title.firstChild;
  const range = document.createRange();
  const bounds = title.getBoundingClientRect();
  if (!textNode || !bounds.width || bounds.bottom < 0) return;
  const width = innerWidth, height = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  const style = getComputedStyle(title);
  ctx.font = style.fontSize + ' ' + style.fontFamily;
  const metrics = ctx.measureText('H');
  const cap = metrics.actualBoundingBoxAscent || parseFloat(style.fontSize) * .72;
  const probe = document.createElement('i');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  title.append(probe);
  const baseline = probe.getBoundingClientRect().top;
  probe.remove();
  const size = Math.max(4.7, Math.min(7, cap * .115));
  const spacing = size * 1.04;
  const points = [];
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  function addLetter(letter, box) {
    for (const stroke of strokes[letter] || []) {
      path.setAttribute('d', stroke);
      const length = path.getTotalLength();
      const samples = [];
      let distance = 0;
      for (let s = 0; s <= Math.ceil(length); s++) {
        const p = path.getPointAtLength(Math.min(s, length));
        const x = box.left + p.x * box.width / 100;
        const y = baseline - cap + p.y * cap / 100;
        if (samples.length) distance += Math.hypot(x - samples.at(-1).x, y - samples.at(-1).y);
        samples.push({x, y, distance});
      }
      const intervals = Math.max(1, Math.round(distance / spacing));
      let j = 0;
      for (let i = 0; i <= intervals; i++) {
        while (j + 1 < samples.length && samples[j].distance < i * distance / intervals) j++;
        const p = samples[j];
        if (points.every(q => Math.hypot(q.x - p.x, q.y - p.y) > spacing * .75)) points.push(p);
      }
    }
  }
  for (let i = 0; i < textNode.length; i++) {
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    addLetter(textNode.data[i], range.getBoundingClientRect());
  }
  const dot = title.querySelector('span');
  if (dot) addLetter('.', dot.getBoundingClientRect());
  if (!points.length) return;

  const cx = bounds.left + bounds.width / 2, cy = baseline - cap / 2;
  const nameScale = Math.max(1, Math.min(1.16, (width - bounds.left - 10) / bounds.width));
  const flightDuration = 880;
  const particles = points.map((p, i) => {
    const angle = i * 2.39996;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const reach = Math.min((dx > 0 ? width - cx : -cx) / (dx || .001),
      (dy > 0 ? height - cy : -cy) / (dy || .001)) + 12;
    return {...p, startX:cx + dx * reach, startY:cy + dy * reach,
      bend:Math.sin(i * 1.73) * 38, delay:210 + (i * 47 % 390),
      base:'ACTG'[i % 4]};
  });
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => n * n * (3 - 2 * n);
  const lastLanding = Math.max(...particles.map(p => p.delay)) + flightDuration;
  const glowStart = lastLanding + 1250;
  const revealStart = glowStart + 390;
  const end = revealStart + 340;
  const start = performance.now();
  function finish() {
    title.style.removeProperty('opacity');
    canvas.remove();
  }
  function frame(now) {
    const t = now - start;
    if (t >= end || motion.matches || !title.isConnected || scrollY > 20 ||
        innerWidth !== width || Math.abs(title.getBoundingClientRect().width - bounds.width) > 1) {
      finish();
      return;
    }
    ctx.clearRect(0, 0, width, height);
    const halo = clamp(t / 170) * (1 - smooth(clamp((t - 650) / 760)));
    if (halo > 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bounds.width * .57, cap * .95);
      const light = ctx.createRadialGradient(0, 0, .25, 0, 0, 1.12);
      light.addColorStop(0, 'rgba(155,215,255,0)');
      light.addColorStop(.7, 'rgba(139,207,255,.28)');
      light.addColorStop(1, 'rgba(155,215,255,0)');
      ctx.globalAlpha = halo;
      ctx.fillStyle = light;
      ctx.fillRect(-1.13, -1.13, 2.26, 2.26);
      ctx.restore();
    }
    const bounce = Math.sin(Math.PI * clamp((t - glowStart) / 390)) ** 2;
    const reveal = smooth(clamp((t - revealStart) / 340));
    title.style.opacity = String(.09 * (1 - smooth(clamp((t - 430) / 620))) + reveal);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = 1 + (nameScale - 1) * (1 - reveal);
    ctx.font = '600 ' + size * scale + 'px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#286ba0';
    ctx.shadowColor = '#87cbff';
    ctx.shadowBlur = 4 * bounce;
    for (const p of particles) {
      const u = clamp((t - p.delay) / flightDuration);
      if (!u) continue;
      const remaining = (1 - u) ** 3;
      const arc = remaining * u * 5;
      ctx.globalAlpha = smooth(clamp(u * 3)) * (1 - reveal);
      const targetX = bounds.left + (p.x - bounds.left) * scale;
      const targetY = cy + (p.y - cy) * scale;
      ctx.fillText(p.base, targetX + (p.startX - targetX) * remaining + p.bend * arc,
        targetY + (p.startY - targetY) * remaining - 35 * arc + 4 * bounce);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();