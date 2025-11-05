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
- 공백은
