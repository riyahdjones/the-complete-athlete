import fs from 'node:fs/promises';
import path from 'node:path';

const port = process.env.TCA_CHROME_PORT || '9224';
const studioUrl = process.env.TCA_STUDIO_URL || 'http://127.0.0.1:4175/';
const root = path.resolve(process.cwd(), 'marketing/app-store');
const exportDir = path.join(root, 'exports');
const previewDir = path.join(root, 'preview');
const proofs = [
  ['01A-train-the-mind.png', '?shot=hero-a&render=1'],
  ['01B-the-game-no-one-sees.png', '?shot=hero-b&render=1'],
  ['02-game-day-ready.png', '?shot=game-day&render=1']
];

await fs.mkdir(exportDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

async function capture(file, query, metrics) {
  const url = new URL(query, studioUrl).href;
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const promise = pending.get(message.id); pending.delete(message.id);
    if (message.error) promise.reject(new Error(message.error.message)); else promise.resolve(message.result);
  });
  const command = (method, params = {}) => { const commandId = ++id; socket.send(JSON.stringify({ id: commandId, method, params })); return new Promise((resolve, reject) => pending.set(commandId, { resolve, reject })); };
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', metrics);
  await command('Page.navigate', { url });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const { data } = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(file, Buffer.from(data, 'base64'));
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  socket.close();
}

for (const [file, query] of proofs) {
  await capture(path.join(exportDir, file), query, { width: 430, height: 932, deviceScaleFactor: 3, mobile: true, screenWidth: 430, screenHeight: 932, dontSetVisibleSize: false });
}
await capture(path.join(previewDir, 'initial-proofs-contact-sheet.png'), '?contact=1&render=1', { width: 1290, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: 1290, screenHeight: 1000, dontSetVisibleSize: false });
console.log(`Rendered ${proofs.length} 1290×2796 PNG proofs and contact sheet.`);
