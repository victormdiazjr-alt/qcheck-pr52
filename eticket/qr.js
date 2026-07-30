/* ============================================================
   qr.js — Codificador QR mínimo, JavaScript puro.
   Sin librerías, sin CDN, sin internet. ~10 KB.

   Alcance: modo BYTE (ISO-8859-1 / ASCII), versiones 1–40,
   niveles de corrección L/M/Q/H, selección automática de
   versión y de máscara por penalización (regla estándar).

   Uso:
     const qr  = QR.encode("texto", { ecl: "M" });   // {size, modules}
     const svg = QR.toSVG("texto", { scale: 8, quiet: 4 });
     QR.toCanvas("texto", canvasEl, { scale: 8 });

   Referencia: ISO/IEC 18004. Las tablas de bloques y de
   codewords de corrección son las del estándar.
   ============================================================ */
"use strict";

const QR = (function () {

  /* --- tablas del estándar: codewords de corrección por bloque --- */
  const ECC_CW = {
    L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  };
  /* --- número de bloques de corrección por versión --- */
  const ECC_BLOCKS = {
    L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  };
  /* bits del nivel de corrección dentro de la información de formato */
  const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* --- capacidad --- */
  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const na = Math.floor(ver / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function totalCodewords(ver) { return Math.floor(rawDataModules(ver) / 8); }
  function dataCodewords(ver, ecl) {
    return totalCodewords(ver) - ECC_CW[ecl][ver] * ECC_BLOCKS[ecl][ver];
  }

  /* --- GF(256), polinomio primitivo 0x11D --- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gfMul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* generador = Π (x − α^i), i = 0..deg−1 ; coeficientes de mayor a menor grado */
  const GEN_CACHE = {};
  function rsGenerator(deg) {
    if (GEN_CACHE[deg]) return GEN_CACHE[deg];
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const p = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        p[j] ^= poly[j];                        // × x
        p[j + 1] ^= gfMul(poly[j], EXP[i]);     // × α^i
      }
      poly = p;
    }
    return (GEN_CACHE[deg] = poly);
  }
  function rsRemainder(data, deg) {
    const gen = rsGenerator(deg);
    const rem = new Uint8Array(deg);
    for (const b of data) {
      const factor = b ^ rem[0];
      rem.copyWithin(0, 1); rem[deg - 1] = 0;
      for (let i = 0; i < deg; i++) rem[i] ^= gfMul(gen[i + 1], factor);
    }
    return rem;
  }

  /* --- flujo de bits --- */
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.push = function (val, len) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  };

  /* --- texto → bytes (UTF-8; los lectores modernos lo interpretan bien) --- */
  function toBytes(str) {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(str));
    const out = [];
    for (const ch of unescape(encodeURIComponent(str))) out.push(ch.charCodeAt(0));
    return out;
  }

  /* --- posiciones de los patrones de alineación --- */
  function alignPositions(ver) {
    if (ver === 1) return [];
    const na = Math.floor(ver / 7) + 2;
    const size = ver * 4 + 17;
    const step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    const res = [6];
    for (let pos = size - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  /* ---------------- construcción de la matriz ---------------- */
  function buildMatrix(ver, ecl, codewords, forceMask) {
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Uint8Array(size));
    const fn = Array.from({ length: size }, () => new Uint8Array(size));

    const setF = (x, y, v) => { mod[y][x] = v ? 1 : 0; fn[y][x] = 1; };

    /* patrones de búsqueda + separadores */
    function finder(cx, cy) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
        }
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    /* temporización */
    for (let i = 0; i < size; i++) {
      if (!fn[6][i]) setF(i, 6, i % 2 === 0);
      if (!fn[i][6]) setF(6, i, i % 2 === 0);
    }

    /* alineación */
    const ap = alignPositions(ver);
    for (let i = 0; i < ap.length; i++) {
      for (let j = 0; j < ap.length; j++) {
        const skip = (i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0);
        if (skip) continue;
        const cx = ap[j], cy = ap[i];
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            setF(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }

    /* información de versión (v ≥ 7) */
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const b = (bits >>> i) & 1;
        const a = size - 11 + (i % 3), c = Math.floor(i / 3);
        setF(a, c, b); setF(c, a, b);
      }
    }

    /* reserva de la información de formato (se escribe luego por máscara) */
    const formatCells = [];
    for (let i = 0; i <= 5; i++) formatCells.push([8, i]);
    formatCells.push([8, 7], [8, 8], [7, 8]);
    for (let i = 9; i < 15; i++) formatCells.push([14 - i, 8]);
    const formatCells2 = [];
    for (let i = 0; i < 8; i++) formatCells2.push([size - 1 - i, 8]);
    for (let i = 8; i < 15; i++) formatCells2.push([8, size - 15 + i]);
    for (const [x, y] of formatCells.concat(formatCells2)) setF(x, y, 0);
    setF(8, size - 8, 1);   // módulo oscuro fijo

    /* datos en zigzag */
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && i < codewords.length * 8) {
            mod[y][x] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
            i++;
          }
        }
      }
    }

    /* máscaras */
    const MASKS = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
    ];
    const applyMask = (m) => {
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] ^= 1;
    };
    const writeFormat = (m) => {
      const data = (ECL_BITS[ecl] << 3) | m;
      let rem = data;
      for (let k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      formatCells.forEach(([x, y], k) => { mod[y][x] = (bits >>> k) & 1; });
      formatCells2.forEach(([x, y], k) => { mod[y][x] = (bits >>> k) & 1; });
      mod[size - 8][8] = 1;
    };

    let best = forceMask != null ? forceMask : 0, bestScore = Infinity;
    if (forceMask == null) {
      for (let m = 0; m < 8; m++) {
        applyMask(m); writeFormat(m);
        const s = penalty(mod, size);
        applyMask(m);   // deshacer (XOR es su propio inverso)
        if (s < bestScore) { bestScore = s; best = m; }
      }
    }
    applyMask(best); writeFormat(best);
    return { size, modules: mod, mask: best, version: ver, ecl };
  }

  /* --- penalización estándar (4 reglas) --- */
  function penalty(m, size) {
    let p = 0;
    const line = (get) => {
      let run = 1, score = 0;
      const hist = [];
      for (let i = 1; i < size; i++) {
        if (get(i) === get(i - 1)) run++;
        else { if (run >= 5) score += 3 + (run - 5); hist.push(run); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
      return score;
    };
    for (let y = 0; y < size; y++) p += line((i) => m[y][i]);
    for (let x = 0; x < size; x++) p += line((i) => m[i][x]);

    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const v = m[y][x];
        if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) p += 3;
      }

    const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const hit = (get, i, pat) => pat.every((v, k) => get(i + k) === v);
    for (let y = 0; y < size; y++)
      for (let x = 0; x + 11 <= size; x++) {
        const g = (i) => m[y][i];
        if (hit(g, x, P1) || hit(g, x, P2)) p += 40;
      }
    for (let x = 0; x < size; x++)
      for (let y = 0; y + 11 <= size; y++) {
        const g = (i) => m[i][x];
        if (hit(g, y, P1) || hit(g, y, P2)) p += 40;
      }

    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) dark += m[y][x];
    const pct = dark * 100 / (size * size);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  /* ---------------- API ---------------- */
  function encode(text, opts = {}) {
    const ecl = opts.ecl || "M";
    if (!ECC_CW[ecl]) throw new Error("Nivel de corrección inválido: " + ecl);
    const bytes = toBytes(String(text));
    const minV = opts.minVersion || 1, maxV = opts.maxVersion || 40;

    let ver = 0;
    for (let v = minV; v <= maxV; v++) {
      const cc = (v <= 9) ? 8 : 16;
      const need = 4 + cc + bytes.length * 8;
      if (need <= dataCodewords(v, ecl) * 8) { ver = v; break; }
    }
    if (!ver) throw new Error("Texto demasiado largo para un código QR");

    /* flujo de bits */
    const bb = new BitBuf();
    bb.push(0b0100, 4);                       // modo byte
    bb.push(bytes.length, ver <= 9 ? 8 : 16); // cuenta de caracteres
    for (const b of bytes) bb.push(b, 8);

    const capBits = dataCodewords(ver, ecl) * 8;
    bb.push(0, Math.min(4, capBits - bb.bits.length));           // terminador
    bb.push(0, (8 - bb.bits.length % 8) % 8);                    // relleno a byte
    const dataCW = [];
    for (let i = 0; i < bb.bits.length; i += 8) {
      let v = 0;
      for (let k = 0; k < 8; k++) v = (v << 1) | bb.bits[i + k];
      dataCW.push(v);
    }
    for (let pad = 0xEC; dataCW.length < dataCodewords(ver, ecl); pad ^= 0xEC ^ 0x11) dataCW.push(pad);

    /* bloques + corrección + entrelazado */
    const nBlocks = ECC_BLOCKS[ecl][ver];
    const eccLen = ECC_CW[ecl][ver];
    const total = totalCodewords(ver);
    const shortLen = Math.floor(total / nBlocks) - eccLen;
    const nShort = nBlocks - (total % nBlocks);

    const dBlocks = [], eBlocks = [];
    let off = 0;
    for (let b = 0; b < nBlocks; b++) {
      const len = shortLen + (b < nShort ? 0 : 1);
      const chunk = dataCW.slice(off, off + len); off += len;
      dBlocks.push(chunk);
      eBlocks.push(rsRemainder(chunk, eccLen));
    }
    const out = [];
    for (let i = 0; i <= shortLen; i++)
      for (let b = 0; b < nBlocks; b++)
        if (i < dBlocks[b].length) out.push(dBlocks[b][i]);
    for (let i = 0; i < eccLen; i++)
      for (let b = 0; b < nBlocks; b++) out.push(eBlocks[b][i]);

    return buildMatrix(ver, ecl, out, opts.mask);
  }

  function toSVG(text, opts = {}) {
    const q = opts.quiet == null ? 4 : opts.quiet;
    const qr = opts.matrix || encode(text, opts);
    const n = qr.size, dim = n + q * 2;
    let path = "";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (qr.modules[y][x]) path += `M${x + q} ${y + q}h1v1h-1z`;
    const px = opts.scale ? dim * opts.scale : null;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}"` +
      (px ? ` width="${px}" height="${px}"` : "") +
      ` shape-rendering="crispEdges" role="img" aria-label="Código QR del conduce">` +
      `<rect width="${dim}" height="${dim}" fill="${opts.light || "#ffffff"}"/>` +
      `<path d="${path}" fill="${opts.dark || "#000000"}"/></svg>`;
  }

  function toCanvas(text, canvas, opts = {}) {
    const q = opts.quiet == null ? 4 : opts.quiet;
    const s = opts.scale || 6;
    const qr = opts.matrix || encode(text, opts);
    const dim = (qr.size + q * 2) * s;
    canvas.width = canvas.height = dim;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = opts.light || "#ffffff"; ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = opts.dark || "#000000";
    for (let y = 0; y < qr.size; y++)
      for (let x = 0; x < qr.size; x++)
        if (qr.modules[y][x]) ctx.fillRect((x + q) * s, (y + q) * s, s, s);
    return qr;
  }

  return { encode, toSVG, toCanvas, dataCodewords, totalCodewords };
})();

if (typeof module !== "undefined" && module.exports) module.exports = QR;
