// Lightweight, dependency-free contrast sampler. `sampleContrast` is
// serialised into the page by Playwright, so it must be self-contained.

/**
 * Runs inside the browser. Walks every visible text node, resolves the
 * effective foreground/background colours (compositing translucent layers
 * over their ancestors) and returns pairs whose WCAG contrast ratio is below
 * `threshold`.
 */
export function sampleContrast(threshold) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const colorCache = new Map();

  // Converts any CSS colour (rgb, oklch, color(...)) to [r,g,b,a] via canvas.
  function toRgba(css) {
    if (colorCache.has(css)) return colorCache.get(css);
    let out = null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#010203"; // sentinel: an invalid `css` leaves it unchanged
      ctx.fillStyle = css;
      if (ctx.fillStyle !== "#010203" || css === "#010203") {
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        const a = d[3] / 255;
        out = a === 0 ? [0, 0, 0, 0] : [d[0], d[1], d[2], a];
      }
    } catch {
      out = null;
    }
    colorCache.set(css, out);
    return out;
  }

  const blend = (top, bottom) => {
    const a = top[3];
    return [
      Math.round(top[0] * a + bottom[0] * (1 - a)),
      Math.round(top[1] * a + bottom[1] * (1 - a)),
      Math.round(top[2] * a + bottom[2] * (1 - a)),
      1,
    ];
  };

  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (fg, bg) => {
    const l1 = lum(fg);
    const l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  // Background layers from the element up to the first opaque one.
  function effectiveBackground(el) {
    const layers = [];
    let node = el;
    let hasImage = false;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") hasImage = true;
      const c = toRgba(cs.backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
      node = node.parentElement;
    }
    let bg = [255, 255, 255, 1]; // canvas default when nothing is opaque
    const rootCs = getComputedStyle(document.documentElement);
    const rootBg = toRgba(rootCs.backgroundColor);
    if (!layers.length || layers[layers.length - 1][3] < 1) {
      if (rootBg && rootBg[3] >= 1) bg = rootBg;
    }
    for (let i = layers.length - 1; i >= 0; i--) bg = layers[i][3] >= 1 ? layers[i] : blend(layers[i], bg);
    return { bg, hasImage };
  }

  function effectiveOpacity(el) {
    let o = 1;
    let node = el;
    while (node && node.nodeType === 1) {
      o *= parseFloat(getComputedStyle(node).opacity || "1");
      node = node.parentElement;
    }
    return o;
  }

  function selectorFor(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node !== document.body && depth < 4) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${part}#${node.id}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
      depth++;
    }
    return parts.join(" > ");
  }

  const results = [];
  const seen = new Set();
  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "OPTION"]);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let textNode;
  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const el = textNode.parentElement;
    if (!el || skipTags.has(el.tagName) || el.closest("svg, [data-e2e-ignore]")) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility !== "visible") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (parseFloat(cs.fontSize) < 1) continue;
    const opacity = effectiveOpacity(el);
    if (opacity < 0.1) continue; // effectively hidden
    const fgRaw = toRgba(cs.color);
    if (!fgRaw) continue;
    const { bg, hasImage } = effectiveBackground(el);
    if (hasImage) continue; // cannot sample reliably
    const fg = [fgRaw[0], fgRaw[1], fgRaw[2], Math.min(1, fgRaw[3] * opacity)];
    const fgFlat = fg[3] >= 1 ? fg : blend(fg, bg);
    const r = ratio(fgFlat, bg);
    if (r >= threshold) continue;
    const classes = (el.getAttribute("class") || "").trim().slice(0, 220);
    const key = `${el.tagName}|${classes}|${hex(fgFlat)}|${hex(bg)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      classes,
      text: text.slice(0, 60),
      fg: hex(fgFlat),
      bg: hex(bg),
      ratio: Math.round(r * 100) / 100,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
    });
  }
  results.sort((a, b) => a.ratio - b.ratio);
  return results;
}
