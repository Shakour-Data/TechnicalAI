import ZAI from 'z-ai-web-dev-sdk';
import { writeFileSync } from 'fs';
const zai = await ZAI.create();
const r = await zai.functions.invoke('page_reader', { url: 'http://cdn.tsetmc.com/api/Index/GetIndexB2History/32097828799138957' });
const len = r.data?.html?.length || 0;
console.log('htmlLen:', len);
writeFileSync('/tmp/zai_test_result2.json', JSON.stringify({len, htmlPreview: (r.data?.html||'').substring(0,300)}));
