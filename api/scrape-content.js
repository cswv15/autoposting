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

    // 네이버 블로그를 모바일 버전으로 변환
    let scrapingUrl = url;
    if (url.includes('blog.naver.com') && !url.includes('m.blog.naver.com')) {
      scrapingUrl = url.replace('blog.naver.com', 'm.blog.naver.com');
      console.log(`[AutoPosting] 모바일 버전 사용: ${scrapingUrl}`);
    }

    // 방법 1: Browserless.io 사용 (동적 콘텐츠 처리)
    if (process.env.BROWSERLESS_API_KEY) {
      try {
        method = 'browserless';
        console.log('[AutoPosting] Browserless 사용');
        
        const browserlessResponse = await axios.post(
          `https://production-sfo.browserless.io/scrape?token=${process.env.BROWSERLESS_API_KEY}`,
          {
            url: scrapingUrl,
            elements: [
              { selector: "#postList" },      // 모바일 네이버 블로그
              { selector: ".post_ct" },       // 모바일 네이버 블로그
              { selector: ".se-main-container" },  // PC 네이버 블로그
              { selector: "#postViewArea" },  // PC 네이버 블로그 구버전
              { selector: "body" }
            ],
            gotoOptions: {
              waitUntil: "load",
              timeout: 30000
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            timeout: 45000
          }
        );

        console.log('[AutoPosting] Browserless 응답 받음');

        // /scrape API는 구조화된 데이터를 반환
        if (browserlessResponse.data && browserlessResponse.data.data) {
          console.log(`[AutoPosting] data 배열 길이: ${browserlessResponse.data.data.length}`);
          
          for (const elementGroup of browserlessResponse.data.data) {
            if (elementGroup.results && elementGroup.results.length > 0) {
              const result = elementGroup.results[0];
              content = result.text || result.html || '';
              console.log(`[AutoPosting] 추출된 content 길이: ${content.length}`);
              
              if (content && content.length > 100) {
                break;
              }
            }
          }
        }

        console.log(`[AutoPosting] 최종 Browserless content 길이: ${content.length}`);

      } catch (browserlessError) {
        console.log(`[AutoPosting] Browserless 실패, 일반 방식으로 재시도: ${browserlessError.message}`);
        method = 'basic';
      }
    }

    // 방법 2: 일반 HTTP 요청 (Browserless 없을 때 또는 실패시)
    if (!content || content.length < 50) {
      method = 'basic';
      console.log('[AutoPosting] 일반 HTTP 요청 사용');
      
      const response = await axios.get(scrapingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      // 모바일 버전 selector 우선
      content = $('#postList').text() || 
                $('.post_ct').text() || 
                $('.se-main-container').text() || 
                $('#postViewArea').text() || 
                '';
    }

    // 텍스트 정제
    const fullLength = content.length;
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 2000); // 최대 2000자로 제한

    console.log(`[AutoPosting] 원본: ${fullLength}자 → 잘림 후: ${content.length}자`);

    // 최소 글자 수 체크
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
