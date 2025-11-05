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
      targetLength = 2000,  // 기본값을 2000으로
      companyInfo: rawCompanyInfo = '',
      customPrompt = ''
    } = req.body;

    // companyInfo에서 줄바꿈 제거
    const companyInfo = rawCompanyInfo ? rawCompanyInfo.replace(/[\r\n]+/g, ' ').trim() : '';
    console.log('[AutoPosting] companyInfo (줄바꿈 제거 후):', companyInfo.substring(0, 100));

    // contents 검증
    if (!contents) {
      return res.status(400).json({
        success: false,
        error: 'contents가 필요합니다'
      });
    }

    // 배열이 아니면 배열로 변환
    let contentsArray = Array.isArray(contents) ? contents : [contents];
    console.log(`[AutoPosting] contents 초기 개수: ${contentsArray.length}`);

    // Make.com Array Aggregator 구조 처리
    if (contentsArray.length > 0 && contentsArray[0].Data) {
      console.log('[AutoPosting] Array Aggregator 형식 감지, Data 추출');
      contentsArray = contentsArray.map(item => item.Data);
    }

    console.log(`[AutoPosting] 최종 contents 개수: ${contentsArray.length}`);

    if (!searchKeyword) {
      return res.status(400).json({
        success: false,
        error: '검색 키워드를 입력해주세요'
      });
    }

    // targetLength는 공백 제외 기준으로 해석
    const minWordCountNoSpaces = Math.max(targetLength, 2000); // 최소 2000자 보장
    const minWordCountWithSpaces = Math.floor(minWordCountNoSpaces * 1.3); // 공백 포함은 약 1.3배

    console.log(`[AutoPosting] 재작성 시작 - 키워드: ${searchKeyword}, 목표 길이: ${minWordCountNoSpaces}자 (공백 제외)`);

    // 블로그 본문 결합
    const combinedContent = contentsArray
      .map((item, index) => `[상위노출 성공 블로그 ${index + 1}]\n${item.content || item.text || ''}`)
      .join('\n\n---\n\n');

    console.log(`[AutoPosting] 결합된 본문 길이: ${combinedContent.length}자`);

    // ChatGPT 프롬프트
    const titleKeywords = [titleKeyword1, titleKeyword2, titleKeyword3]
      .filter(k => k && k.trim())
      .join(', ');

    // 커스텀 프롬프트가 있으면 사용, 없으면 기본 프롬프트
    let prompt;
    let systemMessage;

    if (customPrompt && customPrompt.trim()) {
      // 사용자가 입력한 커스텀 프롬프트 사용
      console.log('[AutoPosting] 커스텀 프롬프트 사용');
      
      systemMessage = `SEO에 최적화된 고품질 블로그 콘텐츠를 작성하는 전문 작가입니다. 반드시 공백 제외 ${minWordCountNoSpaces}자 이상의 긴 글을 작성해야 합니다.`;
      const companyInfoText = companyInfo ? `\n\n업체 특성: ${companyInfo}` : '';
      
      // 변수 치환
      prompt = customPrompt
        .replace(/\{searchKeyword\}/g, searchKeyword)
        .replace(/\{titleKeywords\}/g, titleKeywords)
        .replace(/\{targetLength\}/g, minWordCountNoSpaces)
        .replace(/\{contentsCount\}/g, contentsArray.length)
        .replace(/\{companyInfo\}/g, companyInfoText)
        .replace(/\{combinedContent\}/g, combinedContent);
        
    } else {
      // 기본 프롬프트
      console.log('[AutoPosting] 기본 프롬프트 사용');
      
      if (companyInfo) {
        // 업체 특성이 있을 때
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다. 반드시 공백 제외 ${minWordCountNoSpaces}자 이상의 긴 글을 작성해야 합니다. 짧은 글은 절대 불가능합니다.`;
        
        prompt = `🚨 **긴급 필수 요구사항**: 공백 제외 ${minWordCountNoSpaces}자 이상 작성! 짧으면 안 됩니다!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 **글자수 요구사항** (가장 중요!):
- 공백 제외 최소 ${minWordCountNoSpaces}자 필수!
- 공백 포함 약 ${minWordCountWithSpaces}자
- ${minWordCountNoSpaces}자 미만은 절대 안 됨!
- 글자수를 채우기 위해 상세한 설명 필수!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 **작성할 업체 정보** (이것에 대해서만 글을 쓰세요!):
"${companyInfo}"

🔑 **검색 키워드**: ${searchKeyword}
📝 **제목 키워드**: ${titleKeywords || searchKeyword}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 **아래는 "${searchKeyword}" 키워드로 상위노출에 성공한 블로그 글들입니다:**

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **작성 구조** (각 섹션별 최소 글자수):

1. **제목** (30자 이내)
   - "${titleKeywords || searchKeyword}" 포함

2. **서론** (최소 200자):
   - 업체 소개
   - 방문 계기
   - 첫인상

3. **본론 - 메뉴 소개** (최소 1200자):
   각 메뉴마다 상세히:
   - 업체의 주요 메뉴 1 (최소 300자)
     * 메뉴 설명, 맛, 가격, 추천 이유
   - 업체의 주요 메뉴 2 (최소 300자)
     * 메뉴 설명, 맛, 가격, 추천 이유
   - 업체의 주요 메뉴 3 (최소 300자)
     * 메뉴 설명, 맛, 가격, 추천 이유
   - 기타 메뉴들 (최소 300자)

4. **본론 - 업체 특징** (최소 400자):
   - 분위기 묘사
   - 인테리어 설명
   - 서비스 품질
   - 위치 및 접근성

5. **본론 - 방문 팁** (최소 200자):
   - 추천 시간대
   - 주차 정보
   - 예약 방법
   - 메뉴 조합 추천

6. **결론** (최소 100자):
   - 총평
   - 재방문 의향
   - 추천 대상
   - 댓글 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **작성 시 주의사항**:

✅ **필수**:
- 공백 제외 ${minWordCountNoSpaces}자 이상 작성
- "${companyInfo}"의 정보만 사용
- 참고 블로그 가게 이름 절대 언급 금지
- 상위노출 스타일 반영
- 각 문단을 충분히 길고 상세하게

❌ **금지**:
- 짧은 글 (${minWordCountNoSpaces}자 미만)
- 참고 블로그의 가게 정보 사용
- 추상적이고 짧은 설명

💡 **글자수 채우기 팁**:
- 각 메뉴를 매우 상세히 묘사 (맛, 식감, 향, 비주얼)
- 방문 경험을 스토리텔링으로 길게 풀어쓰기
- 구체적인 수치 (가격, 크기, 시간 등) 포함
- 업주나 직원과의 대화 포함
- 주변 환경, 교통편 등 부가 정보

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 **다시 한번 강조**: 공백 제외 ${minWordCountNoSpaces}자 이상 필수!

지금 바로 긴 글을 작성하세요!`;

      } else {
        // 업체 특성이 없을 때
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다. 반드시 공백 제외 ${minWordCountNoSpaces}자 이상의 긴 글을 작성해야 합니다.`;
        
        prompt = `🚨 **필수**: 공백 제외 ${minWordCountNoSpaces}자 이상 작성!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 **글자수 요구사항**:
- 공백 제외 최소 ${minWordCountNoSpaces}자!
- 공백 포함 약 ${minWordCountWithSpaces}자
- 상세하고 구체적인 설명으로 목표 달성

🔑 **검색 키워드**: ${searchKeyword}
📝 **제목 키워드**: ${titleKeywords || searchKeyword}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 **상위노출 성공 블로그들**:

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **작성 방법**:

1. 위 블로그들의 스타일 분석
2. 핵심 정보를 종합하여 새로운 글 작성
3. 각 섹션을 충분히 길고 상세하게
4. 구체적인 예시와 팁 풍부하게

📋 **구조** (각 섹션 최소 글자수):
- 서론 (200자)
- 본론 섹션 1 (400자)
- 본론 섹션 2 (400자)
- 본론 섹션 3 (400자)
- 본론 섹션 4 (400자)
- 결론 (200자)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 공백 제외 ${minWordCountNoSpaces}자 이상 필수! 지금 작성하세요!`;
      }
    }

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 10000
    });

    const rewrittenContent = completion.choices[0].message.content;

    // 글자 수 계산
    const wordCount = rewrittenContent.length;
    const wordCountNoSpaces = rewrittenContent.replace(/\s/g, '').length;
    const isLengthValid = wordCountNoSpaces >= minWordCountNoSpaces * 0.9; // 공백 제외 기준으로 검증

    console.log(`[AutoPosting] 재작성 완료: ${wordCount}자 (공백 제외: ${wordCountNoSpaces}자)`);
    console.log(`[AutoPosting] 목표 글자수: ${minWordCountNoSpaces}자 (공백 제외), 달성 여부: ${isLengthValid}`);

    return res.status(200).json({
      success: true,
      searchKeyword: searchKeyword,
      titleKeywords: titleKeywords,
      rewrittenContent: rewrittenContent,
      wordCount: wordCount,
      wordCountNoSpaces: wordCountNoSpaces,
      targetLength: minWordCountNoSpaces, // 공백 제외 기준으로 반환
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
