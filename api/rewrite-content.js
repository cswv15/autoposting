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
    const { 
      searchKeyword,        // 네이버 검색용 키워드
      titleKeyword1 = '',   // 제목 키워드 1
      titleKeyword2 = '',   // 제목 키워드 2
      titleKeyword3 = '',   // 제목 키워드 3
      contents, 
      targetLength = 1500,  // 목표 글자수
      companyInfo = ''      // 업체 특성
    } = req.body;

    // 검증
    if (!searchKeyword || !contents || contents.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: '검색 키워드와 참고 콘텐츠가 필요합니다' 
      });
    }

    // 제목 키워드 정리
    const titleKeywords = [titleKeyword1, titleKeyword2, titleKeyword3]
      .filter(k => k && k.trim().length > 0);

    console.log(`[AutoPosting] 재작성 시작`);
    console.log(`- 검색 키워드: ${searchKeyword}`);
    console.log(`- 제목 키워드: ${titleKeywords.join(', ')}`);
    console.log(`- 목표 글자수: ${targetLength}자 (최대 ${Math.floor(targetLength * 1.2)}자)`);
    console.log(`- 업체 특성: ${companyInfo ? '있음' : '없음'}`);

    const contentsText = contents.map((item, index) => {
      const trimmedContent = item.content.substring(0, 2000);
      return `=== 참고자료 ${index + 1} ===\n${trimmedContent}\n`;
    }).join('\n\n');

    // 제목 키워드 안내 문구
    const titleKeywordInstruction = titleKeywords.length > 0
      ? `\n\n제목 작성 규칙:
- 다음 키워드들을 제목에 자연스럽게 포함해야 합니다: ${titleKeywords.map(k => `"${k}"`).join(', ')}
- 키워드를 억지로 나열하지 말고, 자연스러운 문장으로 만드세요
- 제목은 클릭을 유도할 수 있도록 매력적으로 작성하세요
- 제목 예시: "${titleKeywords[0]}${titleKeywords[1] ? ' ' + titleKeywords[1] : ''}, 이것만 알면 됩니다"`
      : '';

    // 시스템 프롬프트
    const systemPrompt = `당신은 전문 블로그 콘텐츠 작가입니다. 
주어진 여러 블로그 글을 참고하여 완전히 새로운 스타일로 재작성하는 것이 당신의 임무입니다.

핵심 규칙:
1. 절대 원문을 그대로 복사하지 마세요
2. 문장 구조, 표현 방식을 완전히 바꾸세요
3. 자연스러운 한국어로 작성하세요
4. 블로그 글 형식으로 친근하게 작성하세요

글자수 제약 (매우 중요!):
- 목표: ${targetLength}자 (공백 제외)
- 최소: ${targetLength}자 (절대 이보다 짧으면 안됨!)
- 최대: ${Math.floor(targetLength * 1.2)}자 (이를 초과하면 안됨!)
- 공백은 글자수에 포함하지 않습니다
${titleKeywordInstruction}

구조:
- 제목: 흥미롭고 클릭을 유도하는 제목 (위의 키워드 포함)
- 도입부: 독자의 관심을 끄는 질문이나 공감 (2-3문장)
- 본문: 핵심 내용을 소제목과 함께 전개
  ${companyInfo ? '* 업체 정보는 본문 중간이나 후반부에 자연스럽게 녹여내기' : ''}
  * 글자수를 맞추기 위해 내용을 충분히 풍부하게 작성
- 마무리: 실천 방법이나 요약 (2-3문장)${companyInfo ? ', 필요시 방문/문의 유도' : ''}

톤 앤 매너: 친근하고 실용적이며, 독자에게 도움이 되는 조언 제공
${companyInfo ? '\n업체 정보 처리: 광고처럼 노골적이지 않게, 정보 제공 맥락에서 자연스럽게 언급' : ''}`;

    // 사용자 프롬프트
    const userPrompt = `검색 키워드: "${searchKeyword}"
${titleKeywords.length > 0 ? `제목에 포함할 키워드: ${titleKeywords.map(k => `"${k}"`).join(', ')}` : ''}
${companyInfo ? `\n업체/브랜드 특성:\n${companyInfo}\n` : ''}
다음 블로그 글들을 참고하여 "${searchKeyword}"에 대한 완전히 새로운 블로그 글을 작성해주세요:

${contentsText}

중요 지침:
1. 반드시 제목부터 작성하세요 (위의 키워드 포함)
2. 공백 제외 ${targetLength}자 이상, ${Math.floor(targetLength * 1.2)}자 이하로 작성하세요
3. 글자수가 부족하면 더 자세한 설명과 예시를 추가하세요
4. 독자에게 실질적으로 도움이 되는 내용으로 작성하세요
${companyInfo ? '5. 업체 특성은 자연스럽게 녹여내세요' : ''}`;

    // ChatGPT API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 3500, // 글자수 늘어날 수 있으니 여유있게
      presence_penalty: 0.6,
      frequency_penalty: 0.6
    });

    const rewrittenContent = completion.choices[0].message.content;
    
    // 공백 제외 글자수 계산
    const contentWithoutSpaces = rewrittenContent.replace(/\s/g, '');
    const actualLength = contentWithoutSpaces.length;
    
    // 글자수 검증
    const isLengthValid = actualLength >= targetLength && actualLength <= Math.floor(targetLength * 1.2);

    console.log(`[AutoPosting] 재작성 완료`);
    console.log(`- 총 글자수: ${rewrittenContent.length}자`);
    console.log(`- 공백 제외: ${actualLength}자`);
    console.log(`- 목표 범위: ${targetLength}~${Math.floor(targetLength * 1.2)}자`);
    console.log(`- 범위 충족: ${isLengthValid ? 'O' : 'X'}`);
    console.log(`- 토큰 사용: ${completion.usage.total_tokens}`);

    return res.status(200).json({
      success: true,
      searchKeyword: searchKeyword,
      titleKeywords: titleKeywords,
      targetLength: targetLength,
      companyInfo: companyInfo || null,
      originalCount: contents.length,
      rewrittenContent: rewrittenContent,
      wordCount: rewrittenContent.length,
      wordCountNoSpaces: actualLength,
      isLengthValid: isLengthValid,
      lengthRange: {
        min: targetLength,
        max: Math.floor(targetLength * 1.2),
        actual: actualLength
      },
      tokensUsed: completion.usage.total_tokens,
      model: completion.model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AutoPosting] 재작성 오류:', error.message);
    
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
};
