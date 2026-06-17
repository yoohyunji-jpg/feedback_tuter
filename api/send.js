// Vercel Serverless Function — 카카오 알림톡 발송 (Solapi)
import crypto from 'crypto';

const SOLAPI_KEY    = process.env.SOLAPI_KEY;
const SOLAPI_SECRET = process.env.SOLAPI_SECRET;
const KAKAO_CHANNEL = process.env.KAKAO_CHANNEL_ID;

// Solapi HMAC 인증 헤더 생성
function makeAuthHeader() {
  const date      = new Date().toISOString();
  const salt      = Math.random().toString(36).slice(2, 12);
  const hmac      = crypto.createHmac('sha256', SOLAPI_SECRET);
  hmac.update(date + salt);
  const signature = hmac.digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 환경변수 확인
  if (!SOLAPI_KEY || !SOLAPI_SECRET) {
    return res.status(500).json({ error: 'SOLAPI 환경변수 미설정' });
  }
  if (!KAKAO_CHANNEL) {
    return res.status(500).json({ error: 'KAKAO_CHANNEL_ID 환경변수 미설정' });
  }

  const { type, phone, params } = req.body || {};
  if (!type || !phone || !params) {
    return res.status(400).json({ error: '필수 파라미터 누락', received: { type, phone, hasParams: !!params } });
  }

  const TEMPLATE_IDS = {
    feedback: process.env.TEMPLATE_ID_FEEDBACK,
    monthly:  process.env.TEMPLATE_ID_MONTHLY,
    levelup:  process.env.TEMPLATE_ID_LEVELUP,
  };

  const templateId = TEMPLATE_IDS[type];
  if (!templateId) {
    return res.status(400).json({ error: `템플릿 ID 미설정: TEMPLATE_ID_${type.toUpperCase()}` });
  }

  // 변수 구성 — Solapi 템플릿 변수명과 정확히 일치해야 함
  let variables = {};
  if (type === 'feedback') {
    variables = {
      '#{이름}':    params.name    || '',
      '#{레벨}':    String(params.level || ''),
      '#{날짜}':    params.date    || '',
      '#{잘한항목}': params.goodName || '',
      '#{다음항목}': params.nextName || '',
    };
  } else if (type === 'monthly') {
    variables = {
      '#{이름}':     params.name        || '',
      '#{횟수}':     String(params.count || 0),
      '#{잘한항목1}': params.good?.[0]  || '-',
      '#{잘한항목2}': params.good?.[1]  || '-',
      '#{잘한항목3}': params.good?.[2]  || '-',
      '#{다음항목1}': params.next?.[0]  || '-',
      '#{다음항목2}': params.next?.[1]  || '-',
      '#{다음항목3}': params.next?.[2]  || '-',
    };
  } else if (type === 'levelup') {
    variables = {
      '#{이름}':     params.name           || '',
      '#{레벨}':     String(params.level   || ''),
      '#{단계}':     String(params.stage   || ''),
      '#{완료횟수}': String(params.done    || ''),
      '#{강사명}':   params.instructorName || '',
    };
  }

  const senderPhone = process.env.SENDER_PHONE || '';
  if (!senderPhone) {
    return res.status(500).json({ error: 'SENDER_PHONE 환경변수 미설정' });
  }

  const payload = {
    message: {
      to:   phone.replace(/\D/g, ''),
      from: senderPhone,
      kakaoOptions: {
        pfId:       KAKAO_CHANNEL,
        templateId: templateId,
        variables:  variables,
        disableSms: true,   // SMS 대체 발송 비활성화
      },
    },
  };

  console.log('Solapi 발송 요청:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': makeAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('Solapi 응답:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return res.status(500).json({
        error:   data.errorMessage || data.message || '발송 실패',
        code:    data.errorCode,
        detail:  data,
      });
    }

    return res.status(200).json({ success: true, messageId: data.messageId });

  } catch (err) {
    console.error('서버 오류:', err);
    return res.status(500).json({ error: err.message });
  }
}
