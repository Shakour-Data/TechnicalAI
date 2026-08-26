// One-shot sector fetcher — ESM module, runs with: node fetch-sectors.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ZAI from 'z-ai-web-dev-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', '..', 'db');
const DELAY = 25000;

const SECTORS = [
  ['محصولات کاغذی','30106839080444358'],['انتشار و چاپ','25766336681098389'],
  ['فرآورده های نفتی','12331083953323969'],['لاستیک','36469751685735891'],
  ['فلزات اساسی','32453344048876642'],['محصولات فلزی','1123534346391630'],
  ['ماشین آلات','11451389074113298'],['دستگاه های برقی','33878047680249697'],
  ['وسایل ارتباطی','24733701189547084'],['خودرو','20213770409093165'],
  ['قند و شکر','21948907150049163'],['چند رشته ای','40355846462826897'],
  ['تامین آب، برق و گاز','54843635503648458'],['غذایی','15508900928481581'],
  ['دارویی','3615666621538524'],['شیمیایی','33626672012415176'],
  ['خرده فروشی','65986638607018835'],['کاشی و سرامیک','57616105980228781'],
  ['سیمان','70077233737515808'],['کانی غیر فلزی','14651627750314021'],
  ['سرمایه گذاری','34295935482222451'],['بانک','72002976013856737'],
  ['سایر مالی','25163959460949732'],['حمل و نقل','24187097921483699'],
  ['رادیویی','41867092385281437'],['مالی','61247168213690670'],
  ['اداره بازارهای مالی','61985386521682984'],['انبوه سازی','4654922806626448'],
  ['رایانه','8900726085939949'],['اطلاعات و ارتباطات','18780171241610744'],
  ['فنی مهندسی','47233872677452574'],['استخراج نفت','65675836323214668'],
  ['بیمه و بازنشستگی','59105676994811497'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function readJ(p) { try { return existsSync(p) ? JSON.parse(readFileSync(p,'utf-8')) : null; } catch { return null; } }
function writeJ(p, d) { try { const dir=dirname(p); if(!existsSync(dir)) mkdirSync(dir,{recursive:true}); writeFileSync(p,JSON.stringify(d),'utf-8'); } catch(e){console.error(e);} }

async function main() {
  console.log('['+new Date().toISOString()+'] Initializing SDK...');
  const zai = await ZAI.create();
  console.log('['+new Date().toISOString()+'] SDK ready. '+SECTORS.length+' sectors to check.');

  const results = {};
  const fl = readJ(join(DB_DIR,'sector-latest.json'));
  if (fl) { const fd = fl.data||fl; for (const [s,info] of Object.entries(fd)) { if(info.close>0) results[s]={close:info.close,pcp:info.pcp||0,date:info.date||'',webId:info.webId||''}; } }
  console.log('['+new Date().toISOString()+'] '+Object.keys(results).length+' from cache');

  let fetched=0, skipped=0, failed=0;
  for (let i=0; i<SECTORS.length; i++) {
    const [sector, webId] = SECTORS[i];
    const cf = join(DB_DIR, 'sec-'+sector+'.json');
    if (existsSync(cf)) {
      const c = readJ(cf);
      if (c && c.data && c.data.length>0 && Date.now()-(c.time||0)<21600000) {
        const arr=c.data, last=arr[arr.length-1], prev=arr.length>1?arr[arr.length-2]:last;
        const cl=last.close, pcp=prev.close>0?Math.round(((cl-prev.close)/prev.close)*10000)/100:0;
        results[sector]={close:cl,pcp,date:'',webId};
        console.log('['+new Date().toISOString()+'] ['+(i+1)+'/'+SECTORS.length+'] '+sector+': cached');
        skipped++; continue;
      }
    }
    console.log('['+new Date().toISOString()+'] ['+(i+1)+'/'+SECTORS.length+'] Fetching '+sector+'...');
    try {
      const r = await zai.functions.invoke('page_reader', {url:'http://cdn.tsetmc.com/api/Index/GetIndexB2History/'+webId});
      if (r.code!==200||!r.data?.html) { console.warn('  API error '+r.code); failed++; if(i<SECTORS.length-1) await sleep(DELAY); continue; }
      const html=r.data.html;
      const m=/<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
      if(!m){console.warn('  no <pre>'); failed++; if(i<SECTORS.length-1) await sleep(DELAY); continue;}
      const js=m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
      const items=JSON.parse(js).indexB2||[];
      const valid=items.filter(x=>Number(x.xNivInuClMresIbs)>0);
      if(!valid.length){console.warn('  no valid'); failed++; if(i<SECTORS.length-1) await sleep(DELAY); continue;}
      const last=valid[valid.length-1], prev=valid.length>1?valid[valid.length-2]:last;
      const close=Number(last.xNivInuClMresIbs), pc=Number(prev.xNivInuClMresIbs);
      const pcp=pc>0?Math.round(((close-pc)/pc)*10000)/100:0;
      results[sector]={close,pcp,date:String(last.dEven||''),webId};
      fetched++;
      writeJ(join(DB_DIR,'sector-latest.json'),{data:results,time:Date.now()});
      console.log('['+new Date().toISOString()+'] ['+(i+1)+'/'+SECTORS.length+'] '+sector+': '+close.toLocaleString()+' ('+pcp+'%)');
    } catch(e) {
      const msg=e?.message||String(e);
      console.warn('['+new Date().toISOString()+'] ['+(i+1)+'/'+SECTORS.length+'] '+sector+': '+msg.slice(0,100));
      failed++;
    }
    if(i<SECTORS.length-1) await sleep(DELAY);
  }
  writeJ(join(DB_DIR,'sector-latest.json'),{data:results,time:Date.now()});
  console.log('\n['+new Date().toISOString()+'] DONE: '+fetched+' fetched, '+skipped+' cached, '+failed+' failed, '+Object.keys(results).length+'/40');
}
main().catch(e=>{console.error('Fatal:',e);process.exit(1);});
