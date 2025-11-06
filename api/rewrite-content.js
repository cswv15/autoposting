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
      companyName: rawCompanyName,
      subKeyword: rawSubKeyword,
      bodyKeyword1: rawBodyKeyword1,
      bodyKeyword2: rawBodyKeyword2,
      bodyKeyword3: rawBodyKeyword3,
      contents, 
      companyInfo: rawCompanyInfo,
      customPrompt
    } = req.body;

    // 고정된 목표 글자수: 공백 포함 3000자
    const targetLength = 3000;

    // "null" 문자열을 빈 문자열로 변환
    const companyName = (rawCompanyName === 'null' || rawCompanyName === null || !rawCompanyName) ? '' : String(rawCompanyName);
    const subKeyword = (rawSubKeyword === 'null' || rawSubKeyword === null || !rawSubKeyword) ? '' : String(rawSubKeyword);
    const bodyKeyword1 = (rawBodyKeyword1 === 'null' || rawBodyKeyword1 === null || !rawBodyKeyword1) ? '' : String(rawBodyKeyword1);
    const bodyKeyword2 = (rawBodyKeyword2 === 'null' || rawBodyKeyword2 === null || !rawBodyKeyword2) ? '' : String(rawBodyKeyword2);
    const bodyKeyword3 = (rawBodyKeyword3 === 'null' || rawBodyKeyword3 === null || !rawBodyKeyword3) ? '' : String(rawBodyKeyword3);

    // companyInfo에서 줄바꿈 제거
    const companyInfo = rawCompanyInfo ? rawCompanyInfo.replace(/[\r\n]+/g, ' ').trim() : '';
    
    console.log('[AutoPosting] searchKeyword:', searchKeyword);
    console.log('[AutoPosting] companyName:', companyName);
    console.log('[AutoPosting] subKeyword:', subKeyword);
    console.log('[AutoPosting] bodyKeywords:', bodyKeyword1, bodyKeyword2, bodyKeyword3);
    console.log('[AutoPosting] companyInfo:', companyInfo ? companyInfo.substring(0, 100) : '(없음)');

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

    // Make.com Array Aggregator 구조 처리 (대문자 Data만)
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
        .replace(/\{companyName\}/g, companyName)
        .replace(/\{subKeyword\}/g, subKeyword)
        .replace(/\{bodyKeywords\}/g, bodyKeywords)
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

📌 **제목에 반드시 포함** (이 3가지만!):
1. "${searchKeyword}" (검색 키워드)
2. "${companyName}" (업체명)
${subKeyword ? `3. "${subKeyword}" (서브 키워드)` : ''}

예시 제목: "${searchKeyword} 추천, ${companyName}${subKeyword ? ` ${subKeyword}` : ''} 솔직 후기"

📝 **본문에 자연스럽게 포함** (각 2~3회씩):
- "${searchKeyword}" (검색 키워드)
- "${companyName}" (업체명, 5회 이상!)
${subKeyword ? `- "${subKeyword}" (서브 키워드)` : ''}
${bodyKeyword1 ? `- "${bodyKeyword1}" (본문 키워드 1)` : ''}
${bodyKeyword2 ? `- "${bodyKeyword2}" (본문 키워드 2)` : ''}
${bodyKeyword3 ? `- "${bodyKeyword3}" (본문 키워드 3)` : ''}

⚠️ **중요**: 본문 키워드는 제목에 넣지 말고 본문에만 자연스럽게 배치!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 **"${searchKeyword}" 상위노출 성공 블로그들** (스타일만 참고):

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **네이버 블로그 상위노출 작성 규칙**:

🚨 **가장 중요**:
1. "${companyName}" 업체만 이야기하세요!
2. 다른 업체/브랜드 이름은 절대 언급 금지!
3. 가상의 업체를 만들지 마세요!
4. "${companyName}"를 글 전체에서 5회 이상 자연스럽게 언급!
5. 실제 경험한 것처럼 생생하고 구체적으로 작성!

📋 **구조** (각 섹션별 최소 글자수):

**제목** (30자 이내):
- 반드시 포함: "${searchKeyword}", "${companyName}"${subKeyword ? `, "${subKeyword}"` : ''}
- 본문 키워드는 제목에 넣지 마세요!
- 예시: "${searchKeyword} 추천 | ${companyName}${subKeyword ? ` ${subKeyword}` : ''} 후기"

