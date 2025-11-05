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
    console.log('[AutoPosting] 요청 메서드:', req.method);
    console.log('[AutoPosting] req.query:', JSON.stringify(req.query));
    console.log('[AutoPosting] req.body:', JSON.stringify(req.body));

    // GET/POST 둘 다 안전하게 처리
    let keyword;
    let count = 3;

    if (req.method === 'GET') {
      keyword = req.query?.keyword;
      count = parseInt(req.query?.count) || 3;
    } else if (req.method === 'POST') {
      keyword = req.body?.keyword;
      count = req.body?.count || 3;
    }

    console.log(`[AutoPosting] keyword: ${keyword}, count: ${count}`);

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: '검색 키워드를 입력해주세요',
        debug: {
          method: req.method,
          query: req.query,
          body: req.body
        }
      });
    }

    console.log(`[AutoPosting] 블로그 검색: ${keyword}, 개수: ${count}`);

    // 네이버 블로그 검색 API 호출
    const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
      params: {
        query: keyword,
        display: 20, // 20개 가져와서 필터링
        sort: 'sim' // 정확도순
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

    // 네이버 블로그 URL만 필터링
    const naverBlogItems = response.data.items.filter(item => {
      const url = item.link;
      return url.includes('blog.naver.com') || url.includes('m.blog.naver.com');
    });

    console.log(`[AutoPosting] 전체 검색 결과: ${response.data.items.length}개`);
    console.log(`[AutoPosting] 네이버 블로그만: ${naverBlogItems.length}개`);

    if (naverBlogItems.length === 0) {
      return res.status(404).json({
        success: false,
        error: '네이버 블로그 검색 결과가 없습니다'
      });
    }

    // 상위 N개만 선택
    const selectedBlogs = naverBlogItems.slice(0, count);

    // 모바일 URL을 PC URL로 변환
    const blogs = selectedBlogs.map(item => {
      let url = item.link;
      
      // m.blog.naver.com을 blog.naver.com으로 변환
      if (url.includes('m.blog.naver.com')) {
        url = url.replace('m.blog.naver.com', 'blog.naver.com');
      }
      
      return {
        title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        url: url,
        description: item.description.replace(/<[^>]*>/g, ''),
        bloggerName: item.bloggername,
        postDate: item.postdate
      };
    });

    console.log(`[AutoPosting] ${blogs.length}개 블로그 검색 완료`);
    blogs.forEach((blog, index) => {
      console.log(`  [${index + 1}] ${blog.url}`);
    });

    return res.status(200).json({
      success: true,
      keyword: keyword,
      totalCount: response.data.total,
      naverBlogCount: naverBlogItems.length,
      returnedCount: blogs.length,
      blogs: blogs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 블로그 검색 오류:', error.message);
    console.error('[AutoPosting] Stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
