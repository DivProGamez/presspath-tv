/* PressPath TV — original vector illustrations and glyphs (inline SVG, offline). */
(function (root) {
  'use strict';
  var uid = 0;
  function U(p) { uid += 1; return p + uid; }

  function lin(id, a, b, x2, y2) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 1 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' +
      '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
  }
  function glow(id, dev) {
    return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + (dev || 6) + '"/></filter>';
  }
  function svg(vb, body, cls) {
    return '<svg class="' + (cls || 'art') + '" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  // ---------- Brand ----------
  function logo() {
    var g = U('lg'), s = U('ls');
    return svg('0 0 64 64',
      '<defs>' + lin(g, '#35D6FF', '#5B34E6') + lin(s, '#FFFFFF', '#CFF4FF', 0, 1) + '</defs>' +
      '<rect x="2" y="2" width="60" height="60" rx="17" fill="url(#' + g + ')"/>' +
      '<rect x="2.5" y="2.5" width="59" height="59" rx="16.5" fill="none" stroke="rgba(255,255,255,.35)"/>' +
      '<path d="M14 22 l8 10 -8 10" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M27 19.5 L48 32 L27 44.5 Z" fill="url(#' + s + ')" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>', 'logo');
  }

  // ---------- Activity tile illustrations (160 x 160) ----------
  function lab() {
    var a = U('a'), b = U('b'), f = U('f');
    return svg('0 0 160 160', '<defs>' + lin(a, '#7FE7FF', '#1A9BEA') + lin(b, '#22C8F5', '#5B34E6') + glow(f, 8) + '</defs>' +
      '<circle cx="80" cy="80" r="56" fill="none" stroke="#22C8F5" stroke-width="10" opacity=".35" filter="url(#' + f + ')"/>' +
      '<circle cx="80" cy="80" r="56" fill="none" stroke="url(#' + a + ')" stroke-width="7"/>' +
      '<circle cx="80" cy="80" r="38" fill="rgba(34,200,245,.10)" stroke="url(#' + b + ')" stroke-width="4" stroke-dasharray="10 7"/>' +
      '<path d="M80 14 v18 M80 128 v18 M14 80 h18 M128 80 h18" stroke="#9BEBFF" stroke-width="6" stroke-linecap="round"/>' +
      '<g fill="url(#' + a + ')"><rect x="71" y="52" width="18" height="56" rx="6"/><rect x="52" y="71" width="56" height="18" rx="6"/></g>' +
      '<circle cx="80" cy="80" r="7" fill="#06263A"/>' +
      '<circle cx="124" cy="36" r="6" fill="#29F0AD"/><circle cx="138" cy="24" r="3.5" fill="#29F0AD" opacity=".7"/>');
  }

  function memoryTile() {
    var a = U('a'), b = U('b'), f = U('f');
    return svg('0 0 160 160', '<defs>' + lin(a, '#B79BFF', '#5B34E6') + lin(b, '#FF8FB8', '#E0457B') + glow(f, 7) + '</defs>' +
      '<g transform="rotate(-12 64 86)"><rect x="24" y="36" width="76" height="100" rx="14" fill="url(#' + a + ')"/>' +
      '<rect x="24.5" y="36.5" width="75" height="99" rx="13.5" fill="none" stroke="rgba(255,255,255,.4)"/>' +
      '<path d="M62 70 l6 13 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2z" fill="#FFE37A"/></g>' +
      '<g transform="rotate(10 104 84)"><rect x="66" y="28" width="76" height="100" rx="14" fill="url(#' + b + ')" filter="url(#' + f + ')" opacity=".45"/>' +
      '<rect x="66" y="28" width="76" height="100" rx="14" fill="url(#' + b + ')"/>' +
      '<rect x="66.5" y="28.5" width="75" height="99" rx="13.5" fill="none" stroke="rgba(255,255,255,.45)"/>' +
      '<path d="M104 96 C84 82 86 64 98 64 C102 64 104 67 104 69 C104 67 106 64 110 64 C122 64 124 82 104 96Z" fill="#fff"/></g>' +
      '<circle cx="30" cy="30" r="4" fill="#FFE37A"/><circle cx="140" cy="140" r="5" fill="#C9BFFF"/>');
  }

  function cardsTile() {
    var a = U('a'), b = U('b'), c = U('c');
    return svg('0 0 160 160', '<defs>' + lin(a, '#FFC46B', '#F27A2A') + lin(b, '#FFE2A8', '#FFB347') + lin(c, '#FF9A4D', '#D9481F') + '</defs>' +
      '<rect x="40" y="22" width="88" height="108" rx="14" fill="url(#' + c + ')" transform="rotate(14 84 76)" opacity=".85"/>' +
      '<rect x="34" y="26" width="88" height="108" rx="14" fill="url(#' + a + ')" transform="rotate(5 78 80)"/>' +
      '<rect x="28" y="30" width="88" height="108" rx="14" fill="url(#' + b + ')"/>' +
      '<rect x="28.5" y="30.5" width="87" height="107" rx="13.5" fill="none" stroke="rgba(255,255,255,.7)"/>' +
      '<text x="72" y="98" text-anchor="middle" font-family="Segoe UI,Roboto,sans-serif" font-weight="800" font-size="46" fill="#7A2E0B">Aa</text>' +
      '<rect x="44" y="110" width="56" height="7" rx="3.5" fill="#C9662B" opacity=".5"/>');
  }

  function progressTile() {
    var a = U('a'), b = U('b'), f = U('f');
    return svg('0 0 160 160', '<defs>' + lin(a, '#5CFFC8', '#0FA678', 0, 1) + lin(b, '#7FE7FF', '#1A9BEA', 0, 1) + glow(f, 5) + '</defs>' +
      '<rect x="22" y="124" width="116" height="6" rx="3" fill="rgba(255,255,255,.25)"/>' +
      '<rect x="30" y="86" width="22" height="38" rx="6" fill="url(#' + b + ')" opacity=".75"/>' +
      '<rect x="60" y="66" width="22" height="58" rx="6" fill="url(#' + b + ')"/>' +
      '<rect x="90" y="48" width="22" height="76" rx="6" fill="url(#' + a + ')"/>' +
      '<polyline points="30,72 62,52 94,58 132,24" fill="none" stroke="#29F0AD" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + f + ')" opacity=".6"/>' +
      '<polyline points="30,72 62,52 94,58 132,24" fill="none" stroke="#B8FFE6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="132" cy="24" r="8" fill="#29F0AD"/><circle cx="132" cy="24" r="3.5" fill="#fff"/>');
  }

  function settingsTile() {
    var a = U('a'), b = U('b');
    var teeth = '';
    for (var i = 0; i < 8; i++) teeth += '<rect x="72" y="18" width="16" height="22" rx="4" transform="rotate(' + (i * 45) + ' 80 80)"/>';
    return svg('0 0 160 160', '<defs>' + lin(a, '#9DB2FF', '#4A3FD9') + lin(b, '#C9BFFF', '#7B61FF') + '</defs>' +
      '<g fill="url(#' + a + ')">' + teeth + '<circle cx="80" cy="80" r="46"/></g>' +
      '<circle cx="80" cy="80" r="45.5" fill="none" stroke="rgba(255,255,255,.35)"/>' +
      '<circle cx="80" cy="80" r="22" fill="#0C1226"/>' +
      '<circle cx="80" cy="80" r="12" fill="url(#' + b + ')"/>');
  }

  // ---------- Memory card faces (120 x 120) ----------
  var FACES = {
    star: function () { var a = U('a'); return '<defs>' + lin(a, '#FFF0A0', '#FFB21E') + '</defs><path d="M60 14 l13 29 32 3 -24 21 7 31 -28 -16 -28 16 7 -31 -24 -21 32 -3z" fill="url(#' + a + ')" stroke="#FFF6CC" stroke-width="3" stroke-linejoin="round"/>'; },
    planet: function () { var a = U('a'); return '<defs>' + lin(a, '#6AF5D0', '#118C8C') + '</defs><ellipse cx="60" cy="62" rx="54" ry="15" fill="none" stroke="#C9FFF0" stroke-width="5" transform="rotate(-18 60 62)" opacity=".5"/><circle cx="60" cy="60" r="32" fill="url(#' + a + ')"/><path d="M38 52 q12 -6 22 2 t22 -2" fill="none" stroke="#0E6F6F" stroke-width="4" opacity=".6"/><path d="M8 78 Q60 52 112 44" fill="none" stroke="#E6FFF8" stroke-width="5" stroke-linecap="round"/>'; },
    heart: function () { var a = U('a'); return '<defs>' + lin(a, '#FF9DB0', '#F0365F') + '</defs><path d="M60 102 C18 74 14 42 36 32 C48 27 58 34 60 42 C62 34 72 27 84 32 C106 42 102 74 60 102Z" fill="url(#' + a + ')" stroke="#FFD3DC" stroke-width="3"/><ellipse cx="42" cy="46" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 42 46)"/>'; },
    rocket: function () { var a = U('a'), b = U('b'); return '<defs>' + lin(a, '#FFFFFF', '#BFD3FF') + lin(b, '#FFE07A', '#FF6A2A', 0, 1) + '</defs><path d="M60 98 q-8 14 0 18 q8 -4 0 -18z" fill="url(#' + b + ')"/><path d="M60 10 C80 26 84 56 76 92 H44 C36 56 40 26 60 10Z" fill="url(#' + a + ')"/><circle cx="60" cy="48" r="10" fill="#22C8F5" stroke="#1A3C7A" stroke-width="4"/><path d="M44 70 L28 96 H46Z M76 70 L92 96 H74Z" fill="#F0365F"/>'; },
    leaf: function () { var a = U('a'); return '<defs>' + lin(a, '#B6FF7A', '#18A558') + '</defs><path d="M22 98 C22 46 58 18 104 16 C104 66 76 98 22 98Z" fill="url(#' + a + ')" stroke="#E2FFD0" stroke-width="3"/><path d="M26 94 C50 70 70 52 96 26" fill="none" stroke="#0E6B34" stroke-width="4" stroke-linecap="round"/>'; },
    fish: function () { var a = U('a'); return '<defs>' + lin(a, '#FFC56B', '#FF6F3C') + '</defs><path d="M16 60 C34 30 78 30 92 60 C78 90 34 90 16 60Z" fill="url(#' + a + ')"/><path d="M90 60 L112 38 V82Z" fill="#FF8A4D"/><circle cx="36" cy="54" r="6" fill="#1A1F33"/><circle cx="34" cy="52" r="2" fill="#fff"/><path d="M54 40 q8 20 0 40 M68 42 q8 18 0 36" fill="none" stroke="#FFE2B8" stroke-width="3" opacity=".7"/>'; }
  };
  function face(sym) { return svg('0 0 120 120', (FACES[sym] || FACES.star)(), 'face'); }

  function cardBack() {
    var a = U('a');
    return svg('0 0 120 120', '<defs>' + lin(a, '#C9BFFF', '#7B61FF') + '</defs>' +
      '<path d="M30 40 l14 20 -14 20" fill="none" stroke="url(#' + a + ')" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' +
      '<path d="M54 34 L90 60 L54 86Z" fill="none" stroke="url(#' + a + ')" stroke-width="7" stroke-linejoin="round"/>', 'back');
  }

  // ---------- Science icons (160 x 160) ----------
  var SCI = {
    plant: function () { var a = U('a'), b = U('b'); return '<defs>' + lin(a, '#B6FF7A', '#18A558') + lin(b, '#FFB36B', '#C9662B', 0, 1) + '</defs><circle cx="124" cy="34" r="18" fill="#FFD84D"/><g stroke="#FFD84D" stroke-width="4" stroke-linecap="round"><path d="M124 6v8M124 54v8M96 34h8M144 34h8"/></g><path d="M80 120 V70" stroke="#18A558" stroke-width="6"/><path d="M80 84 C56 84 42 70 40 48 C64 48 78 60 80 84Z" fill="url(#' + a + ')"/><path d="M80 74 C100 74 116 60 116 40 C94 40 82 52 80 74Z" fill="url(#' + a + ')"/><path d="M52 116 H108 L100 150 H60Z" fill="url(#' + b + ')"/>'; },
    ice: function () { var a = U('a'); return '<defs>' + lin(a, '#E8FBFF', '#7FD8FF') + '</defs><rect x="34" y="40" width="80" height="80" rx="16" fill="url(#' + a + ')" transform="rotate(-8 74 80)" opacity=".95"/><rect x="34" y="40" width="80" height="80" rx="16" fill="none" stroke="#fff" stroke-width="3" transform="rotate(-8 74 80)"/><path d="M52 64 l20 -6" stroke="#fff" stroke-width="6" stroke-linecap="round"/><g stroke="#BFF0FF" stroke-width="4" stroke-linecap="round"><path d="M126 96v40M106 116h40M112 102l28 28M140 102l-28 28"/></g>'; },
    earth: function () { var a = U('a'); return '<defs>' + lin(a, '#5CC8FF', '#1F5FD9') + '</defs><circle cx="80" cy="80" r="56" fill="url(#' + a + ')"/><path d="M50 46 c14 -6 26 4 22 16 c-4 10 -18 8 -20 20 c-2 10 -12 12 -18 4 c-6 -14 2 -34 16 -40z M96 34 c16 6 26 20 24 34 c-10 4 -18 -6 -26 -2 c-8 4 -14 -6 -8 -14 c4 -6 2 -14 10 -18z M84 104 c10 -6 24 -2 26 8 c-8 12 -24 18 -34 16 c-2 -10 2 -18 8 -24z" fill="#3DDC84"/><circle cx="80" cy="80" r="55" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/>'; },
    rainbow: function () { var cols = ['#FF5A5A', '#FF9F43', '#FFD84D', '#3DDC84', '#22C8F5', '#7B61FF']; var p = ''; cols.forEach(function (c, i) { var r = 64 - i * 9; p += '<path d="M' + (80 - r) + ' 112 A' + r + ' ' + r + ' 0 0 1 ' + (80 + r) + ' 112" fill="none" stroke="' + c + '" stroke-width="9"/>'; }); return p + '<ellipse cx="28" cy="116" rx="22" ry="12" fill="#EAF2FF"/><ellipse cx="132" cy="116" rx="22" ry="12" fill="#EAF2FF"/>'; },
    moon: function () { var a = U('a'); return '<defs>' + lin(a, '#FFF6CF', '#F2C94C') + '</defs><path d="M104 120 A52 52 0 1 1 92 26 A42 42 0 1 0 104 120Z" fill="url(#' + a + ')"/><circle cx="62" cy="62" r="6" fill="#E0B23C" opacity=".6"/><circle cx="56" cy="96" r="8" fill="#E0B23C" opacity=".5"/><g fill="#fff"><circle cx="122" cy="40" r="3"/><circle cx="136" cy="70" r="2"/><circle cx="114" cy="22" r="2"/></g>'; },
    magnet: function () { return '<path d="M40 30 V84 a40 40 0 0 0 80 0 V30 H96 V84 a16 16 0 0 1 -32 0 V30Z" fill="#F0365F"/><rect x="40" y="30" width="24" height="20" fill="#E6ECFF"/><rect x="96" y="30" width="24" height="20" fill="#E6ECFF"/><g stroke="#22C8F5" stroke-width="4" stroke-linecap="round" opacity=".8"><path d="M30 18l-8-8M52 12v-8M108 12v-8M130 18l8-8"/></g>'; },
    heart: function () { var a = U('a'); return '<defs>' + lin(a, '#FF9DB0', '#E0244F') + '</defs><path d="M80 136 C24 98 18 56 48 42 C64 35 76 44 80 56 C84 44 96 35 112 42 C142 56 136 98 80 136Z" fill="url(#' + a + ')"/><polyline points="30,84 58,84 68,66 80,102 92,74 100,84 130,84" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>'; },
    air: function () { return '<circle cx="66" cy="84" r="40" fill="rgba(34,200,245,.18)" stroke="#7FE7FF" stroke-width="4"/><text x="66" y="98" text-anchor="middle" font-family="Segoe UI,Roboto,sans-serif" font-weight="800" font-size="40" fill="#E8FBFF">O₂</text><circle cx="120" cy="44" r="18" fill="rgba(34,200,245,.18)" stroke="#7FE7FF" stroke-width="3"/><circle cx="124" cy="104" r="11" fill="rgba(34,200,245,.18)" stroke="#7FE7FF" stroke-width="3"/><circle cx="34" cy="30" r="8" fill="rgba(34,200,245,.18)" stroke="#7FE7FF" stroke-width="3"/>'; },
    bee: function () { return '<ellipse cx="62" cy="54" rx="22" ry="16" fill="rgba(220,240,255,.85)" transform="rotate(-25 62 54)"/><ellipse cx="96" cy="50" rx="22" ry="16" fill="rgba(220,240,255,.85)" transform="rotate(25 96 50)"/><ellipse cx="80" cy="92" rx="40" ry="30" fill="#FFC93C"/><path d="M62 66 v52 M82 62 v60 M102 68 v48" stroke="#2A2233" stroke-width="10"/><circle cx="118" cy="88" r="16" fill="#2A2233"/><circle cx="123" cy="84" r="4" fill="#fff"/><path d="M40 92 l-14 4" stroke="#2A2233" stroke-width="5" stroke-linecap="round"/>'; },
    steam: function () { var a = U('a'); return '<defs>' + lin(a, '#9DB2FF', '#4A3FD9') + '</defs><path d="M34 140 C30 96 44 74 80 74 C116 74 130 96 126 140Z" fill="url(#' + a + ')"/><path d="M60 74 v-10 h40 v10" fill="none" stroke="#C9BFFF" stroke-width="6"/><path d="M126 100 h14 l8 -14" fill="none" stroke="#9DB2FF" stroke-width="8" stroke-linecap="round"/><g fill="none" stroke="#E6ECFF" stroke-width="6" stroke-linecap="round" opacity=".85"><path d="M58 52 c-10 -10 10 -16 0 -30"/><path d="M80 52 c-10 -10 10 -16 0 -30"/><path d="M102 52 c-10 -10 10 -16 0 -30"/></g>'; }
  };
  function science(icon) { return svg('0 0 160 160', (SCI[icon] || SCI.earth)(), 'sci'); }

  // ---------- Deck covers ----------
  function block(x, y, ch, c1, c2, rot) {
    var a = U('a');
    return '<defs>' + lin(a, c1, c2) + '</defs><g transform="rotate(' + rot + ' ' + (x + 26) + ' ' + (y + 26) + ')"><rect x="' + x + '" y="' + y + '" width="52" height="52" rx="10" fill="url(#' + a + ')"/>' +
      '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="51" height="51" rx="9.5" fill="none" stroke="rgba(255,255,255,.5)"/>' +
      '<text x="' + (x + 26) + '" y="' + (y + 38) + '" text-anchor="middle" font-family="Segoe UI,Roboto,sans-serif" font-weight="900" font-size="32" fill="#fff">' + ch + '</text></g>';
  }
  function deckArt(id) {
    if (id === 'letters') return svg('0 0 160 160', block(18, 78, 'A', '#FF8FB8', '#E0457B', -8) + block(56, 34, 'B', '#7FE7FF', '#1A9BEA', 6) + block(92, 80, 'C', '#FFC46B', '#F27A2A', -4));
    if (id === 'numbers') return svg('0 0 160 160', block(18, 80, '1', '#5CFFC8', '#0FA678', 6) + block(56, 36, '2', '#B79BFF', '#5B34E6', -6) + block(92, 82, '3', '#7FE7FF', '#1A9BEA', 8));
    var a = U('a'), b = U('b');
    return svg('0 0 160 160', '<defs>' + lin(a, '#E8FBFF', '#9DDCFF', 0, 1) + lin(b, '#5CFFC8', '#0FA678', 0, 1) + '</defs>' +
      '<path d="M64 20 h32 M70 20 v40 L36 122 a12 12 0 0 0 10 18 h68 a12 12 0 0 0 10 -18 L90 60 V20" fill="url(#' + a + ')" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M50 104 h60 l14 22 a8 8 0 0 1 -7 12 H43 a8 8 0 0 1 -7 -12z" fill="url(#' + b + ')"/>' +
      '<circle cx="68" cy="118" r="5" fill="#E8FFF6"/><circle cx="92" cy="124" r="4" fill="#E8FFF6"/><circle cx="84" cy="88" r="3" fill="#5CFFC8"/>');
  }

  function stars(n) {
    var cols = n <= 5 ? n : 5, rows = Math.ceil(n / 5), out = '';
    var w = 64, h = 64, W = cols * w, H = rows * h;
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / 5), c = i % 5, inRow = r === rows - 1 ? n - r * 5 : 5;
      var off = (cols - inRow) * w / 2;
      var cx = off + c * w + w / 2, cy = r * h + h / 2;
      out += '<path transform="translate(' + (cx - 24) + ' ' + (cy - 24) + ') scale(.4)" d="M60 14 l13 29 32 3 -24 21 7 31 -28 -16 -28 16 7 -31 -24 -21 32 -3z" fill="#FFC93C" stroke="#FFF2B8" stroke-width="5" stroke-linejoin="round"/>';
    }
    return svg('0 0 ' + W + ' ' + H, out, 'stars');
  }

  function shortcutArt(kind) {
    if (kind === 'memory') return memoryTile();
    if (kind === 'science') return deckArt('science');
    if (kind === 'letters') return deckArt('letters');
    if (kind === 'contrast') return svg('0 0 160 160', '<circle cx="80" cy="80" r="54" fill="#0C1226" stroke="#FFE600" stroke-width="8"/><path d="M80 26 a54 54 0 0 1 0 108z" fill="#FFE600"/>');
    if (kind === 'text') return svg('0 0 160 160', '<text x="80" y="112" text-anchor="middle" font-family="Segoe UI,Roboto,sans-serif" font-weight="900" font-size="88" fill="#FFC93C">A</text><text x="128" y="112" text-anchor="middle" font-family="Segoe UI,Roboto,sans-serif" font-weight="800" font-size="44" fill="#FFE2A8">a</text>');
    return lab();
  }

  // ---------- Splash remote ----------
  function remote() {
    var a = U('a'), f = U('f'), g = U('g');
    return svg('0 0 420 760',
      '<defs>' + lin(a, '#1B2442', '#070B18') + glow(f, 14) + lin(g, '#35D6FF', '#7B61FF') + '</defs>' +
      '<rect x="70" y="20" width="280" height="720" rx="140" fill="url(#' + a + ')" stroke="rgba(160,200,255,.25)" stroke-width="3"/>' +
      '<circle cx="210" cy="250" r="104" fill="none" stroke="#22C8F5" stroke-width="18" filter="url(#' + f + ')" opacity=".9"/>' +
      '<circle cx="210" cy="250" r="104" fill="#0E1630" stroke="url(#' + g + ')" stroke-width="7"/>' +
      '<circle cx="210" cy="250" r="46" fill="#141D3A" stroke="rgba(160,220,255,.5)" stroke-width="3"/>' +
      '<text x="210" y="262" text-anchor="middle" font-family="Segoe UI,Roboto,sans-serif" font-weight="800" font-size="30" fill="#8DE0FF">OK</text>' +
      '<g fill="#8DE0FF"><path d="M210 162 l14 16 h-28z"/><path d="M210 338 l14 -16 h-28z"/><path d="M122 250 l16 -14 v28z"/><path d="M298 250 l-16 -14 v28z"/></g>' +
      '<g fill="#18213F" stroke="rgba(160,200,255,.25)" stroke-width="2"><circle cx="140" cy="430" r="30"/><circle cx="280" cy="430" r="30"/><circle cx="140" cy="520" r="30"/><circle cx="280" cy="520" r="30"/><rect x="180" y="400" width="60" height="150" rx="30"/></g>' +
      '<g fill="none" stroke="#BCC8CF" stroke-width="5" stroke-linecap="round"><path d="M150 430 h-18 m8 -8 l-8 8 8 8"/><path d="M272 422 l10 8 -10 8"/></g>' +
      '<circle cx="210" cy="90" r="10" fill="#29F0AD" filter="url(#' + f + ')"/><circle cx="210" cy="90" r="6" fill="#29F0AD"/>');
  }

  // ---------- UI glyphs (24 x 24, currentColor) ----------
  var GLYPH = {
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronL: '<path d="M15 6l-6 6 6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z" fill="currentColor"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/>',
    back: '<path d="M10 7l-5 5 5 5"/><path d="M5 12h9a5 5 0 0 1 0 10h-2"/>',
    dpad: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>', right: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function glyph(name, cls) {
    return '<svg class="g ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (GLYPH[name] || '') + '</svg>';
  }

  var TILE = { lab: lab, memory: memoryTile, cards: cardsTile, progress: progressTile, settings: settingsTile };

  (root.PP = root.PP || {}).art = {
    logo: logo, tile: function (k) { return (TILE[k] || lab)(); }, face: face, cardBack: cardBack,
    science: science, deckArt: deckArt, stars: stars, shortcutArt: shortcutArt, remote: remote, glyph: glyph
  };
})(typeof self !== 'undefined' ? self : this);
