const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const BUILDING_LABELS = {
  house: '단독주택',
  apt: '아파트',
  shop: '상가·사무실',
  hospital: '병원·의원',
  welfare: '복지관·요양시설',
  kinder: '유치원·어린이집',
  lodging: '숙박시설',
  restaurant: '식당',
  factory: '공장',
  etc: '기타',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, building, symptom } = req.body || {};

  if (!name || !phone || !building) {
    return res.status(400).json({ error: '필수 항목을 입력해 주세요.' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { error: dbError } = await supabase
    .from('consultations')
    .insert([{ name, phone, building, symptom: symptom || '' }]);

  if (dbError) {
    console.error('DB insert error:', dbError);
    return res.status(500).json({ error: '데이터 저장 중 오류가 발생했습니다.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const buildingLabel = BUILDING_LABELS[building] || building;
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  try {
    await transporter.sendMail({
      from: `"세척나라 상담알림" <${process.env.GMAIL_USER}>`,
      to: process.env.NOTIFY_EMAILS,
      subject: `[세척나라] 새 상담 신청 — ${name} / ${phone}`,
      text: [
        '새 무료 상담 신청이 접수되었습니다.',
        '',
        `이름      : ${name}`,
        `연락처    : ${phone}`,
        `건물 유형 : ${buildingLabel}`,
        `증상      : ${symptom || '(미입력)'}`,
        `접수 시각 : ${now}`,
        '',
        '— 세척나라 상담 관리 시스템',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;">
          <h2 style="color:#1a6fb5;border-bottom:2px solid #1a6fb5;padding-bottom:8px;">
            새 무료 상담 신청
          </h2>
          <table style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="padding:10px 12px;border:1px solid #ddd;background:#f5f8ff;font-weight:bold;width:110px;">이름</td>
              <td style="padding:10px 12px;border:1px solid #ddd;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #ddd;background:#f5f8ff;font-weight:bold;">연락처</td>
              <td style="padding:10px 12px;border:1px solid #ddd;">${phone}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #ddd;background:#f5f8ff;font-weight:bold;">건물 유형</td>
              <td style="padding:10px 12px;border:1px solid #ddd;">${buildingLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #ddd;background:#f5f8ff;font-weight:bold;">증상</td>
              <td style="padding:10px 12px;border:1px solid #ddd;">${symptom || '<span style="color:#aaa">(미입력)</span>'}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #ddd;background:#f5f8ff;font-weight:bold;">접수 시각</td>
              <td style="padding:10px 12px;border:1px solid #ddd;">${now}</td>
            </tr>
          </table>
          <p style="color:#999;font-size:12px;margin-top:20px;">세척나라 상담 관리 시스템</p>
        </div>
      `,
    });
  } catch (mailErr) {
    console.error('Email send error:', mailErr);
  }

  return res.status(200).json({ success: true });
};
