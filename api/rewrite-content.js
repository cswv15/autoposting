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

if (companyName && companyInfo) {
        // 업체명과 특성이 모두 있을 때
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다.

필수 요구사항:
- 공백 포함 ${targetLength}자 이상 작성 필수
- "${companyName}" 업체만 홍보 (다른 업체 언급 금지)
- 자연스럽고 진정성 있는 후기 스타일
- 참고 블로그의 스타일 반영`;
        
        prompt = `# 작성 미션

"${companyName}" 업체를 홍보하는 네이버 블로그 글 작성
목표 길이: 공백 포함 ${targetLength}자 이상

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 업체 정보

**업체명**: ${companyName}
**특성**: ${companyInfo}

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

## 글 구조 (${targetLength}자 이상)

### 제목 (30자 이내)
예시: "${searchKeyword} 추천, ${companyName}${subKeyword ? ` ${subKeyword}` : ''} 솔직 후기"

### 서론 (500자)
- ${companyName} 알게 된 계기
- 첫인상과 기대감
- 위치/접근성 소개
- 방문 전 상황

### 본론 1: 핵심 서비스/제품 (800자)
- 주력 상품 상세 소개
- 특징과 장점
${bodyKeyword1 ? `- "${bodyKeyword1}" 자연스럽게 언급` : ''}
- 가격, 구성 등 구체적 정보
- 이용 경험과 느낀 점

### 본론 2: 추가 서비스/제품 (700자)
- 다른 메뉴/서비스 소개
${bodyKeyword2 ? `- "${bodyKeyword2}" 자연스럽게 언급` : ''}
- 각각의 특징
- 조합 추천 및 활용 팁
- 비교와 선택 가이드

### 본론 3: 환경과 분위기 (600자)
- 공간, 인테리어, 청결도
${bodyKeyword3 ? `- "${bodyKeyword3}" 자연스럽게 언급` : ''}
- 직원 응대와 서비스
- 전체적인 분위기
- 적합한 고객층

### 본론 4: 이용 팁 (500자)
- 찾아가는 법, 주차 정보
- 예약 방법, 추천 시간대
- 초보자 가이드
- ${searchKeyword} 관련 팁

### 결론 (400자)
- 종합 평가와 만족도
- 재방문 의향
- 추천 대상
- 마무리 및 댓글 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 작성 가이드

**필수 준수**:
- ${companyName}만 언급 (참고 블로그 업체명 절대 사용 금지)
- 실제 경험한 듯 구체적이고 생생하게
- 각 섹션 최소 글자수 지키기
- 소제목 활용으로 가독성 확보

**품질 향상**:
- 구체적 수치와 예시 포함
- 개인적 경험담과 감정 표현
- 솔직한 장단점 언급
- 자연스러운 대화체

**SEO 최적화**:
- 첫 문단에 핵심 키워드
- 소제목에 키워드 활용
- 적절한 문단 나누기
- 이모지 사용 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

지금 바로 공백 포함 ${targetLength}자 이상의 고품질 블로그 글을 작성하세요.`;

      } else {
        // 업체명이나 특성이 없을 때
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다.

필수 요구사항:
- 공백 포함 ${targetLength}자 이상 작성
- 자연스럽고 유용한 정보성 콘텐츠`;
        
        prompt = `# 작성 미션

"${searchKeyword}"에 대한 정보성 블로그 글 작성
목표 길이: 공백 포함 ${targetLength}자 이상

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

## 글 구조

**제목**: "${searchKeyword}"${subKeyword ? ` + "${subKeyword}"` : ''} 포함

**본문**:
- 서론 (500자): 주제 소개
- 본론 1 (800자): 핵심 정보
- 본론 2 (700자): 추가 정보
- 본론 3 (600자): 상세 가이드
- 본론 4 (500자): 실용 팁
- 결론 (400자): 종합 정리

**작성 방법**:
- 참고 블로그 스타일 반영
- 핵심 정보 종합
- 구체적이고 실용적으로
- 자연스러운 키워드 배치

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

공백 포함 ${targetLength}자 이상으로 작성하세요.`;
      }
    }

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      temperature: 0.9,
      max_tokens: 20000
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
