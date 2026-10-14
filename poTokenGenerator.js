import { BG, GOOG_API_KEY, buildURL } from 'bgutils-js';
import { JSDOM } from 'jsdom';

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

let domInstalled = false;
function installDom() {
  if (domInstalled) return;
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://www.youtube.com/' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, origin: dom.window.origin });
  domInstalled = true;
}

export async function mintPoToken(visitorData, videoId) {
  installDom();
  const bgConfig = { fetch: (u, o) => fetch(u, o), globalObj: globalThis, requestKey: REQUEST_KEY, identifier: visitorData };
  const challenge = await BG.Challenge.create(bgConfig);
  if (!challenge) throw new Error('BotGuard challenge failed');
  const interpreterJs = challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!interpreterJs) throw new Error('interpreter missing');
  new Function(interpreterJs)();
  const botguard = await BG.BotGuardClient.create({ program: challenge.program, globalName: challenge.globalName, globalObj: globalThis });
  const webPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
  const itRes = await fetch(buildURL('GenerateIT', false), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json+protobuf', 'x-goog-api-key': GOOG_API_KEY, 'x-user-agent': 'grpc-web-javascript/0.1' },
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });
  if (!itRes.ok) throw new Error(`integrity token HTTP ${itRes.status}`);
  const itJson = await itRes.json();
  const integrityToken = itJson[0];
  if (!integrityToken) throw new Error('no integrity token');
  const minter = await BG.WebPoMinter.create({ integrityToken }, webPoSignalOutput);
  return minter.mintAsWebsafeString(videoId);
}

// To run directly
if (process.argv[1].endsWith('poTokenGenerator.js')) {
    (async () => {
        try {
            const visitorData = process.argv[2] || '';
            const videoId = process.argv[3] || '5ji48UVKJZE';
            const token = await mintPoToken(visitorData, videoId);
            console.log(token);
        } catch (e) {
            console.error(e);
        }
    })();
}
