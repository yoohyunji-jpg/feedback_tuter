// Vercel Serverless Function — 데이터 동기화 (Vercel KV)
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET /api/data?col=instructors  → 해당 컬렉션 데이터 반환
    if (req.method === 'GET') {
      const col = req.query.col;
      if (!col) return res.status(400).json({ error: 'col 파라미터 필요' });
      const data = await kv.get(`hb_${col}`);
      return res.status(200).json(data ?? []);
    }

    // POST /api/data  { col: 'instructors', data: [...] }  → 저장
    if (req.method === 'POST') {
      const { col, data } = req.body || {};
      if (!col) return res.status(400).json({ error: 'col 파라미터 필요' });
      await kv.set(`hb_${col}`, data);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('KV 오류:', err);
    // KV 미설정 시 graceful fallback
    if (err.message?.includes('KV_') || err.message?.includes('kv')) {
      return res.status(503).json({ error: 'KV_NOT_CONFIGURED', message: 'Vercel KV가 연결되지 않았습니다' });
    }
    return res.status(500).json({ error: err.message });
  }
}
