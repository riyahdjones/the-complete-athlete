import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.cwd());
const rawDir = path.join(root, 'app-store-screenshots/v2/raw');
const outputDir = path.join(root, 'app-store-screenshots/v2/final');
const port = process.env.TCA_CHROME_PORT || '9224';

const frames = [
  { file: '01-train-the-mind.png', title: 'Train the mind<br>behind the game.', source: 'today.png' },
  { file: '02-coach-that-listens.png', title: 'A coach that starts<br>by listening.', source: 'coach.png' },
  { file: '03-moments-that-matter.png', title: 'Training for the moments<br>that matter.', source: 'plans.png' },
  { file: '04-daily-action.png', title: 'Turn goals into<br>daily action.', source: 'goals.png' },
  { file: '05-built-around-you.png', title: 'A 21-day journey,<br>built around you.', source: '01-today.png' },
  { file: '06-work-adds-up.png', title: 'See your work<br>add up.', source: 'profile.png' }
];

await fs.mkdir(outputDir, { recursive: true });

for (const frame of frames) {
  const sourceUrl = pathToFileURL(path.join(rawDir, frame.source)).href;
  const html = `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <style>
      * { box-sizing: border-box; }
      html, body { width: 430px; height: 932px; margin: 0; overflow: hidden; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
        color: #07142f;
        background:
          radial-gradient(circle at 50% 86%, rgba(57, 126, 255, .15), rgba(57, 126, 255, 0) 42%),
          linear-gradient(180deg, #ffffff 0%, #fbfcff 64%, #f3f7ff 100%);
      }
      .headline {
        position: absolute;
        z-index: 2;
        top: 39px;
        left: 25px;
        width: 380px;
        margin: 0;
        text-align: center;
        font-size: 30px;
        font-weight: 760;
        line-height: 1.08;
        letter-spacing: -.9px;
      }
      .product {
        position: absolute;
        top: 151px;
        left: 37px;
        width: 356px;
        height: 781px;
        overflow: hidden;
        border: 1px solid rgba(87, 143, 244, .2);
        border-radius: 29px 29px 0 0;
        background: white;
        box-shadow: 0 20px 60px rgba(22, 54, 112, .19), 0 4px 18px rgba(22, 54, 112, .08);
      }
      .product img { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <h1 class="headline">${frame.title}</h1>
    <div class="product"><img src="${sourceUrl}" alt=""></div>
  </body>
  </html>`;

  const tempPath = path.join('/private/tmp', `tca-store-${frame.file}.html`);
  await fs.writeFile(tempPath, html);

  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(pathToFileURL(tempPath).href)}`, { method: 'PUT' }).then((response) => response.json());
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

  const command = (method, params = {}) => {
    const id = ++nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };

  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 430,
    height: 932,
    deviceScaleFactor: 3,
    mobile: true,
    screenWidth: 430,
    screenHeight: 932,
    dontSetVisibleSize: false
  });
  await command('Page.navigate', { url: pathToFileURL(tempPath).href });
  await new Promise((resolve) => setTimeout(resolve, 500));

  const { data } = await command('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  await fs.writeFile(path.join(outputDir, frame.file), Buffer.from(data, 'base64'));
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  socket.close();
  await fs.unlink(tempPath).catch(() => {});
}

console.log(`Rendered ${frames.length} App Store screenshots to ${outputDir}`);