**서론** (최소 400자):
- "${companyName}"을 알게 된 계기
- 첫인상과 기대감
- 위치/접근성 간단히 언급
- "${searchKeyword}"${subKeyword ? ` 및 "${subKeyword}"` : ''}를 자연스럽게 언급
- 이용 전 상황이나 니즈 설명

**본론 1: "${companyName}"의 핵심 서비스/제품** (최소 700자):
- "${companyInfo}"에 나온 주력 서비스/제품 상세 설명
- 특징, 장점, 차별화 포인트
${bodyKeyword1 ? `- "${bodyKeyword1}" 키워드 자연스럽게 포함` : ''}
- 가격/비용 정보 (있다면)
- 구체적인 이용 경험과 느낀 점
- 실제 사용 과정이나 절차
- 예상과 다른 점, 인상 깊었던 점

**본론 2: "${companyName}"의 추가 서비스/제품 또는 세부 사항** (최소 600자):
- "${companyInfo}"의 다른 서비스/제품들
${bodyKeyword2 ? `- "${bodyKeyword2}" 키워드 자연스럽게 포함` : ''}
- 각각의 특징과 장단점
- 조합 추천이나 활용 팁
- 다른 옵션과의 비교
- 추가로 이용한 경험

**본론 3: "${companyName}"의 시설/환경/분위기/서비스** (최소 500자):
- 물리적 공간이 있다면: 인테리어, 시설, 청결도
- 온라인 서비스라면: UI/UX, 편의성, 속도
${bodyKeyword3 ? `- "${bodyKeyword3}" 키워드 자연스럽게 포함` : ''}
- 직원/고객센터의 응대와 전문성
- 전반적인 분위기나 느낌
- 어떤 사람에게 적합한지

**본론 4: "${companyName}" 이용 팁과 추천** (최소 400자):
- 위치 및 찾아가는 법 (오프라인이면)
- 예약 방법이나 이용 절차
- 주차/교통 정보 (해당되면)
- 추천 시간대나 타이밍
- 초보자를 위한 팁
- "${searchKeyword}"${subKeyword ? ` 중 "${subKeyword}"` : ''}를 언급하며 추천

**결론** (최소 300자):
- "${companyName}" 총평과 만족도
- "${searchKeyword}" 관련 마무리 멘트
- 재이용 의향과 이유
- 추천 대상 명확히 제시
- 궁금한 점 있으면 댓글 달라는 유도
- 다른 분들께도 도움 되길 바라는 마무리

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 **네이버 SEO 최적화 팁**:

1. **키워드 배치**:
   - 첫 문단에 핵심 키워드 포함
   - 소제목에도 키워드 활용
   - 자연스럽게 3~5회 반복

2. **가독성**:
   - 단락은 2~3문장으로 짧게
   - 소제목(## 또는 ###) 적극 활용
   - 이모지 사용 불가

3. **진정성**:
   - 구체적인 수치나 예시 포함
   - 개인적인 경험담과 감정 표현
   - 솔직한 장단점 언급

4. **참여 유도**:
   - 질문 형식 사용
   - "여러분은~", "함께~" 등 친근한 어투
   - 댓글 유도 문구 자연스럽게

5. **글자수 채우기 팁**:
   - 이용 과정을 순서대로 상세히
   - 함께 간 사람과의 대화나 반응
   - 작은 디테일들 놓치지 않고 묘사
   - Before/After 비교
   - 다른 곳과의 차이점

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **최종 체크리스트**:
☑️ 공백 포함 ${targetLength}자 이상
☑️ 제목: "${searchKeyword}" + "${companyName}"${subKeyword ? ` + "${subKeyword}"` : ''} 포함
☑️ "${companyName}" 5회 이상 언급
☑️ 본문 키워드 자연스럽게 분산
☑️ "${companyInfo}"의 정보만 사용
☑️ 다른 업체 이름 절대 언급 안 함
☑️ 상위노출 블로그들의 스타일 반영
☑️ 구체적이고 생생한 경험담
☑️ 소제목 활용으로 가독성 확보

🔥 지금 바로 "${companyName}"에 대한 ${targetLength}자 이상의 고품질 블로그 글을 작성하세요!

업종에 관계없이 위 가이드를 따라 자연스럽고 진정성 있는 후기를 작성해주세요!`;

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
- 서론 (400자)
- 본론 섹션 1 (700자)
- 본론 섹션 2 (600자)
- 본론 섹션 3 (500자)
- 본론 섹션 4 (400자)
- 결론 (300자)

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
      companyName: companyName,
      subKeyword: subKeyword,
      bodyKeywords: bodyKeywords,
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
