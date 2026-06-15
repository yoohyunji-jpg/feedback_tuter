// Vercel Serverless Function — 카카오 알림톡 발송 (Solapi)
import crypto from 'crypto';

const SOLAPI_KEY    = process.env.SOLAPI_KEY;
const SOLAPI_SECRET = process.env.SOLAPI_SECRET;
const KAKAO_CHANNEL = process.env.KAKAO_CHANNEL_ID; // @헬스엔젤스필라테스옥련점

// Solapi HMAC 인증 헤더 생성
function makeAuthHeader() {
  const date    = new Date().toISOString();
  const salt    = Math.random().toString(36).slice(2, 12);
  const hmac    = crypto.createHmac('sha256', SOLAPI_SECRET);
  hmac.update(date + salt);
  const signature = hmac.digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, phone, params } = req.body;

  // 템플릿 ID는 심사 완료 후 채워야 해요
  const TEMPLATE_IDS = {
    feedback: process.env.TEMPLATE_ID_FEEDBACK,  // 오늘의 피드백
    monthly:  process.env.TEMPLATE_ID_MONTHLY,   // 월간 리포트
  };

  const templateId = TEMPLATE_IDS[type];
  if (!templateId) return res.status(400).json({ error: '알 수 없는 템플릿 타입' });

  // 파라미터 구성
  let variables = {};
  if (type === 'feedback') {
    variables = {
      '#{이름}':    params.name,
      '#{레벨}':    String(params.level),
      '#{날짜}':    params.date,
      '#{잘한항목}': params.goodName,
      '#{다음항목}': params.nextName,
    };
  } else if (type === 'monthly') {
    variables = {
      '#{이름}':     params.name,
      '#{횟수}':     String(params.count),
      '#{잘한항목1}': params.good[0] || '-',
      '#{잘한항목2}': params.good[1] || '-',
      '#{잘한항목3}': params.good[2] || '-',
      '#{다음항목1}': params.next[0] || '-',
      '#{다음항목2}': params.next[1] || '-',
      '#{다음항목3}': params.next[2] || '-',
    };
  }

  // Solapi 메시지 발송
  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': makeAuthHeader(),
      },
      body: JSON.stringify({
        message: {
          to: phone.replace(/\D/g, ''),
          from: process.env.SENDER_PHONE, // Solapi에 등록된 발신번호
          kakaoOptions: {
            pfId: KAKAO_CHANNEL,
            templateId: templateId,
            variables: variables,
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Solapi 오류:', data);
      return res.status(500).json({ error: data.errorMessage || '발송 실패' });
    }

    return res.status(200).json({ success: true, messageId: data.messageId });

  } catch (err) {
    console.error('서버 오류:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
