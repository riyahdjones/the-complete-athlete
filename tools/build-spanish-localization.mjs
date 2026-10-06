import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const cachePath = '/private/tmp/tca-spanish-translation-cache.json';
const planSourcePath = path.join(root, 'src/performancePlans.js');
const temporaryPlanPath = path.join(root, 'src/.performancePlans.translate.mjs');
const planOutputPath = path.join(root, 'src/performancePlans.es.json');
const uiOutputPath = path.join(root, 'src/i18n.es.json');

let cache = {};
try {
  cache = JSON.parse(await fs.readFile(cachePath, 'utf8'));
} catch {}

let completed = 0;
async function saveCache() {
  await fs.writeFile(cachePath, JSON.stringify(cache));
}

async function translateRequest(text, attempt = 0) {
  if (!text.trim()) return text;
  if (cache[text]) return cache[text];
  const endpoint = new URL('https://translate.googleapis.com/translate_a/single');
  endpoint.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'es', dt: 't', q: text });
  try {
    const response = await fetch(endpoint, { headers: { 'User-Agent': 'The Complete Athlete localization build' } });
    if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
    const payload = await response.json();
    const translated = payload?.[0]?.map((part) => part?.[0] || '').join('') || '';
    if (!translated) throw new Error('Translation response was empty');
    cache[text] = translated;
    completed += 1;
    if (completed % 20 === 0) {
      await saveCache();
      console.log(`Translated ${completed} content blocks`);
    }
    return translated;
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    return translateRequest(text, attempt + 1);
  }
}

function textChunks(text, maxLength = 2600) {
  const paragraphs = String(text).split(/\n\n/);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (current) chunks.push(current);
      current = '';
      for (let start = 0; start < paragraph.length; start += maxLength) {
        chunks.push(paragraph.slice(start, start + maxLength));
      }
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateLongText(text) {
  const chunks = textChunks(text);
  const translated = [];
  for (const chunk of chunks) translated.push(await translateRequest(chunk));
  return translated.join('\n\n');
}

async function loadPlans() {
  const source = await fs.readFile(planSourcePath, 'utf8');
  const jsonPath = path.join(root, 'src/goalBlueprintPlanContent.json');
  const transformed = source.replace(
    "import goalBlueprintPlanContent from './goalBlueprintPlanContent.json';",
    `import fs from 'node:fs';\nconst goalBlueprintPlanContent = JSON.parse(fs.readFileSync(${JSON.stringify(jsonPath)}, 'utf8'));`
  );
  await fs.writeFile(temporaryPlanPath, transformed);
  try {
    const module = await import(`${pathToFileURL(temporaryPlanPath).href}?v=${Date.now()}`);
    return module.createPerformancePlanSeeds(() => '2026-10-01');
  } finally {
    await fs.unlink(temporaryPlanPath).catch(() => {});
  }
}

async function translatePlans() {
  const plans = await loadPlans();
  const output = {};
  for (const [index, plan] of plans.entries()) {
    console.log(`Plan ${index + 1}/${plans.length}: ${plan.title}`);
    output[String(plan.id)] = {
      title: await translateLongText(plan.title),
      subject: await translateLongText(plan.subject),
      challengeDay: await translateLongText(plan.challengeDay),
      steps: []
    };
    for (const step of plan.steps || []) {
      output[String(plan.id)].steps.push(await translateLongText(step));
    }
    await saveCache();
  }
  await fs.writeFile(planOutputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(output).length} Spanish plan lessons`);
}

function collectUiStrings(source) {
  const values = new Set();
  const add = (value) => {
    const clean = String(value || '').replace(/\\n/g, ' ').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 220 || !/[A-Za-z]/.test(clean)) return;
    if (/https?:|^[/#.[]|\.(?:js|json|png|jpg|mp4)$|^[a-z0-9_.:/-]+$/i.test(clean)) return;
    if (clean.includes('${') || clean.includes('=>') || clean.includes('className')) return;
    values.add(clean);
  };
  for (const match of source.matchAll(/>([^<>{}\n][^<>{}]*)</g)) add(match[1]);
  for (const match of source.matchAll(/'((?:\\.|[^'\\\n]){2,220})'/g)) add(match[1]);
  for (const match of source.matchAll(/"((?:\\.|[^"\\\n]){2,220})"/g)) add(match[1]);
  return values;
}

async function translateUi() {
  const sources = await Promise.all([
    'src/main.jsx',
    'src/GameDayMode.jsx',
    'src/gameDayQuestions.js',
    'src/revenueCat.js'
  ].map((file) => fs.readFile(path.join(root, file), 'utf8')));
  const values = [...sources.reduce((set, source) => {
    collectUiStrings(source).forEach((value) => set.add(value));
    return set;
  }, new Set())].sort((a, b) => a.localeCompare(b));

  const output = {};
  const pending = [];
  for (const [index, value] of values.entries()) {
    if (process.argv.includes('--cached-only') && !cache[value]) {
      pending.push(value);
      continue;
    }
    output[value] = await translateLongText(value);
    if ((index + 1) % 50 === 0) {
      await fs.writeFile(uiOutputPath, `${JSON.stringify(output, null, 2)}\n`);
      console.log(`UI ${index + 1}/${values.length}`);
    }
  }

  Object.assign(output, {
    'THE COMPLETE ATHLETE': 'THE COMPLETE ATHLETE',
    'The Complete Athlete': 'The Complete Athlete',
    'Train the part of your game no one sees.': 'Entrena la parte de tu juego que nadie ve.',
    'TRAIN THE PART OF YOUR GAME NO ONE SEES.': 'ENTRENA LA PARTE DE TU JUEGO QUE NADIE VE.',
    'Mindset Coach': 'Coach de Mentalidad',
    'My Mindset Coach': 'Mi Coach de Mentalidad',
    'Performance Plans': 'Planes de Rendimiento',
    'Daily Deposit': 'Depósito Diario',
    'Today': 'Hoy',
    'Goals': 'Metas',
    'Plans': 'Planes',
    'Coach': 'Coach',
    'Profile': 'Perfil',
    'Parent': 'Madre, padre o tutor',
    'Athlete': 'Atleta',
    'Log in': 'Iniciar sesión',
    'Log In': 'Iniciar sesión',
    'Create account': 'Crear cuenta',
    'Create Account': 'Crear cuenta',
    'Choose your experience': 'Elige tu experiencia',
    'Forgot password?': '¿Olvidaste tu contraseña?',
    'Settings': 'Configuración',
    'Language': 'Idioma',
    'English': 'Inglés',
    'Spanish': 'Español',
    'Save Profile': 'Guardar perfil',
    'Parent Overview': 'Resumen para padres',
    'Help & Support': 'Ayuda y soporte',
    'Privacy': 'Privacidad',
    'Terms': 'Términos',
    'Support': 'Soporte'
  });

  await fs.writeFile(uiOutputPath, `${JSON.stringify(output, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'src/i18n.pending.json'), `${JSON.stringify(pending, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(output).length} Spanish interface strings`);
}

if (!process.argv.includes('--ui-only') && !process.argv.includes('--cached-only')) await translatePlans();
await translateUi();
await saveCache();
