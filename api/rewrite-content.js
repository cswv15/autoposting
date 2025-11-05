const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('[AutoPosting] 받은 req.body:', JSON.stringify(req.body).substring(0, 500));

    const { 
      searchKeyword,
      titleKeyword1 = '',
      titleKeyword2 = '',
      titleKeyword3 = '',
      contents, 
      targetLength = 1500,
      companyInfo = ''
    } = req.body;

    // contents 검증 및 배열 변환
    if (!contents) {
      return res.status(400).json({
        success: false,
        error: 'contents가 필요합니다'
      });
    }

    // 배열이 아니면 배열로 변환
    const contentsArray = Array.isArray(contents) ? contents : [contents];
    console.log(`[AutoPosting] contents 개수: ${contentsArray.length}`);
    console.log(`[AutoPosting] contents 타입: ${typeof contents}, 배열 여부: ${Array.isArray(contents)}`);

    if (!searchKeyword) {
      return res.status(400).json({
        success: false,
        error: '검색 키워드를 입력해주세요'
      });
    }

    console.log(`[AutoPosting] 재작성 시작 - 키워드: ${searchKeyword}, 목표 길이: ${targetLength}자`);

    // 블로그 본문 결합
    const combinedContent = contentsArray
      .map((item, index) => `[블로그 ${index + 1}]\n${item.content || item.text || ''}`)
      .join('\n\n---\n\n');

    console.log(`[AutoPosting] 결합된 본문 길이: ${combinedContent.length}자`);

    // ChatGPT 프롬프트
    const titleKeywords = [titleKeyword1, titleKeyword2, titleKeyword3]
      .filter(k => k && k.trim())
      .join(', ');

    const companyInfoText = companyInfo ? `\n\n업체 특성: ${companyInfo}` : '';

    const prompt = `당신은 전문 블로그 작가입니다. 아래 ${contentsArray.length}개의 블로그 글을 참고하여, "${searchKeyword}"에 대한 새로운 블로그 글을 작성해주세요.

요구사항:
1. 목표 글자수: ${targetLength}자 (공백 포함)
2. 제목에 포함할 키워드: ${titleKeywords || searchKeyword}
3. ${contentsArray.length}개 블로그의 핵심 내용을 종합하되, 완전히 새로운 문장으로 작성
4. 자연스러운 한국어 표현 사용
5. 구체적인 예시와 설명 포함
6. SEO 최적화된 구조 (소제목 활용)${companyInfoText}

참고 블로그:
${combinedContent}

위 내용을 참고하여 ${targetLength}자 분량의 새로운 블로그 글을 작성해주세요. 제목도 함께 작성해주세요.`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 SEO에 최적화된 고품질 블로그 콘텐츠를 작성하는 전문 작가입니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const rewrittenContent = completion.choices[0].message.content;

    // 글자 수 계산
    const wordCount = rewrittenContent.length;
    const wordCountNoSpaces = rewrittenContent.replace(/\s/g, '').length;
    const isLengthValid = wordCount >= targetLength * 0.8 && wordCount <= targetLength * 1.2;

    console.log(`[AutoPosting] 재작성 완료: ${wordCount}자 (공백 제외: ${wordCountNoSpaces}자)`);

    return res.status(200).json({
      success: true,
      searchKeyword: searchKeyword,
      titleKeywords: titleKeywords,
      rewrittenContent: rewrittenContent,
      wordCount: wordCount,
      wordCountNoSpaces: wordCountNoSpaces,
      targetLength: targetLength,
      isLengthValid: isLengthValid,
      tokensUsed: completion.usage.total_tokens,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 재작성 오류:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
