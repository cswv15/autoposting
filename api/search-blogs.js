const axios = require('axios');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET/POST 둘 다 지원
    const keyword = req.method === 'GET' ? req.query.keyword : req.body?.keyword;
    const count = req.method === 'GET' ? (parseInt(req.query.count) || 3) : (req.body?.count || 3);

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: '검색 키워드를 입력해주세요'
      });
    }

    console.log(`[AutoPosting] 블로그 검색: ${keyword}, 개수: ${count}`);

    // 네이버 블로그 검색 API 호출
    const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
      params: {
        query: keyword,
        display: count,
        sort: 'sim'
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({
        success: false,
        error: '검색 결과가 없습니다'
      });
    }

    // 모바일 URL을 PC URL로 변환
    const blogs = response.data.items.map(item => {
      let url = item.link;
      
      if (url.includes('m.blog.naver.com')) {
        url = url.replace('m.blog.naver.com', 'blog.naver.com');
      }
      
      return {
        title: item.title.replace(/<[^>]*>/g, ''),
        url: url,
        description: item.description.replace(/<[^>]*>/g, ''),
        bloggerName: item.bloggername,
        postDate: item.postdate
      };
    });

    console.log(`[AutoPosting] ${blogs.length}개 블로그 검색 완료`);

    return res.status(200).json({
      success: true,
      keyword: keyword,
      totalCount: response.data.total,
      returnedCount: blogs.length,
      blogs: blogs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 블로그 검색 오류:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
