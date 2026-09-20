// ============================================================
// color-math.js — CIEDE2000 in Lab space. No dependencies.
// Same formulas as the Python extraction script, so results
// match whichever direction you compute in.
// ============================================================
function rgbToXyz(r, g, b) {
  const [rl, gl, bl] = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
  ].map(v => v * 100);
}
function xyzToLab(x, y, z) {
  const Xn = 95.0489, Yn = 100.0, Zn = 108.8840;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function rgbToLab(r, g, b) { const [x, y, z] = rgbToXyz(r, g, b); return xyzToLab(x, y, z); }

function labToXyz(L, a, b) {
  const Xn = 95.0489, Yn = 100.0, Zn = 108.8840;
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const fInv = t => (Math.pow(t, 3) > 0.008856 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787);
  return [fInv(fx) * Xn, fInv(fy) * Yn, fInv(fz) * Zn];
}
function xyzToRgb(x, y, z) {
  x /= 100; y /= 100; z /= 100;
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return [r, g, b].map(v => {
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  });
}
function labToRgb(L, a, b) { const [x, y, z] = labToXyz(L, a, b); return xyzToRgb(x, y, z); }

function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const deg = r => (r * 180) / Math.PI, rad = d => (d * Math.PI) / 180;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1), C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
  let h1p = Math.atan2(b1, a1p); if (h1p < 0) h1p += 2 * Math.PI; h1p = deg(h1p);
  let h2p = Math.atan2(b2, a2p); if (h2p < 0) h2p += 2 * Math.PI; h2p = deg(h2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);
  const Lbarp = (L1 + L2) / 2, Cbarp = (C1p + C2p) / 2;
  let hbarp;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbarp - 30)) + 0.24 * Math.cos(rad(2 * hbarp))
              + 0.32 * Math.cos(rad(3 * hbarp + 6)) - 0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp, Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
}
