// Vercel Serverless Function — 데이터 동기화 (Upstash Redis REST API)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: 'Redis가 연결되지 않았습니다' });
  }

  const headers = { Authorization: `Bearer ${REDIS_TOKEN}` };

  try {
    // GET /api/data?col=instructors
    if (req.method === 'GET') {
      const col = req.query.col;
      if (!col) return res.status(400).json({ error: 'col 파라미터 필요' });

      const r = await fetch(`${REDIS_URL}/get/hb_${col}`, { headers });
      const { result } = await r.json();
      return res.status(200).json(result ? JSON.parse(result) : []);
    }

    // POST /api/data  { col: 'instructors', data: [...] }
    if (req.method === 'POST') {
      const { col, data } = req.body || {};
      if (!col) return res.status(400).json({ error: 'col 파라미터 필요' });

      const r = await fetch(`${REDIS_URL}/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', `hb_${col}`, JSON.stringify(data)]),
      });
      await r.json();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Redis 오류:', err);
    return res.status(500).json({ error: err.message });
  }
}
