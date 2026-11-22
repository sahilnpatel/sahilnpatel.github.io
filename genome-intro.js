(() => {
  const canvas = document.querySelector(".genome-intro");
  const title = document.querySelector(".name-title");
  if (!canvas || !title || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  const phrase = title.textContent.trim();
  const bases = ["A", "C", "T", "G"];
  const colors = ["#0d2b50", "#126dc1", "#2478bb", "#4d9bd8"];
  const navy = [13, 43, 80];
  const flightDuration = 850;
  const staggerDuration = 120;
  const blendDuration = 90;
  const holdDuration = 620;
  const bounceDelay = 100;
  const bounceDuration = 360;
  const pressDuration = 260;
  const fadeDuration = 180;

  function launch() {
    const box = title.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const width = innerWidth;
    const height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    mask.width = Math.ceil(box.width);
    mask.height = Math.ceil(box.height);
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    maskCtx.font = getComputedStyle(title).font;
    maskCtx.textBaseline = "alphabetic";
    maskCtx.fillStyle = "#fff";
    maskCtx.fillText(phrase, 0, box.height * .78);

    const sequence = document.createElement("canvas");
    sequence.width = mask.width;
    sequence.height = mask.height;
    const sequenceCtx = sequence.getContext("2d");
    sequenceCtx.font = "700 9px Helvetica, Arial, sans-serif";
    sequenceCtx.textBaseline = "alphabetic";
    let baseIndex = 0;
    for (let y = 9; y < mask.height + 8; y += 10) {
      for (let x = 0; x < mask.width; x += 7) {
        sequenceCtx.fillStyle = colors[baseIndex % colors.length];
        sequenceCtx.fillText(bases[baseIndex % bases.length], x, y);
        baseIndex++;
      }
    }
    sequenceCtx.globalCompositeOperation = "destination-in";
    sequenceCtx.drawImage(mask, 0, 0);

    const solid = document.createElement("canvas");
    solid.width = mask.width;
    solid.height = mask.height;
    const solidCtx = solid.getContext("2d");
    solidCtx.drawImage(mask, 0, 0);
    solidCtx.globalCompositeOperation = "source-in";
    solidCtx.fillStyle = "#0d2b50";
    solidCtx.fillRect(0, 0, solid.width, solid.height);

    const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
    const targets = [];
    for (let y = 2; y < mask.height; y += 3) {
      for (let x = 1; x < mask.width; x += 3) {
        if (pixels[(y * mask.width + x) * 4 + 3] > 96) targets.push({ x: box.left + x, y: box.top + y });
      }
    }
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    const points = targets.slice(0, 28);
    if (!points.length) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const particles = points.map((target, i) => {
      const angle = i / points.length * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const distance = Math.min(width / 2 / Math.abs(dx || .001), height / 2 / Math.abs(dy || .001)) + 18;
      return {
        target,
        x: centerX + dx * distance,
        y: centerY + dy * distance,
        base: bases[i % bases.length],
        color: colors[i % colors.length],
        rgb: [[18,109,193],[77,155,216],[13,43,80],[119,185,236]][i % 4],
        delay: (i / points.length) * staggerDuration
      };
    });

    const started = performance.now();
    function draw(now) {
      ctx.clearRect(0, 0, width, height);
      const elapsed = now - started;
      let active = false;

      for (const p of particles) {
        const age = elapsed - p.delay;
        if (age < 0 || age >= flightDuration + blendDuration) continue;
        active = true;
        const travel = Math.min(1, age / flightDuration);
        const eased = 1 - Math.pow(1 - travel, 4);
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const arc = Math.sin(travel * Math.PI) * 12;
        let x = p.x + dx * eased - dy / Math.max(1, Math.hypot(dx, dy)) * arc;
        let y = p.y + dy * eased + dx / Math.max(1, Math.hypot(dx, dy)) * arc;
        let alpha = Math.min(1, travel * 5);
        let size = 10;

        if (age >= flightDuration) {
          const blend = Math.min(1, (age - flightDuration) / blendDuration);
          x = p.target.x;
          y = p.target.y;
          alpha = 1 - blend;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = `600 11px Helvetica, Arial, sans-serif`;
        ctx.fillText(p.base, x, y);
      }

      const sequenceStart = flightDuration + staggerDuration;
      const pressStart = sequenceStart + blendDuration + holdDuration;
      const sequenceAge = elapsed - sequenceStart;
      if (sequenceAge >= 0 && elapsed < pressStart + pressDuration + fadeDuration) {
        active = true;
        let press = 0;
        let fade = 1;
        if (elapsed >= pressStart) {
          press = Math.min(1, (elapsed - pressStart) / pressDuration);
          press = 1 - Math.pow(1 - press, 3);
          if (elapsed > pressStart + pressDuration) {
            fade = Math.max(0, 1 - (elapsed - pressStart - pressDuration) / fadeDuration);
          }
        }
        const bounceElapsed = elapsed - sequenceStart - bounceDelay;
        const bounceActive = bounceElapsed >= 0 && bounceElapsed < bounceDuration && elapsed < pressStart;
        const bounceT = Math.max(0, Math.min(1, bounceElapsed / bounceDuration));
        const bounceArc = bounceActive ? Math.sin(Math.PI * bounceT) : 0;
        const bounceY = -6 * bounceArc;
        const bounceScale = 1 + .035 * bounceArc;
        const glow = bounceActive ? Math.sin(Math.PI * bounceT) : 0;
        const scaleUp = 1 + .07 * press + (1 - press) * (bounceScale - 1);
        const down = 5 * press + (1 - press) * bounceY;
        ctx.save();
        ctx.translate(box.left + box.width / 2, box.top + box.height / 2 + down);
        ctx.scale(scaleUp, scaleUp);
        ctx.shadowColor = "rgba(36,120,187," + (.62 * glow) + ")";
        ctx.shadowBlur = 13 * glow;
        ctx.globalAlpha = (1 - press) * fade;
        ctx.drawImage(sequence, -box.width / 2, -box.height / 2, box.width, box.height);
        ctx.globalAlpha = press * fade;
        ctx.drawImage(solid, -box.width / 2, -box.height / 2, box.width, box.height);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      if (active) requestAnimationFrame(draw);
      else {
        ctx.clearRect(0, 0, width, height);
        canvas.remove();
      }
    }
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(launch);
})();