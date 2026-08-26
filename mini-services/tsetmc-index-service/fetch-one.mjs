// Fetch one sector and save to sector-latest.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ZAI from 'z-ai-web-dev-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB = join(__dirname, '..', '..', 'db');
const sector = process.argv[2];
const webId = process.argv[3];
if (!sector || !webId) { console.error('Usage: node fetch-one.mjs <sector> <webId>'); process.exit(1); }

function readJ(p) { try { return existsSync(p) ? JSON.parse(readFileSync(p,'utf-8')) : null; } catch { return null; } }
function writeJ(p, d) { writeFileSync(p, JSON.stringify(d), 'utf-8'); }

const zai = await ZAI.create();
const r = await zai.functions.invoke('page_reader', {url:`http://cdn.tsetmc.com/api/Index/GetIndexB2History/${webId}`});
if (r.code !== 200 || !r.data?.html) { console.error('API error:', r.code); process.exit(1); }

const html = r.data.html;
const preIdx = html.indexOf('<pre');
if (preIdx === -1) { console.error('no pre tag'); process.exit(1); }
const preEnd = html.indexOf('</pre>', preIdx);
if (preEnd === -1) { console.error('no closing pre'); process.exit(1); }
const jsonStr = html.substring(preIdx + 5, preEnd).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
const items = JSON.parse(jsonStr).indexB2 || [];
const valid = items.filter(x => x.xNivInuClMresIbs > 0);
if (!valid.length) { console.error('no valid data'); process.exit(1); }

const last = valid[valid.length-1], prev = valid.length>1 ? valid[valid.length-2] : last;
const close = last.xNivInuClMresIbs, pc = prev.xNivInuClMresIbs;
const pcp = pc > 0 ? Math.round(((close-pc)/pc)*10000)/100 : 0;

// Load and update sector-latest.json
const sl = readJ(join(DB, 'sector-latest.json'));
const data = sl?.data || sl || {};
data[sector] = { sector, close, pcp, date: String(last.dEven||''), webId };
writeJ(join(DB, 'sector-latest.json'), { data, time: Date.now() });

console.log(`OK: ${sector} = ${close.toLocaleString()} (${pcp}%)`);
