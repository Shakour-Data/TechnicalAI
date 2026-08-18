import { createServer } from 'node:http';
import ZAI from 'z-ai-web-dev-sdk';

const zai = await ZAI.create();
const r = await zai.functions.invoke('page_reader', { url: 'http://cdn.tsetmc.com/api/Index/GetIndexB2History/32097828799138957' });
console.log('INIT htmlLen:', r.data?.html?.length || 0);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:3033');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/test') {
    const r2 = await zai.functions.invoke('page_reader', { url: 'http://cdn.tsetmc.com/api/Index/GetIndexB2History/32097828799138957' });
    res.end(JSON.stringify({htmlLen: r2.data?.html?.length || 0}));
  } else {
    res.end('ok');
  }
});
server.listen(3033, () => console.log('Test server on 3033'));
