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
      subKeyword = '',
      bodyKeyword1 = '',
      bodyKeyword2 = '',
      bodyKeyword3 = '',
      companyName = '',
      contents, 
      companyInfo: rawCompanyInfo = '',
      customPrompt = ''
    } = req.body;

    // 고정된 목표 글자수: 공백 포함 2500자
    const targetLength = 2500;

    // companyInfo에서 줄바꿈 제거
    const companyInfo = rawCompanyInfo ? rawCompanyInfo.replace(/[\r\n]+/g, ' ').trim() : '';
    console.log('[AutoPosting] companyName:', companyName);
    console.log('[AutoPosting] searchKeyword:', searchKeyword);
    console.log('[AutoPosting] subKeyword:', subKeyword);
    console.log('[AutoPosting] bodyKeywords:', bodyKeyword1, bodyKeyword2, bodyKeyword3);

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

    console.log(`[AutoPosting] 재작성 시작 - 목표 길이: ${targetLength}자 (공백 포함)`);

    // 블로그 본문 결합
    const combinedContent = contentsArray
      .map((item, index) => `[상위노출 성공 블로그 ${index + 1}]\n${item.content || item.text || ''}`)
      .join('\n\n---\n\n');

    console.log(`[AutoPosting] 결합된 본문 길이: ${combinedContent.length}자`);

    // 본문 키워드 정리
    const bodyKeywords = [bodyKeyword1, bodyKeyword2, bodyKeyword3]
      .filter(k => k && k.trim())
      .join(', ');

    // 커스텀 프롬프트가 있으면 사용, 없으면 기본 프롬프트
    let prompt;
    let systemMessage;

    if (customPrompt && customPrompt.trim()) {
      // 사용자가 입력한 커스텀 프롬프트 사용
      console.log('[AutoPosting] 커스텀 프롬프트 사용');
      
      systemMessage = `SEO에 최적화된 고품질 블로그 콘텐츠를 작성하는 전문 작가입니다. 반드시 공백 포함 ${targetLength}자 이상의 긴 글을 작성해야 합니다.`;
      const companyInfoText = companyInfo ? `\n\n업체 특성: ${companyInfo}` : '';
      
      // 변수 치환
      prompt = customPrompt
        .replace(/\{searchKeyword\}/g, searchKeyword)
        .replace(/\{subKeyword\}/g, subKeyword)
        .replace(/\{bodyKeywords\}/g, bodyKeywords)
        .replace(/\{companyName\}/g, companyName)
        .replace(/\{targetLength\}/g, targetLength)
        .replace(/\{contentsCount\}/g, contentsArray.length)
        .replace(/\{companyInfo\}/g, companyInfoText)
        .replace(/\{combinedContent\}/g, combinedContent);
        
    } else {
      // 기본 프롬프트
      console.log('[AutoPosting] 기본 프롬프트 사용');
      
      if (companyName && companyInfo) {
        // 업체명과 특성이 모두 있을 때
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다. "${companyName}" 업체를 홍보하는 공백 포함 ${targetLength}자 이상의 긴 블로그 글을 작성합니다. 다른 가게 이야기는 절대 하지 않습니다.`;
        
        prompt = `🎯 **핵심 미션**: "${companyName}" 업체를 홍보하는 공백 포함 ${targetLength}자 이상의 블로그 글 작성!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 **필수 글자수**: 공백 포함 ${targetLength}자 이상! (짧으면 안 됨!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 **홍보할 업체** (이 업체만 이야기하세요!):
**업체명**: "${companyName}"
**업체 특성**: "${companyInfo}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 **키워드 전략**:

📌 **제목에 반드시 포함** (이것만!):
- "${searchKeyword}" (검색 키워드)
- "${companyName}" (업체명)
${subKeyword ? `- "${subKeyword}" (서브 키워드)` : ''}

📝 **본문에 자연스럽게 포함** (각 2~3회):
- "${searchKeyword}" (검색 키워드)
- "${companyName}" (업체명, 5회 이상!)
${subKeyword ? `- "${subKeyword}" (서브 키워드)` : ''}
${bodyKeyword1 ? `- "${bodyKeyword1}" (본문 키워드 1)` : ''}
${bodyKeyword2 ? `- "${bodyKeyword2}" (본문 키워드 2)` : ''}
${bodyKeyword3 ? `- "${bodyKeyword3}" (본문 키워드 3)` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 **"${searchKeyword}" 상위노출 성공 블로그들** (스타일만 참고):

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **작성 규칙**:

🚨 **가장 중요**:
1. "${companyName}" 업체만 이야기하세요!
2. 다른 가게 이름은 절대 언급 금지!
3. 가상의 가게 만들지 마세요!
4. "${companyName}"를 글 전체에서 5회 이상 자연스럽게 언급!

📋 **구조** (각 섹션별 최소 글자수):

**제목** (30자 이내):
- 반드시 포함: "${searchKeyword}", "${companyName}"${subKeyword ? `, "${subKeyword}"` : ''}
- 예시: "${searchKeyword} 추천, ${companyName}${subKeyword ? ` ${subKeyword}` : ''} 솔직 후기"
- 본문 키워드는 제목에 넣지 마세요!

**서론** (최소 300자):
- "${companyName}" 소개
- 위치와 첫인상
- 방문 계기
- "${searchKeyword}"${subKeyword ? ` 및 "${subKeyword}"` : ''} 자연스럽게 언급

**본론 1: "${companyName}"의 시그니처 메뉴** (최소 500자):
- "${companyInfo}"에 나온 메뉴 상세 설명
- 맛, 식감, 향, 비주얼 구체적으로
${bodyKeyword1 ? `- "${bodyKeyword1}" 키워드 자연스럽게 포함` : ''}
- 가격대, 양, 추천 이유

**본론 2: "${companyName}"의 다른 메뉴들** (최소 400자):
- "${companyInfo}"의 다른 메뉴들
${bodyKeyword2 ? `- "${bodyKeyword2}" 키워드 자연스럽게 포함` : ''}
- 각 메뉴별 특징
- 메뉴 조합 추천

**본론 3: "${companyName}"의 분위기** (최소 400자):
- "${companyInfo}"에 나온 분위기 묘사
${bodyKeyword3 ? `- "${bodyKeyword3}" 키워드 자연스럽게 포함` : ''}
- 인테리어, 좌석 배치
- 어떤 손님에게 적합한지

**본론 4: "${companyName}" 방문 팁** (최소 300자):
- 위치 및 찾아가는 법
- 주차 정보
- 추천 시간대
- "${searchKeyword}"${subKeyword ? ` 중 "${subKeyword}"` : ''} 언급

**결론** (최소 200자):
- "${companyName}" 총평
- "${searchKeyword}" 관련 마무리
- 재방문 의향
- 댓글 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 **키워드 사용 팁**:
- 키워드를 자연스럽게 문장에 녹여내세요
- 억지로 넣지 말고 맥락에 맞게 사용
- 제목 키워드와 본문 키워드를 섞지 마세요
- 각 본문 키워드를 골고루 분산 배치

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **최종 체크리스트**:
☑️ 공백 포함 ${targetLength}자 이상
☑️ 제목: "${searchKeyword}" + "${companyName}"${subKeyword ? ` + "${subKeyword}"` : ''} 포함
☑️ "${companyName}" 5회 이상 언급
☑️ 본문 키워드 자연스럽게 분산
☑️ "${companyInfo}"의 정보만 사용
☑️ 다른 가게 이름 절대 언급 안 함
☑️ 상위노출 스타일 반영

🔥 지금 바로 "${companyName}"에 대한 ${targetLength}자 이상의 긴 블로그 글을 작성하세요!`;

      } else {
        // 업체명이나 특성이 없을 때
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다. 공백 포함 ${targetLength}자 이상의 긴 블로그 글을 작성합니다.`;
        
        prompt = `🎯 **미션**: "${searchKeyword}"에 대한 공백 포함 ${targetLength}자 이상의 블로그 글 작성!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 **필수 글자수**: 공백 포함 ${targetLength}자 이상!

🔑 **검색 키워드**: ${searchKeyword}
${subKeyword ? `📌 **서브 키워드**: ${subKeyword}` : ''}
${bodyKeywords ? `📝 **본문 키워드**: ${bodyKeywords}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 **상위노출 성공 블로그들** (스타일 참고):

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **작성 방법**:

**제목**: "${searchKeyword}"${subKeyword ? ` + "${subKeyword}"` : ''} 포함

**본문**: 
- 위 블로그들의 스타일 분석
- 핵심 정보를 종합하여 새로운 글 작성
- 각 섹션을 충분히 길고 상세하게
- 본문 키워드 자연스럽게 분산 배치

📋 **구조** (각 섹션 최소 글자수):
- 서론 (300자)
- 본론 섹션 1 (500자)
- 본론 섹션 2 (500자)
- 본론 섹션 3 (500자)
- 본론 섹션 4 (400자)
- 결론 (200자)

🔥 공백 포함 ${targetLength}자 이상 필수! 지금 작성하세요!`;
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
    const isLengthValid = wordCount >= targetLength * 0.9; // 공백 포함 기준

    console.log(`[AutoPosting] 재작성 완료: ${wordCount}자 (공백 제외: ${wordCountNoSpaces}자)`);
    console.log(`[AutoPosting] 목표: ${targetLength}자 (공백 포함), 달성: ${isLengthValid}`);

    return res.status(200).json({
      success: true,
      searchKeyword: searchKeyword,
      subKeyword: subKeyword,
      bodyKeywords: bodyKeywords,
      companyName: companyName,
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
