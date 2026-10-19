const shots = {
  'hero-a': {
    eyebrow: 'THE COMPLETE ATHLETE',
    headline: 'TRAIN THE <em>MIND</em><br>BEHIND THE GAME.',
    plainHeadline: 'TRAIN THE MIND\nBEHIND THE GAME.',
    support: 'Daily mental performance training built for athletes.',
    background: './assets/backgrounds/hero-stadium.png',
    screen: './assets/ui/today.png',
    treatment: 'hero',
    phone: { x: 52, y: 285, scale: 0.93, rotate: -4, tilt: -3 },
    light: 1,
    blur: 0
  },
  'hero-b': {
    eyebrow: 'THE COMPLETE ATHLETE',
    headline: 'THE GAME<br><em>NO ONE SEES.</em>',
    plainHeadline: 'THE GAME\nNO ONE SEES.',
    support: 'Train the mindset that shows up when it matters.',
    background: './assets/backgrounds/hero-stadium.png',
    screen: './assets/ui/today.png',
    treatment: 'hero',
    phone: { x: 52, y: 285, scale: 0.93, rotate: -4, tilt: -3 },
    light: 1,
    blur: 0
  },
  'game-day': {
    eyebrow: 'GAME DAY MODE',
    headline: 'WALK INTO<br><em>GAME DAY READY.</em>',
    plainHeadline: 'WALK INTO\nGAME DAY READY.',
    support: 'Visualize. Focus. Compete with confidence.',
    background: './assets/backgrounds/game-day-tunnel.png',
    screen: './assets/ui/game-day.png',
    treatment: 'floating',
    phone: { x: 112, y: 286, scale: 0.9, rotate: 8, tilt: 8 },
    light: 1.2,
    blur: 0.2
  }
};

const params = new URLSearchParams(location.search);
const selectedKey = params.get('shot') || 'hero-a';
const renderOnly = params.get('render') === '1';
const contact = params.get('contact') === '1';
const saved = JSON.parse(localStorage.getItem('tca-app-store-studio-v2') || '{}');

function stateFor(key) {
  return structuredClone({ ...shots[key], ...(saved[key] || {}), phone: { ...shots[key].phone, ...(saved[key]?.phone || {}) } });
}

function screenshotMarkup(key, state) {
  const p = state.phone;
  return `<article class="screenshot-canvas ${state.treatment}" data-shot="${key}" style="--phone-x:${p.x}px;--phone-y:${p.y}px;--phone-scale:${p.scale};--phone-rotate:${p.rotate}deg;--phone-tilt:${p.tilt}deg;--light:${state.light};--blur:${state.blur}px">
    <img class="scene" src="${state.background}" alt="">
    <div class="scene-wash"></div>
    <div class="light-beam"></div>
    <header class="campaign-copy">
      <span class="eyebrow">${state.eyebrow}</span>
      <h1>${state.headline}</h1>
      <p>${state.support}</p>
    </header>
    <div class="phone-stage" aria-label="Photorealistic iPhone showing the authentic app interface">
      <div class="phone-shadow"></div>
      <div class="phone-shell">
        <i class="side-button volume-up"></i><i class="side-button volume-down"></i><i class="side-button action"></i>
        <div class="phone-screen"><img src="${state.screen}" alt="Authentic The Complete Athlete app screen"><b class="dynamic-island"></b><span class="glass"></span></div>
      </div>
    </div>
    <div class="campaign-mark"><span></span><b>TCA</b></div>
  </article>`;
}

function save(key, state) {
  saved[key] = state;
  localStorage.setItem('tca-app-store-studio-v2', JSON.stringify(saved));
}

function renderContact() {
  const app = document.querySelector('#app');
  app.innerHTML = `<main class="contact-sheet"><header><span>THE COMPLETE ATHLETE</span><h1>APP STORE CAMPAIGN · INITIAL CREATIVE PROOFS</h1><p>Hero A/B test + Game Day range proof · 1290 × 2796 master exports</p></header><section>${Object.keys(shots).map((key) => `<div><h2>${key === 'hero-a' ? '01A · TRAIN THE MIND' : key === 'hero-b' ? '01B · THE GAME NO ONE SEES' : '02 · GAME DAY MODE'}</h2>${screenshotMarkup(key, stateFor(key))}</div>`).join('')}</section><footer>APPLE PRODUCT LAUNCH PRECISION × ATHLETIC EMOTION × AUTHENTIC PRODUCT UI</footer></main>`;
}

