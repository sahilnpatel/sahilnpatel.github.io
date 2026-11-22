(() => {
  const canvas = document.querySelector(".genome-intro");
  const title = document.querySelector(".name-title");
  if (!canvas || !title || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  const bases = ["A", "C", "T", "G"];
  const baseColors = ["#4d9bd8", "#62ade4", "#338ccf", "#6eb8eb"];
  const navy = "#0d2b50";
  const lightBlue = "rgba(132,202,255,";
  const flowDuration = 560;
  const particleDelay = 100;
  const flightDuration = 850;
  const staggerDuration = 100;
  const blendDuration = 100;
  const holdDuration = 620;
  const bounceDelay = 80;
  const bounceDuration = 360;
  const pressDuration = 300;
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
    maskCtx.fillText(title.textContent.trim(), 0, box.height * .78);
    const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;

    const sequence = document.createElement("canvas");
    sequence.width = mask.width;
    sequence.height = mask.height;
    const sequenceCtx = sequence.getContext("2d");
    sequenceCtx.textAlign = "center";
    sequenceCtx.textBaseline = "middle";
    let placed = 0;
    let attempts = 0;
    while (placed < 145 && attempts < 6000) {
      attempts++;
      const x = 5 + Math.random() * Math.max(1, mask.width - 10);
      const y = 5 + Math.random() * Math.max(1, mask.height - 10);
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (pixels[(py * mask.width + px) * 4 + 3] < 190) continue;
      const size = 8 + Math.random() * 2;
      sequenceCtx.save();
      sequenceCtx.translate(x, y);
      sequenceCtx.rotate((Math.random() - .5) * .18);
      sequenceCtx.globalAlpha = .88;
      sequenceCtx.font = "700 " + size + "px Helvetica, Arial, sans-serif";
      sequenceCtx.fillStyle = baseColors[placed % baseColors.length];
      sequenceCtx.fillText(bases[placed % bases.length], 0, 0);
      sequenceCtx.restore();
      placed++;
    }
    sequenceCtx.globalCompositeOperation = "destination-in";
    sequenceCtx.drawImage(mask, 0, 0);

    const solid = document.createElement("canvas");
    solid.width = mask.width;
    solid.height = mask.height;
    const solidCtx = solid.getContext("2d");
    solidCtx.drawImage(mask, 0, 0);
    solidCtx.globalCompositeOperation = "source-in";
    solidCtx.fillStyle = navy;
    solidCtx.fillRect(0, 0, solid.width, solid.height);

    const candidates = [];
    for (let y = 2; y < mask.height; y += 3) {
      for (let x = 2; x < mask.width; x += 3) {
        if (pixels[(y * mask.width + x) * 4 + 3] > 180) candidates.push({ x: box.left + x, y: box.top + y });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const targets = candidates.slice(0, 36);
    if (!targets.length) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const particles = targets.map((target, i) => {
      const angle = i / targets.length * Math.PI * 2 + (Math.random() - .5) * .08;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const distance = Math.min(width / 2 / Math.abs(dx || .001), height / 2 / Math.abs(dy || .001)) + 26;
      return {
        target,
        x: centerX + dx * distance,
        y: centerY + dy * distance,
        base: bases[i % bases.length],
        color: baseColors[i % baseColors.length],
        rotation: (Math.random() - .5) * .72,
        delay: particleDelay + i / targets.length * staggerDuration
      };
    });

    const sequenceStart = particleDelay + flightDuration + staggerDuration;
    const pressStart = sequenceStart + blendDuration + holdDuration;
    const endAt = pressStart + pressDuration + fadeDuration;
    const started = performance.now();

    function draw(now) {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);

      const flowProgress = Math.min(1, elapsed / flowDuration);
      const flowOpacity = .78 * Math.max(0, 1 - Math.max(0, elapsed - flowDuration + 70) / 250);
      if (flowProgress > 0 && flowOpacity > 0) {
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const rx = box.width / 2 + 24;
        const ry = box.height / 2 + 15;
        const start = -Math.PI / 2;
        const gradient = ctx.createLinearGradient(box.left, box.top, box.right, box.bottom);
        gradient.addColorStop(0, "rgba(132,202,255,.18)");
        gradient.addColorStop(.42, "rgba(116,190,248,.95)");
        gradient.addColorStop(.72, "rgba(181,225,255,.92)");
        gradient.addColorStop(1, "rgba(132,202,255,.12)");
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, start, start + Math.PI * 2 * flowProgress);
        ctx.globalAlpha = flowOpacity;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.7;
        ctx.shadowColor = "#9ed5ff";
        ctx.shadowBlur = 11;
        ctx.stroke();
        ctx.restore();
      }

      for (const p of particles) {
        const age = elapsed - p.delay;
        if (age < 0 || elapsed >= sequenceStart + blendDuration) continue;
        let x, y, rotation, alpha;
        if (age < flightDuration) {
          const t = Math.max(0, Math.min(1, age / flightDuration));
          const eased = 1 - Math.pow(1 - t, 3);
          const dx = p.target.x - p.x;
          const dy = p.target.y - p.y;
          const curve = Math.sin(Math.PI * t) * 9;
          const distance = Math.max(1, Math.hypot(dx, dy));
          x = p.x + dx * eased - dy / distance * curve;
          y = p.y + dy * eased + dx / distance * curve;
          rotation = p.rotation * (1 - eased);
          alpha = .16 + .74 * Math.min(1, t * 2.4);
        } else {
          x = p.target.x;
          y = p.target.y;
          rotation = 0;
          alpha = 1 - Math.min(1, (elapsed - sequenceStart) / blendDuration);
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = "600 12px Helvetica, Arial, sans-serif";
        ctx.fillText(p.base, 0, 0);
        ctx.restore();
      }

      if (elapsed >= sequenceStart && elapsed < endAt) {
        let press = 0;
        let fade = 1;
        if (elapsed >= pressStart) {
          const p = Math.min(1, (elapsed - pressStart) / pressDuration);
          press = 1 - Math.pow(1 - p, 3);
          if (elapsed > pressStart + pressDuration) {
            fade = Math.max(0, 1 - (elapsed - pressStart - pressDuration) / fadeDuration);
          }
        }

        const bounceElapsed = elapsed - sequenceStart - blendDuration - bounceDelay;
        const bounceActive = bounceElapsed >= 0 && bounceElapsed < bounceDuration && elapsed < pressStart;
        const bounceT = Math.max(0, Math.min(1, bounceElapsed / bounceDuration));
        const bounce = bounceActive ? Math.sin(Math.PI * bounceT) : 0;
        const yShift = 9 * bounce * (1 - press) + 5 * press;
        const xScale = 1 + .025 * bounce * (1 - press) + .06 * press;
        const yScale = 1 - .035 * bounce * (1 - press) + .06 * press;
        const glow = bounceActive ? Math.sin(Math.PI * bounceT) : 0;

        ctx.save();
        ctx.translate(box.left + box.width / 2, box.top + box.height / 2 + yShift);
        ctx.scale(xScale, yScale);
        ctx.shadowColor = lightBlue + (.9 * glow) + ")";
        ctx.shadowBlur = 17 * glow;
        ctx.globalAlpha = (1 - press) * fade;
        ctx.drawImage(sequence, -box.width / 2, -box.height / 2, box.width, box.height);
        ctx.globalAlpha = press * fade;
        ctx.drawImage(solid, -box.width / 2, -box.height / 2, box.width, box.height);
        ctx.restore();
      }

      if (elapsed < endAt) requestAnimationFrame(draw);
      else {
        ctx.clearRect(0, 0, width, height);
        canvas.remove();
      }
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(launch);
})();