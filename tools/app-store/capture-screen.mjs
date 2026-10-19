import fs from 'node:fs/promises';
import path from 'node:path';

const [, , outputPath, screen = 'today'] = process.argv;
const port = process.env.TCA_CHROME_PORT || '9224';
const baseAppUrl = process.env.TCA_APP_URL || 'http://127.0.0.1:5173/';
const tabNames = { today: 'home', goals: 'journal', plans: 'plans', coach: 'coach', profile: 'profile' };
const tab = tabNames[screen];

if (!tab) throw new Error(`Unknown screen: ${screen}`);

const appUrl = new URL(baseAppUrl);
appUrl.searchParams.set('nativePreview', '1');
appUrl.searchParams.set('role', 'athlete');
appUrl.searchParams.set('todayPreview', 'athlete');
appUrl.searchParams.set('storePreview', '1');
appUrl.searchParams.set('storeTab', tab);

if (!outputPath) {
  throw new Error('Usage: node capture-screen.mjs <output.png> [today|goals|plans|coach|profile]');
}

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
  positionX: 0,
  positionY: 0,
  dontSetVisibleSize: false
});
await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await command('Page.navigate', { url: appUrl.href });
await wait(2200);

if (process.env.TCA_CAPTURE_DEBUG === '1') {
  const { result } = await command('Runtime.evaluate', {
    expression: `JSON.stringify({ href: window.location.href, title: document.title, heading: document.querySelector('h1')?.textContent || '' })`,
    returnByValue: true
  });
  console.log(result.value);
}

const { data } = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false
});
const resolvedOutputPath = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await fs.writeFile(resolvedOutputPath, Buffer.from(data, 'base64'));
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
socket.close();
