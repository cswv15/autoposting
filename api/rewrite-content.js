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
    console.log(`[AutoPosting] contents 타입: ${typeof contents}, 배열 여부: ${Array.isArray(contents)}`);

    // Make.com Array Aggregator 구조 처리: [{Data: {...}}, {Data: {...}}]
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

    // 커스텀 프롬프트가 있으면 사용, 없으면 기본 프롬프트
    let prompt;
    let systemMessage = 'SEO에 최적화된 고품질 블로그 콘텐츠를 작성하는 전문 작가입니다.';

    if (customPrompt && customPrompt.trim()) {
      // 사용자가 입력한 커스텀 프롬프트 사용
      console.log('[AutoPosting] 커스텀 프롬프트 사용');
      
      const companyInfoText = companyInfo ? `\n\n업체 특성: ${companyInfo}` : '';
      
      // 변수 치환
      prompt = customPrompt
        .replace(/\{searchKeyword\}/g, searchKeyword)
        .replace(/\{titleKeywords\}/g, titleKeywords)
        .replace(/\{targetLength\}/g, targetLength)
        .replace(/\{contentsCount\}/g, contentsArray.length)
        .replace(/\{companyInfo\}/g, companyInfoText)
        .replace(/\{combinedContent\}/g, combinedContent);
        
    } else {
      // 기본 프롬프트 (네이버 SEO 최적화)
      console.log('[AutoPosting] 기본 프롬프트 사용');
      
      if (companyInfo) {
        // 업체 특성이 있을 때 - 업체 중심 프롬프트
        systemMessage = `당신은 특정 업체를 홍보하는 네이버 블로그 전문 작가입니다. 반드시 ${targetLength}자 이상의 긴 글을 작성해야 합니다.`;
        
        prompt = `🎯 **핵심 미션**: 아래 업체를 홍보하는 ${targetLength}자 이상의 네이버 블로그 글을 작성하세요.

📍 **홍보할 업체 정보** (이것이 가장 중요합니다!):
"${companyInfo}"

🔑 **검색 키워드**: ${searchKeyword}
📝 **제목 키워드**: ${titleKeywords || searchKeyword}

📌 **작성 규칙**:

1. 📏 **글자수 필수 요구사항** (가장 중요!):
   - 최소 ${targetLength}자 이상 (공백 포함) 반드시 작성
   - 공백 제외 기준: 최소 ${Math.floor(targetLength * 0.75)}자 이상
   - 짧은 글은 절대 안 됩니다!
   - 풍부한 설명, 상세한 예시, 다양한 팁으로 목표 글자수 달성

2. 🏢 **업체 중심 작성** (두 번째로 중요!):
   - 위에 명시된 업체의 정보(위치, 메뉴, 특징)를 본문 전체에 자연스럽게 녹여내기
   - 업체의 메뉴나 서비스를 구체적으로 상세히 설명
   - 업체의 분위기, 장점, 추천 이유를 풍부하게 작성
   - ⚠️ **절대 금지**: 다른 가게 이름이나 업체와 관련 없는 일반적인 맛집 나열 금지

3. 🔍 **네이버 SEO 최적화**:
   - 제목에 키워드(${titleKeywords || searchKeyword}) 포함
   - 첫 문단에 핵심 키워드 포함
   - 소제목(##, ###)에 키워드 자연스럽게 활용
   - 본문에 키워드 3-5회 자연스럽게 반복

4. 📋 **구조**:
   - 매력적인 제목 (30자 이내)
   - 서론: 업체 소개와 키워드 언급
   - 본론: 업체의 메뉴, 특징, 분위기를 여러 소제목으로 상세히 설명
   - 결론: 방문 추천 및 댓글 유도

5. 💡 **내용 채우기 팁** (글자수 달성을 위해):
   - 업체의 각 메뉴를 하나씩 상세히 설명
   - 업체 방문 경험을 구체적으로 묘사
   - 업체의 장점을 여러 각도에서 설명
   - 업체 이용 팁, 추천 시간대, 주차 정보 등 실용 정보
   - 업체의 역사, 사장님 이야기 등 스토리텔링

📚 **참고 자료** (글쓰기 스타일과 구조만 참고, 내용은 업체 중심으로):
${combinedContent}

⚠️ **최종 체크리스트**:
✅ ${targetLength}자 이상 작성했는가?
✅ 업체 정보(위치, 메뉴, 특징)가 본문에 자세히 포함되었는가?
✅ 업체와 관련 없는 다른 가게 이야기는 안 했는가?
✅ 자연스럽고 진정성 있는 후기 느낌인가?
✅ 키워드가 자연스럽게 포함되었는가?

지금 바로 ${targetLength}자 이상의 긴 글을 작성하세요!`;

      } else {
        // 업체 특성이 없을 때 - 일반 프롬프트
        systemMessage = `당신은 네이버 블로그 상위노출 전문 작가입니다. 반드시 ${targetLength}자 이상의 긴 글을 작성해야 합니다.`;
        
        prompt = `당신은 네이버 블로그 상위노출 전문 작가입니다. 아래 ${contentsArray.length}개의 블로그 글을 참고하여, "${searchKeyword}"에 대한 네이버 검색 최적화 블로그 글을 작성해주세요.

📌 네이버 블로그 상위노출 최적화 요구사항:

1. 📏 **글자수 필수 요구사항** (가장 중요!):
   - 최소 ${targetLength}자 이상 (공백 포함) 반드시 작성
   - 공백 제외 기준: 최소 ${Math.floor(targetLength * 0.75)}자 이상
   - 짧은 글은 절대 안 됩니다! 네이버는 긴 글을 선호합니다
   - 풍부한 설명, 상세한 예시, 다양한 팁으로 목표 글자수 달성

2. 🔍 **핵심 키워드 배치**:
   - 제목에 반드시 포함: ${titleKeywords || searchKeyword}
   - 첫 문단에 핵심 키워드 포함
   - 본문에 자연스럽게 3-5회 반복
   - 소제목(##)에도 키워드 활용

3. 📋 **구조 최적화**:
   - 명확한 소제목 활용 (##, ###)
   - 단락은 2-3문장으로 짧게
   - 번호 또는 불릿 포인트로 정리
   - 시각적으로 읽기 쉽게 구성

4. 📚 **콘텐츠 품질**:
   - ${contentsArray.length}개 블로그의 핵심 내용 종합
   - 완전히 새로운 문장으로 재작성 (표절 방지)
   - 구체적인 수치, 예시, 경험담 포함
   - 실용적인 팁이나 방법론 제시

5. 💬 **독자 참여 유도**:
   - 질문 형식 사용
   - "여러분은~", "함께~" 등 친근한 어투
   - 댓글 유도 문구 포함

6. ✨ **네이버 친화적 표현**:
   - 자연스러운 한국어 (구어체 가능)
   - 이모지 사용 가능
   - "추천", "후기", "리뷰", "방법" 등 검색 친화적 단어 활용

참고 블로그:
${combinedContent}

⚠️ **중요 체크리스트**: 
✅ ${targetLength}자 이상 작성
✅ 키워드 자연스럽게 포함
✅ 진정성 있는 정보 제공
✅ 제목 30자 이내

지금 바로 ${targetLength}자 이상의 고품질 블로그 글을 작성하세요!`;
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
