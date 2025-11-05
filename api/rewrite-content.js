const OpenAI = require('openai');

/**
 * ChatGPT를 이용한 블로그 콘텐츠 재작성
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { keyword, contents, targetLength = 1500 } = req.body;

    if (!keyword || !contents || contents.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: '키워드와 참고 콘텐츠가 필요합니다' 
      });
    }

    console.log(`[AutoPosting] 재작성 시작: ${keyword} (${contents.length}개 참고)`);

    // 3개의 블로그 글을 하나의 프롬프트로 구성
    const contentsText = contents.map((item, index) => {
      // 너무 긴 내용은 잘라내기 (토큰 절약)
      const trimmedContent = item.content.substring(0, 2000);
      return `=== 참고자료 ${index + 1} ===\n${trimmedContent}\n`;
    }).join('\n\n');

    // ChatGPT API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 비용 효율적
      messages: [
        {
          role: 'system',
          content: `당신은 전문 블로그 콘텐츠 작가입니다. 
주어진 여러 블로그 글을 참고하여 완전히 새로운 스타일로 재작성하는 것이 당신의 임무입니다.

중요 규칙:
1. 절대 원문을 그대로 복사하지 마세요
2. 문장 구조, 표현 방식을 완전히 바꾸세요
3. 새로운 예시나 설명을 추가해도 좋습니다
4. 자연스러운 한국어로 작성하세요
5. 블로그 글 형식으로 친근하게 작성하세요
6. 목표 길이: 약 ${targetLength}자

구조:
- 도입부: 독자의 관심을 끄는 질문이나 공감 (2-3문장)
- 본문: 핵심 내용 3-5가지 포인트를 소제목과 함께
- 마무리: 실천 방법이나 요약 (2-3문장)

톤 앤 매너: 친근하고 실용적이며, 독자에게 도움이 되는 조언 제공`
        },
        {
          role: 'user',
          content: `키워드: "${keyword}"

다음 블로그 글들을 참고하여 "${keyword}"에 대한 완전히 새로운 블로그 글을 작성해주세요:

${contentsText}

위 내용을 참고하되, 완전히 다른 문체와 구조로 새로운 블로그 글을 작성해주세요.
독자가 실제로 도움받을 수 있는 실용적인 내용으로 작성해주세요.`
        }
      ],
      temperature: 0.8,        // 창의성
      max_tokens: 2500,        // 충분한 길이
      presence_penalty: 0.6,   // 반복 줄임
      frequency_penalty: 0.6   // 다양한 표현
    });

    const rewrittenContent = completion.choices[0].message.content;

    console.log(`[AutoPosting] 재작성 완료: ${rewrittenContent.length}자, 토큰: ${completion.usage.total_tokens}`);

    return res.status(200).json({
      success: true,
      keyword: keyword,
      originalCount: contents.length,
      rewrittenContent: rewrittenContent,
      wordCount: rewrittenContent.length,
      tokensUsed: completion.usage.total_tokens,
      model: completion.model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 재작성 오류:', error.message);
    
    // OpenAI API 에러 처리
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: 'OpenAI API 오류',
        details: error.response.data,
        hint: 'API Key를 확인해주세요'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
