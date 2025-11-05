const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        success: false,
        error: 'URL을 입력해주세요' 
      });
    }

    console.log(`[AutoPosting] 스크래핑 시작: ${url}`);

    let content = '';
    let method = 'basic';

    // 일반 HTTP 요청
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    // 신규 에디터 (SE3)
    content = $('.se-main-container').text();
    
    // 구버전 스마트에디터
    if (!content || content.length < 50) {
      content = $('#postViewArea').text();
    }

    // 텍스트 정제
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (content.length < 100) {
      return res.status(400).json({
        success: false,
        error: '본문 내용이 너무 짧거나 추출할 수 없습니다',
        contentLength: content.length,
        url: url
      });
    }

    console.log(`[AutoPosting] 스크래핑 완료: ${content.length}자 (${method})`);

    return res.status(200).json({
      success: true,
      url: url,
      content: content,
      contentLength: content.length,
      method: method,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 스크래핑 오류:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      url: req.body.url
    });
  }
};
