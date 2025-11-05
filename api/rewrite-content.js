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
      
      // 업체 특성이 있을 때 강조
      const companyFocus = companyInfo 
        ? `\n\n🎯 **중요**: 이 글은 다음 업체를 홍보하는 글입니다:\n"${companyInfo}"\n\n위 업체의 특성, 위치, 메뉴를 자연스럽게 본문에 포함하여 작성해주세요. 업체와 관련 없는 다른 가게나 일반적인 이야기만 하지 마세요.`
        : '';
      
prompt = `당신은 네이버 블로그 상위노출 전문 작가입니다. 아래 ${contentsArray.length}개의 블로그 글을 참고하여, "${searchKeyword}"에 대한 네이버 검색 최적화 블로그 글을 작성해주세요.${companyFocus}

📌 네이버 블로그 상위노출 최적화 요구사항:
1. 📏 **필수 글자수**: 최소 ${targetLength}자 이상 (공백 포함) 반드시 작성해야 합니다. 짧은 글은 절대 안 됩니다!
   - 공백 제외 기준으로도 최소 ${Math.floor(targetLength * 0.75)}자 이상 작성
   - 풍부한 내용으로 충분히 길게 작성
2. 핵심 키워드 배치:
   - 제목에 반드시 포함: ${titleKeywords || searchKeyword}
   - 첫 문단에 핵심 키워드 포함
   - 본문에 자연스럽게 3-5회 반복
   - 소제목(##)에도 키워드 활용
3. 구조 최적화:
   - 명확한 소제목 활용 (## 또는 ###)
   - 단락은 2-3문장으로 짧게
   - 번호 또는 불릿 포인트로 정리
   - 시각적으로 읽기 쉽게 구성
4. 콘텐츠 품질:
   - ${contentsArray.length}개 블로그의 핵심 내용 종합
   - 완전히 새로운 문장으로 재작성 (표절 방지)
   - 구체적인 수치, 예시, 경험담 포함
   - 실용적인 팁이나 방법론 제시${companyInfo ? '\n   - **반드시 위에 명시된 업체의 특성, 위치, 메뉴를 자연스럽게 소개하고 강조**' : ''}
5. 독자 참여 유도:
   - 질문 형식 사용
   - "여러분은~", "함께~" 등 친근한 어투
   - 댓글 유도 문구 포함
6. 네이버 친화적 표현:
   - 자연스러운 한국어 (구어체 가능)
   - 이모지 사용 불가
   - "추천", "후기", "리뷰", "방법" 등 검색 친화적 단어 활용

참고 블로그:
${combinedContent}

⚠️ 중요: 
- 키워드 과다 사용 금지 (자연스럽게!)
- 광고성 문구 최소화
- 진정성 있는 정보 제공
- 제목은 30자 이내로 간결하게${companyInfo ? '\n- **업체 특성에 맞는 내용으로만 작성하고, 업체 정보를 본문에 자연스럽게 포함**' : ''}

위 네이버 SEO 원칙에 따라 ${targetLength}자 이상의 고품질 블로그 글을 작성해주세요.`;
    }

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