if (contact) {
  document.body.className = 'contact-render';
  renderContact();
} else if (renderOnly) {
  document.body.className = 'render-only';
  document.querySelector('#app').innerHTML = screenshotMarkup(selectedKey, stateFor(selectedKey));
} else {
  let key = selectedKey;
  let current = stateFor(key);
  document.body.className = 'studio-body';
  const app = document.querySelector('#app');
  app.innerHTML = `<div class="studio-shell">
    <aside class="studio-sidebar">
      <div class="studio-brand"><span>TCA</span><div><b>Creative Studio</b><small>App Store Campaign V2</small></div></div>
      <label>Design<select id="shot-select">${Object.keys(shots).map((id) => `<option value="${id}">${id === 'hero-a' ? '01A · Hero / Train the Mind' : id === 'hero-b' ? '01B · Hero / Game No One Sees' : '02 · Game Day Mode'}</option>`).join('')}</select></label>
      <label>Headline<textarea id="headline" rows="3"></textarea></label>
      <label>Supporting copy<textarea id="support" rows="3"></textarea></label>
      <div class="control-pair"><label>Phone X<input id="phone-x" type="range" min="-60" max="220"></label><label>Phone Y<input id="phone-y" type="range" min="180" max="440"></label></div>
      <div class="control-pair"><label>Scale<input id="phone-scale" type="range" min="0.65" max="1.1" step="0.01"></label><label>Rotation<input id="phone-rotate" type="range" min="-18" max="18"></label></div>
      <div class="control-pair"><label>3D tilt<input id="phone-tilt" type="range" min="-14" max="14"></label><label>Lighting<input id="light" type="range" min="0.4" max="1.8" step="0.05"></label></div>
      <label>Background blur<input id="blur" type="range" min="0" max="8" step="0.2"></label>
      <div class="studio-actions"><button id="reset">Reset design</button><a id="full" target="_blank">Open clean render</a></div>
      <p class="studio-note">Exports use authentic app captures. Background plates are replaceable; production app code is untouched.</p>
    </aside>
    <main class="studio-workspace"><header><div><span>LIVE PREVIEW</span><h1>Initial creative proof</h1></div><div class="readability"><b>THUMBNAIL</b><div id="thumb"></div></div></header><div id="preview"></div></main>
  </div>`;

  const select = document.querySelector('#shot-select');
  const fields = ['headline', 'support', 'phone-x', 'phone-y', 'phone-scale', 'phone-rotate', 'phone-tilt', 'light', 'blur'];
  select.value = key;

  function syncFields() {
    document.querySelector('#headline').value = current.plainHeadline;
    document.querySelector('#support').value = current.support;
    document.querySelector('#phone-x').value = current.phone.x;
    document.querySelector('#phone-y').value = current.phone.y;
    document.querySelector('#phone-scale').value = current.phone.scale;
    document.querySelector('#phone-rotate').value = current.phone.rotate;
    document.querySelector('#phone-tilt').value = current.phone.tilt;
    document.querySelector('#light').value = current.light;
    document.querySelector('#blur').value = current.blur;
  }
  function repaint() {
    document.querySelector('#preview').innerHTML = screenshotMarkup(key, current);
    document.querySelector('#thumb').innerHTML = screenshotMarkup(key, current);
    document.querySelector('#full').href = `?shot=${key}&render=1`;
  }
  function update() {
    current.plainHeadline = document.querySelector('#headline').value;
    const lines = current.plainHeadline.split('\n');
    current.headline = lines.map((line, index) => index === lines.length - 1 ? `<em>${line}</em>` : line).join('<br>');
    current.support = document.querySelector('#support').value;
    current.phone.x = Number(document.querySelector('#phone-x').value);
    current.phone.y = Number(document.querySelector('#phone-y').value);
    current.phone.scale = Number(document.querySelector('#phone-scale').value);
    current.phone.rotate = Number(document.querySelector('#phone-rotate').value);
    current.phone.tilt = Number(document.querySelector('#phone-tilt').value);
    current.light = Number(document.querySelector('#light').value);
    current.blur = Number(document.querySelector('#blur').value);
    save(key, current);
    repaint();
  }
  fields.forEach((id) => document.querySelector(`#${id}`).addEventListener('input', update));
  select.addEventListener('change', () => { key = select.value; current = stateFor(key); syncFields(); repaint(); });
  document.querySelector('#reset').addEventListener('click', () => { delete saved[key]; localStorage.setItem('tca-app-store-studio-v2', JSON.stringify(saved)); current = stateFor(key); syncFields(); repaint(); });
  syncFields();
  repaint();
}
