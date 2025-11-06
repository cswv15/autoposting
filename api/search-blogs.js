const axios = require('axios');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.status(400).json({ 
        success: false,
        error: '키워드를 입력해주세요' 
      });
    }

    console.log(`[AutoPosting] 키워드 검색 시작: ${keyword}`);

    const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
      params: {
        query: keyword,
        display: 3,
        sort: 'sim'
      },
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
      },
      timeout: 10000
    });

    const blogs = response.data.items.map((item, index) => ({
      rank: index + 1,
      title: item.title.replace(/<[^>]*>/g, '').trim(),
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, '').trim(),
      bloggername: item.bloggername,
      postdate: item.postdate
    }));

    console.log(`[AutoPosting] ${blogs.length}개 블로그 검색 완료`);

    return res.status(200).json({
      success: true,
      keyword: keyword,
      totalCount: response.data.total,
      blogs: blogs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 검색 오류:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: '네이버 API 오류',
        details: error.response.data,
        hint: 'Client ID와 Secret을 확인해주세요'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
