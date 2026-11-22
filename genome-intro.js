(() => {
  const canvas = document.querySelector(".genome-intro");
  const title = document.querySelector(".name-title");
  if (!canvas || !title || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  const phrase = title.textContent.trim();
  const colors = ["#126dc1", "#4d9bd8", "#0d2b50", "#77b9ec"];
  const bases = ["A", "C", "T", "G"];
  const flightDuration = 760;
  const pressDuration = 190;
  const fadeDuration = 180;
  const navy = [13, 43, 80];
  let frameId;

  function launch() {
    const box = title.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    mask.width = Math.ceil(box.width);
    mask.height = Math.ceil(box.height);
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    const style = getComputedStyle(title);
    maskCtx.font = style.font;
    maskCtx.textBaseline = "alphabetic";
    maskCtx.fillStyle = "#fff";
    maskCtx.fillText(phrase, 0, box.height * .78);

    const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
    const targets = [];
    for (let y = 2; y < mask.height; y += 3) {
      for (let x = 1; x < mask.width; x += 3) {
        if (pixels[(y * mask.width + x) * 4 + 3] > 96) {
          targets.push({ x: box.left + x, y: box.top + y });
        }
      }
    }
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    const points = targets.slice(0, 115);
    if (!points.length) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const particles = points.map((target, i) => {
      const angle = i / points.length * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const edgeX = Math.abs(dx) < .001 ? Infinity : width / 2 / Math.abs(dx);
      const edgeY = Math.abs(dy) < .001 ? Infinity : height / 2 / Math.abs(dy);
      const distance = Math.min(edgeX, edgeY) + 18;
      return {
        target,
        x: centerX + dx * distance,
        y: centerY + dy * distance,
        base: bases[i % bases.length],
        color: colors[i % colors.length],
        rgb: [[18,109,193],[77,155,216],[13,43,80],[119,185,236]][i % 4],
        delay: (i % 9) * 10
      };
    });

    const started = performance.now();
    function draw(now) {
      ctx.clearRect(0, 0, width, height);
      let active = false;
      for (const p of particles) {
        const age = now - started - p.delay;
        if (age < 0 || age >= flightDuration + pressDuration + fadeDuration) continue;
        active = true;
        const travel = Math.max(0, Math.min(1, age / flightDuration));
        const eased = 1 - Math.pow(1 - travel, 4);
        const arc = Math.sin(travel * Math.PI) * 12;
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        let x = p.x + dx * eased - dy / Math.max(1, Math.hypot(dx, dy)) * arc;
        let y = p.y + dy * eased + dx / Math.max(1, Math.hypot(dx, dy)) * arc;
        let alpha = Math.min(1, travel * 5);
        let size = 8;
        let color = p.color;
        if (age > flightDuration) {
          const press = Math.min(1, (age - flightDuration) / pressDuration);
          const pressed = 1 - Math.pow(1 - press, 3);
          x = p.target.x;
          y = p.target.y + 5 * pressed;
          size = 8 + 5 * pressed;
          const rgb = p.rgb.map((channel, index) => Math.round(channel + (navy[index] - channel) * pressed));
          color = `rgb(${rgb.join(",")})`;
          if (age > flightDuration + pressDuration) {
            alpha = Math.max(0, 1 - (age - flightDuration - pressDuration) / fadeDuration);
          }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.font = `600 ${size}px Helvetica, Arial, sans-serif`;
        ctx.fillText(p.base, x, y);
      }
      ctx.globalAlpha = 1;
      if (active) frameId = requestAnimationFrame(draw);
      else {
        ctx.clearRect(0, 0, width, height);
        canvas.remove();
      }
    }
    frameId = requestAnimationFrame(draw);
  }

  requestAnimationFrame(launch);
})();