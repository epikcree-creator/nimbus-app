/* PAWS mecha operator "Yuki-0" — original layered SVG (white hard-surface armour, black hair,
   light-brown eyes, pink visor). Every moving part is its own group so CSS/JS can animate it.
   viewBox 0 0 240 300; shoulder socket (62,166); fingertip rest (62,284). */
(function (g) {
  "use strict";
  var INK = "#0d1424";
  function pauldron() {
    return '' +
      '<path d="M32 172C29 146 52 132 76 141C91 147 94 164 89 174C70 181 48 181 32 172Z" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M36 164C42 150 58 144 76 148" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M33 174C50 182 72 182 90 175L89 169C70 176 50 176 34 168Z" fill="#d7263d"/>' +
      '<path d="M33 174C50 182 72 182 90 175" fill="none" stroke="' + INK + '" stroke-width="1.2"/>' +
      '<rect x="52" y="155" width="20" height="6" rx="1.5" fill="#d7263d"/>' +
      '<rect x="52" y="155" width="20" height="6" rx="1.5" fill="none" stroke="' + INK + '" stroke-width=".8"/>' +
      '<path d="M55 158h6M64 158h5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>';
  }
  function fin() {
    /* mecha ear fin + pod, drawn for the viewer's left side (mirrored for the right) */
    return '' +
      '<path d="M84 96L50 44C58 42 68 46 76 54L96 88Z" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M72 74L58 52" stroke="#d7263d" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M82 100L60 70C66 70 72 72 78 78L94 96Z" fill="url(#mxShade)" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<circle cx="84" cy="106" r="11" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.4"/>' +
      '<circle cx="84" cy="106" r="5.4" fill="#d7263d" stroke="' + INK + '" stroke-width="1"/>' +
      '<circle cx="82.4" cy="104.4" r="1.6" fill="#fff" opacity=".9"/>';
  }
  function eye(cx) {
    return '' +
      '<g class="mx-eye" style="transform-origin:' + cx + 'px 103px">' +
      '<ellipse cx="' + cx + '" cy="103" rx="9.4" ry="7.6" fill="#fff"/>' +
      '<g class="mx-iris">' +
      '<circle cx="' + cx + '" cy="103" r="6.3" fill="url(#mxEye)"/>' +
      '<circle cx="' + cx + '" cy="103" r="2.7" fill="#2a1708"/>' +
      '<circle cx="' + (cx - 1.8) + '" cy="101" r="1.7" fill="#fff"/>' +
      '<circle cx="' + (cx + 2) + '" cy="105" r=".8" fill="#fff" opacity=".8"/>' +
      '</g>' +
      '<path d="M' + (cx - 9.6) + ' 102.5C' + (cx - 5) + ' 94.6 ' + (cx + 5) + ' 94.6 ' + (cx + 9.6) + ' 102.5" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '</g>';
  }
  function svg() {
    return '' +
'<svg class="mx-svg" viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PAWS-operatören">' +
'<defs>' +
'<linearGradient id="mxWhite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef0f6"/><stop offset="1" stop-color="#cfd5e2"/></linearGradient>' +
'<linearGradient id="mxShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe3ec"/><stop offset="1" stop-color="#b9c1d1"/></linearGradient>' +
'<linearGradient id="mxHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3347"/><stop offset=".5" stop-color="#121722"/><stop offset="1" stop-color="#07090e"/></linearGradient>' +
'<linearGradient id="mxSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe6db"/><stop offset="1" stop-color="#efcbb9"/></linearGradient>' +
'<linearGradient id="mxVisor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3c8" stop-opacity=".5"/><stop offset=".55" stop-color="#ff7d9f" stop-opacity=".3"/><stop offset="1" stop-color="#d7263d" stop-opacity=".42"/></linearGradient>' +
'<linearGradient id="mxSuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26304a"/><stop offset="1" stop-color="#0f1524"/></linearGradient>' +
'<radialGradient id="mxEye" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#f6d9a2"/><stop offset=".55" stop-color="#d9a45e"/><stop offset="1" stop-color="#a8702f"/></radialGradient>' +
'<radialGradient id="mxGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff8fb1" stop-opacity=".95"/><stop offset="1" stop-color="#ff8fb1" stop-opacity="0"/></radialGradient>' +
'<clipPath id="mxVisorClip"><path d="M84 91C84 80 156 80 156 91L157 112C157 119 144 121 120 121C96 121 83 119 83 112Z"/></clipPath>' +
'</defs>' +

/* 1. backpack + cables (behind everything) */
'<g class="mx-pack">' +
 '<rect x="73" y="132" width="94" height="70" rx="12" fill="#161c2b" stroke="' + INK + '" stroke-width="1.4"/>' +
 '<rect x="58" y="94" width="28" height="82" rx="9" fill="#0f1420" stroke="' + INK + '" stroke-width="1.4"/>' +
 '<rect x="154" y="94" width="28" height="82" rx="9" fill="#0f1420" stroke="' + INK + '" stroke-width="1.4"/>' +
 '<path d="M64 104h16M64 112h16M64 120h16M160 104h16M160 112h16M160 120h16" stroke="#2f3a55" stroke-width="2" stroke-linecap="round"/>' +
 '<rect x="62" y="132" width="20" height="3" rx="1.5" fill="#d7263d"/><rect x="158" y="132" width="20" height="3" rx="1.5" fill="#d7263d"/>' +
 '<circle cx="72" cy="150" r="3" fill="#ff8fb1" class="mx-led"/><circle cx="168" cy="150" r="3" fill="#ff8fb1" class="mx-led mx-led2"/>' +
'</g>' +
'<g class="mx-cable mx-cable-l" style="transform-origin:66px 172px">' +
 '<path d="M66 172C44 190 38 214 50 244C54 254 46 262 52 270" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/>' +
 '<path d="M66 172C44 190 38 214 50 244C54 254 46 262 52 270" fill="none" stroke="#3a4766" stroke-width="1.6" stroke-linecap="round" transform="translate(-1,-1)"/>' +
 '<rect x="46" y="266" width="12" height="10" rx="2.5" fill="#d7263d" stroke="' + INK + '" stroke-width="1"/>' +
'</g>' +
'<g class="mx-cable mx-cable-r" style="transform-origin:174px 172px">' +
 '<path d="M174 172C196 190 202 214 190 244C186 254 194 262 188 270" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/>' +
 '<path d="M174 172C196 190 202 214 190 244C186 254 194 262 188 270" fill="none" stroke="#3a4766" stroke-width="1.6" stroke-linecap="round" transform="translate(-1,-1)"/>' +
 '<rect x="182" y="266" width="12" height="10" rx="2.5" fill="#d7263d" stroke="' + INK + '" stroke-width="1"/>' +
'</g>' +

/* 2. back hair */
'<g class="mx-hairback" style="transform-origin:120px 70px">' +
 '<path d="M120 50C74 48 64 86 66 114C68 152 54 192 60 234C64 254 84 264 98 258C90 228 96 192 100 156L140 156C144 192 150 228 142 258C156 264 176 254 180 234C186 192 172 152 174 114C176 86 166 48 120 50Z" fill="url(#mxHair)" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
 '<path d="M76 100C72 140 66 176 70 220M164 100C168 140 174 176 170 220" fill="none" stroke="#46557a" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>' +
 '<path d="M86 160C84 190 86 220 92 244M154 160C156 190 154 220 148 244" fill="none" stroke="#2f3a58" stroke-width="1.3" stroke-linecap="round"/>' +
'</g>' +

/* 3. body (breathes) */
'<g class="mx-body">' +
 /* other arm (viewer right), static hang */
 '<g class="mx-arm-static">' +
  '<rect x="170" y="164" width="16" height="54" rx="7" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3"/>' +
  '<rect x="170" y="196" width="16" height="6" fill="#d7263d"/>' +
  '<g transform="rotate(8 178 218)"><rect x="171" y="216" width="14" height="46" rx="6" fill="url(#mxShade)" stroke="' + INK + '" stroke-width="1.3"/>' +
  '<rect x="168" y="228" width="20" height="24" rx="5" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3"/><rect x="168" y="236" width="20" height="3" fill="#d7263d"/>' +
  '<rect x="171" y="260" width="14" height="16" rx="6" fill="#f7f8fb" stroke="' + INK + '" stroke-width="1.3"/></g>' +
 '</g>' +
 /* under-suit torso + neck */
 '<path d="M74 150L166 150L172 204L164 300L76 300L68 204Z" fill="url(#mxSuit)" stroke="' + INK + '" stroke-width="1.4"/>' +
 '<path d="M108 124h24l2 30h-28z" fill="#1c2436" stroke="' + INK + '" stroke-width="1.2"/>' +
 /* abdomen segments + belt + hips */
 '<path d="M92 228h56M94 240h52M96 252h48" stroke="#3a4766" stroke-width="2" stroke-linecap="round"/>' +
 '<path d="M80 262L160 262L166 284L74 284Z" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
 '<rect x="80" y="270" width="80" height="4" fill="#d7263d"/><rect x="108" y="262" width="24" height="22" rx="3" fill="#161c2b" stroke="' + INK + '" stroke-width="1.2"/><path d="M114 268h12M114 274h12M114 280h8" stroke="#ff8fb1" stroke-width="1.2" stroke-linecap="round"/>' +
 '<path d="M70 262L88 262L90 300L62 300Z" fill="url(#mxShade)" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
 '<path d="M170 262L152 262L150 300L178 300Z" fill="url(#mxShade)" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
 /* flat hard-surface chest plate */
 '<path d="M88 158L152 158L158 196L146 228L94 228L82 196Z" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
 '<path d="M120 160V226M90 190H150" stroke="#b9c1d1" stroke-width="1.2"/>' +
 '<path d="M94 166L120 164L146 166" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>' +
 '<circle cx="120" cy="174" r="6" fill="#161c2b" stroke="' + INK + '" stroke-width="1.2"/><circle cx="120" cy="174" r="3" fill="#ff8fb1" class="mx-core"/>' +
 '<rect x="96" y="204" width="22" height="8" rx="1.5" fill="#d7263d" stroke="' + INK + '" stroke-width=".8"/><path d="M99 208h8M110 208h5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>' +
 '<path d="M126 206h18M126 212h12" stroke="#9aa5bb" stroke-width="1.2" stroke-linecap="round"/>' +
 /* high collar */
 '<path d="M96 142L144 142L152 160L88 160Z" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/><path d="M102 150h36" stroke="#d7263d" stroke-width="2" stroke-linecap="round"/>' +

 /* pointing arm (viewer left) — upper arm, forearm, hand + finger, all nested for IK-lite */
 '<g class="mx-arm-u" style="transform-origin:62px 166px">' +
  '<rect x="54" y="164" width="16" height="56" rx="7" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3"/>' +
  '<rect x="54" y="198" width="16" height="6" fill="#d7263d"/>' +
  '<circle cx="62" cy="218" r="8" fill="#1c2436" stroke="' + INK + '" stroke-width="1.2"/>' +
  '<g class="mx-arm-f" style="transform-origin:62px 218px">' +
   '<rect x="55" y="216" width="14" height="48" rx="6" fill="url(#mxShade)" stroke="' + INK + '" stroke-width="1.3"/>' +
   '<rect x="51" y="226" width="22" height="26" rx="5" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.3"/><rect x="51" y="234" width="22" height="3.4" fill="#d7263d"/>' +
   '<g class="mx-hand" style="transform-origin:62px 264px">' +
    '<rect class="mx-finger" x="59.8" y="268" width="4.6" height="19" rx="2.3" fill="#f7f8fb" stroke="' + INK + '" stroke-width="1.1" style="transform-origin:62px 268px"/>' +
    '<path d="M54 262C54 256 70 256 70 262L70 274C70 280 54 280 54 274Z" fill="#f7f8fb" stroke="' + INK + '" stroke-width="1.3"/>' +
    '<path d="M56 268h12" stroke="#b9c1d1" stroke-width="1"/>' +
    '<circle class="mx-tip" cx="62" cy="287" r="1.5" fill="#d7263d"/>' +
   '</g>' +
  '</g>' +
 '</g>' +
 '<circle class="mx-shoulder" cx="62" cy="166" r="1" fill="none"/>' +

 /* pauldrons */
 pauldron() +
 '<g transform="translate(240 0) scale(-1 1)">' + pauldron() + '</g>' +

 /* head */
 '<g class="mx-head" style="transform-origin:120px 134px">' +
  /* side locks of black hair framing the face */
  '<path d="M86 96C78 116 82 140 76 160C90 156 95 138 94 116Z" fill="url(#mxHair)" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M154 96C162 116 158 140 164 160C150 156 145 138 146 116Z" fill="url(#mxHair)" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
  /* face */
  '<path d="M88 86C88 58 152 58 152 86L152 107C152 125 137 135 120 135C103 135 88 125 88 107Z" fill="url(#mxSkin)" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M114 124Q120 127.5 126 124" fill="none" stroke="#c4566e" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M120 112l-1.8 4.4h3.4" fill="none" stroke="#d9a995" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<ellipse cx="100" cy="118" rx="6" ry="3" fill="#ff9db8" opacity=".28"/><ellipse cx="140" cy="118" rx="6" ry="3" fill="#ff9db8" opacity=".28"/>' +
  '<path d="M94 82C104 70 136 70 146 82L146 91L136 86L128 93L120 86L112 93L104 86L94 91Z" fill="url(#mxHair)" stroke="' + INK + '" stroke-width="1.1" stroke-linejoin="round"/>' +
  /* eyes behind visor */
  '<g class="mx-eyes">' + eye(105) + eye(135) + '</g>' +
  /* visor */
  '<path d="M84 91C84 80 156 80 156 91L157 112C157 119 144 121 120 121C96 121 83 119 83 112Z" fill="url(#mxVisor)"/>' +
  '<g clip-path="url(#mxVisorClip)"><ellipse class="mx-vglow" cx="120" rx="40" ry="16" cy="96" fill="url(#mxGlow)"/>' +
  '<path d="M92 84L106 124M104 84L112 124" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/></g>' +
  '<path d="M84 91C84 80 156 80 156 91L157 112C157 119 144 121 120 121C96 121 83 119 83 112Z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>' +
  '<path d="M84 91C84 80 156 80 156 91L157 112C157 119 144 121 120 121C96 121 83 119 83 112Z" fill="none" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
  /* helmet crown */
  '<path d="M81 94C76 50 164 50 159 94C152 78 138 71 120 71C102 71 88 78 81 94Z" fill="url(#mxWhite)" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M120 53V71" stroke="#d7263d" stroke-width="3.4" stroke-linecap="round"/>' +
  '<path d="M92 72C100 62 110 58 120 58" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>' +
  '<rect x="108" y="74" width="24" height="5" rx="1.5" fill="#d7263d" stroke="' + INK + '" stroke-width=".8"/><path d="M111 76.5h7M122 76.5h6" stroke="#fff" stroke-width="1" stroke-linecap="round"/>' +
  /* ear fins + pods */
  '<g class="mx-fin mx-fin-l" style="transform-origin:84px 100px">' + fin() + '</g>' +
  '<g class="mx-fin mx-fin-r" style="transform-origin:156px 100px"><g transform="translate(240 0) scale(-1 1)">' + fin() + '</g></g>' +
 '</g>' +
'</g>' +
'</svg>';
  }
  g.MechaArt = { svg: svg };
})(window);
