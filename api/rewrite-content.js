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
      
      systemMessage = `SEO에 최적화된 고품질 블로그 콘텐츠를 작성하는 전문 작가입니다.

절대 규칙:
1. 공백 포함 ${targetLength}자 이상 필수 (2999자는 실패)
2. 각 섹션을 매우 길고 상세하게 작성
3. 간결함보다 풍부한 묘사와 경험담 우선

${targetLength}자 미만은 절대 불가합니다!`;
      
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
        
    } else if (companyName && companyInfo) {
      // 기본 프롬프트 - 업체명과 특성이 모두 있을 때
      systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다.

절대 규칙 - 반드시 지켜야 함:
1. 공백 포함 ${targetLength}자 이상 필수 (2999자는 실패)
2. 각 섹션을 매우 길고 상세하게 작성
3. 간결함보다 풍부한 묘사와 경험담 우선
4. "${companyName}" 업체만 홍보 (다른 업체 언급 절대 금지)
5. "${companyInfo}"의 모든 키워드를 정확히 그대로 사용
6. companyInfo에 나온 단어/표현을 임의로 바꾸지 말 것


${targetLength}자 미만은 절대 불가합니다!`;
      
prompt = `🚨 중요: ${targetLength}자 미만으로 작성하면 실패입니다!
🚨 경고: 참고 블로그의 업체명은 절대 쓰지 마세요!
🚨 경고: "${companyName}" 이외의 다른 업체는 언급 금지!
🚨 필수: "${companyInfo}"의 모든 키워드를 적극 활용하세요!

# 작성 미션

"${companyName}" 업체를 홍보하는 네이버 블로그 글 작성
목표 길이: 공백 포함 ${targetLength}자 이상 (필수!)

각 섹션을 최대한 길고 상세하게 작성하세요.
간단히 요약하지 말고, 풍부한 묘사와 경험담으로 채워주세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 업체 정보

**업체명**: ${companyName}
**특성**: ${companyInfo}

🔥 키워드 활용 규칙 (매우 중요!):
1. "${companyInfo}"에 나온 **모든 키워드를 빠짐없이** 사용하세요
2. companyInfo의 **단어를 정확히 그대로** 사용하세요 (임의로 바꾸지 말 것)
3. companyInfo에 나온 **특징과 장점을 그대로** 반영하세요
4. companyInfo의 **모든 문장을 자연스럽게 풀어서** 글에 녹여주세요
5. companyInfo에 **3번 이상 반복해서 언급**하세요

예시:
- companyInfo에 "A서비스"가 있으면 → 글에서 "A서비스"를 여러 번 사용
- companyInfo에 "B의 장점"이 있으면 → 글에서 "B의 장점"을 상세히 설명
- companyInfo의 모든 핵심 단어를 본문 전체에 골고루 배치

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 키워드 전략

**제목 필수 키워드** (모두 포함):
- "${searchKeyword}"
- "${companyName}"
${subKeyword ? `- "${subKeyword}"` : ''}

**본문 자연스럽게 배치**:
- "${searchKeyword}" (3-5회)
- "${companyName}" (5-7회)
${subKeyword ? `- "${subKeyword}" (2-3회)` : ''}
${bodyKeyword1 ? `- "${bodyKeyword1}" (2-3회)` : ''}
${bodyKeyword2 ? `- "${bodyKeyword2}" (2-3회)` : ''}
${bodyKeyword3 ? `- "${bodyKeyword3}" (2-3회)` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 참고 자료 (스타일 참고용)

"${searchKeyword}" 상위노출 성공 블로그들:

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 글 구조 (${targetLength}자 이상 - 각 섹션을 매우 길게!)

### 제목 (30자 이내)
예시: "${searchKeyword} 추천, ${companyName}${subKeyword ? ` ${subKeyword}` : ''} 솔직 후기"

### 서론 (최소 600자 - 짧으면 안 됨!)
- ${companyName} 알게 된 계기를 매우 상세하게
- 첫인상과 기대감을 구체적으로
- 위치/접근성을 풍부하게 소개
- 이용 전 상황과 고민을 길게 서술
- **"${companyInfo}"에 나온 키워드를 1-2개 자연스럽게 언급**

### 본론 1: 핵심 서비스/제품 (최소 1000자 - 짧으면 안 됨!)
- **"${companyInfo}"에 나온 첫 번째 서비스/제품을 정확한 이름으로** 매우 상세히 소개
- **companyInfo의 단어를 그대로 사용하며** 특징과 장점 설명
${bodyKeyword1 ? `- "${bodyKeyword1}" 자연스럽게 언급` : ''}
- 가격, 구성, 크기 등 구체적 수치
- 이용 경험을 스토리텔링으로 길게
- **companyInfo에 나온 그 서비스의 특징을 모두 포함**
- 세밀하게 묘사 (시각, 촉각, 청각 등)

### 본론 2: 추가 서비스/제품 (최소 900자 - 짧으면 안 됨!)
- **"${companyInfo}"에 나온 다른 서비스/제품들을** 각각 상세하게
${bodyKeyword2 ? `- "${bodyKeyword2}" 자연스럽게 언급` : ''}
- **companyInfo의 모든 서비스를 빠짐없이 언급**
- 각각의 특징을 구체적으로 비교
- 조합 추천과 활용 팁을 풍부하게
- **companyInfo에 나온 장점을 모두 활용**

### 본론 3: 환경과 분위기 (최소 700자 - 짧으면 안 됨!)
- 공간을 들어서는 순간부터 상세하게
- 인테리어 스타일, 조명, 분위기
${bodyKeyword3 ? `- "${bodyKeyword3}" 자연스럽게 언급` : ''}
- 직원/전문가 응대를 구체적 사례로
- 다른 이용자들의 분위기
- 시간대별 분위기 차이
- 어떤 사람에게 적합한지 상세히
- **"${companyInfo}"에 나온 분위기/환경 키워드 반영**

### 본론 4: 이용 팁 (최소 600자 - 짧으면 안 됨!)
- 찾아가는 법을 매우 상세하게
- 대중교통, 자가용 각각 설명
- 주차 공간, 주차 요금
- 예약 방법, 대기 시간
- 추천 방문/이용 시간대와 그 이유
- 비추천 시간대와 그 이유
- 초보 이용자를 위한 팁
- ${searchKeyword} 관련 꿀팁을 길게

### 결론 (최소 500자 - 짧으면 안 됨!)
- 전체적인 경험을 길게 종합
- **"${companyInfo}"에 나온 핵심 장점을 다시 한번 강조**
- ${companyName}의 가장 큰 장점
- 아쉬웠던 점도 솔직하게
- 재방문/재이용 의향과 그 이유를 구체적으로
- 누구에게 추천하는지 여러 케이스로
- 마지막 당부와 댓글 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 작성 가이드

**절대 준수사항**:
- ${companyName}만 언급 (참고 블로그 업체명 절대 사용 금지)
- **"${companyInfo}"의 모든 키워드를 정확히 그대로 사용**
- **companyInfo에 나온 단어/표현을 임의로 바꾸거나 생략하지 말 것**
- **companyInfo의 모든 특징을 빠짐없이 포함**
- 실제 경험한 듯 매우 구체적이고 생생하게
- 각 섹션 최소 글자수 반드시 지키기
- 간단히 요약하지 말고 풍부하게 서술
- 소제목을 적절히 활용

**품질 향상 필수**:
- 구체적인 수치와 예시를 많이
- 개인적 경험담과 감정을 풍부하게
- 대화 내용, 생각의 흐름도 포함
- 작은 디테일까지 놓치지 않고
- Before/After, 기대 vs 현실 비교

**SEO 최적화**:
- 첫 문단에 핵심 키워드
- 소제목에도 키워드 활용
- 문단을 적절히 나누기
- 이모지는 사용하지 않기

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 최종 확인사항:

1. 공백 포함 ${targetLength}자 이상 필수!
2. 각 섹션을 매우 길고 상세하게!
3. "${companyInfo}"의 모든 키워드 사용!
4. companyInfo 내용을 절대 바꾸지 말고 그대로!
5. 간단히 요약하지 말고 풍부하게!
6. 구체적인 예시와 경험담 많이!
7. ${targetLength}자 미만이면 다시 작성!

지금 공백 포함 ${targetLength}자 이상으로 작성하세요!`;

    } else {
      // 기본 프롬프트 - 업체명이나 특성이 없을 때
      systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다.

절대 규칙:
1. 공백 포함 ${targetLength}자 이상 필수 (2999자는 실패)
2. 각 섹션을 매우 길고 상세하게 작성
3. 간결함보다 풍부한 정보와 설명 우선

${targetLength}자 미만은 절대 불가합니다!`;
      
      prompt = `🚨 중요: ${targetLength}자 미만으로 작성하면 실패입니다!

# 작성 미션

"${searchKeyword}"에 대한 정보성 블로그 글 작성
목표 길이: 공백 포함 ${targetLength}자 이상 (필수!)

각 섹션을 최대한 길고 상세하게 작성하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 키워드

**검색 키워드**: ${searchKeyword}
${subKeyword ? `**서브 키워드**: ${subKeyword}` : ''}
${bodyKeywords ? `**본문 키워드**: ${bodyKeywords}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 참고 자료

"${searchKeyword}" 상위노출 성공 블로그들:

${combinedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 글 구조 (각 섹션을 매우 길게!)

**제목**: "${searchKeyword}"${subKeyword ? ` + "${subKeyword}"` : ''} 포함

**본문**:
- 서론 (최소 600자): 주제를 상세하게 소개
- 본론 1 (최소 1000자): 핵심 정보를 매우 상세히
- 본론 2 (최소 900자): 추가 정보를 풍부하게
- 본론 3 (최소 700자): 상세 가이드를 구체적으로
- 본론 4 (최소 600자): 실용 팁을 많이
- 결론 (최소 500자): 종합 정리를 길게

**작성 방법**:
- 참고 블로그 스타일을 충실히 반영
- 핵심 정보를 매우 상세하게 종합
- 구체적인 예시와 수치를 많이
- 자연스러운 키워드 배치
- 풍부한 설명과 묘사

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 최종 확인:
공백 포함 ${targetLength}자 이상으로 작성하세요!
짧으면 안 됩니다!`;
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
      temperature: 0.95,
      max_tokens: 16000
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
