// Facts about a design, read from what it actually renders (not from its description): the font families it
// loads and the colours its CSS uses most. Compare shows these side by side; a mix brief quotes them.

const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function expand(hex) {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

export function designTraits(html) {
  const fontUrls = [...html.matchAll(/fonts\.googleapis\.com\/css2\?([^"']+)/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const fonts = [...new Set(fontUrls.flatMap((q) => [...q.matchAll(/family=([^:&]+)/g)].map((m) => decodeURIComponent(m[1].replace(/\+/g, ' ')))))].slice(0, 4);
  // Only the page's own CSS (the first <style>), not the badge; count each colour once per rule-ish occurrence.
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const counts = new Map();
  for (const m of css.matchAll(HEX)) {
    const c = expand(m[0]);
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const colors = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 6);
  return { fonts, colors };
}
