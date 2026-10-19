import fs from 'node:fs/promises';
import path from 'node:path';

const outputPath = path.resolve(process.argv[2] || 'marketing/app-store/assets/ui/game-day.png');
const port = process.env.TCA_CHROME_PORT || '9224';
const appUrl = new URL(process.env.TCA_APP_URL || 'http://127.0.0.1:5173/');
appUrl.searchParams.set('nativePreview', '1');
appUrl.searchParams.set('role', 'athlete');
appUrl.searchParams.set('todayPreview', 'athlete');
appUrl.searchParams.set('storePreview', '1');
appUrl.searchParams.set('storeTab', 'home');

const draft = {
  id: 'store-game-day-preview',
  userId: null,
  stage: 'summary',
  sport: 'Football',
  startedAt: '2026-10-08T18:00:00.000Z',
  questionIds: ['gd-focus-1', 'gd-controllables-1', 'gd-confidence-4'],
  responses: [
    { id: 'preview-focus', questionId: 'gd-focus-1', category: 'FOCUS', questionTextSnapshot: 'What deserves your attention today?', answer: 'Win the next play.' },
    { id: 'preview-controls', questionId: 'gd-controllables-1', category: 'CONTROLLABLES', questionTextSnapshot: 'What are your 3 controllables today?', answer: ['Effort', 'Response', 'Body Language'] },
    { id: 'preview-confidence', questionId: 'gd-confidence-4', category: 'CONFIDENCE', questionTextSnapshot: 'What would playing with confidence look like today?', answer: 'Trust my preparation and play free.' }
  ],
  questionIndex: 2,
  visualizationCompleted: false
};

const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(appUrl.href)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 430,
  height: 932,
  deviceScaleFactor: 3,
  mobile: true,
  screenWidth: 430,
  screenHeight: 932,
  dontSetVisibleSize: false
});
await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await command('Page.navigate', { url: appUrl.href });
await wait(1800);
await command('Runtime.evaluate', {
  expression: `localStorage.setItem('tca-game-day-draft:guest', ${JSON.stringify(JSON.stringify(draft))}); location.reload();`
});
await wait(2200);
await command('Runtime.evaluate', { expression: `document.querySelector('.game-day-start')?.click()` });
await wait(500);
await command('Runtime.evaluate', { expression: `document.querySelector('.game-day-summary .game-day-primary')?.click()` });
await wait(1400);

const state = await command('Runtime.evaluate', {
  expression: `JSON.stringify({ visualization: Boolean(document.querySelector('.game-day-visualization')), title: document.querySelector('.visualization-center span')?.textContent, entry: document.querySelector('.game-day-start')?.textContent, modal: document.querySelector('.game-day-modal')?.textContent?.slice(0, 160), summaryButton: document.querySelector('.game-day-summary .game-day-primary')?.textContent, draft: localStorage.getItem('tca-game-day-draft:guest')?.slice(0, 120) })`,
  returnByValue: true
});
if (!JSON.parse(state.result.value || '{}').visualization) throw new Error(`Game Day visualization did not open: ${state.result.value}`);

const { data } = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false
});
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, Buffer.from(data, 'base64'));
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
socket.close();
console.log(`Captured authentic Game Day visualization to ${outputPath}`);
