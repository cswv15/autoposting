# AutoPosting

네이버 블로그 자동 포스팅 시스템

## 주요 기능

- 키워드 기반 네이버 상위 블로그 검색
- 블로그 본문 스크래핑
- ChatGPT를 활용한 콘텐츠 재작성
- Make.com + Bubble 연동

## 기술 스택

- Vercel Serverless Functions
- Naver Search API
- OpenAI GPT-4o-mini
- Browserless.io (선택사항)

## 환경변수

- `NAVER_CLIENT_ID`: 네이버 검색 API Client ID
- `NAVER_CLIENT_SECRET`: 네이버 검색 API Client Secret
- `OPENAI_API_KEY`: OpenAI API Key
- `BROWSERLESS_API_KEY`: Browserless.io API Key (선택사항)

## API 엔드포인트

- `/api/search-blogs?keyword={키워드}` - 블로그 검색
- `/api/scrape-content` - 블로그 본문 추출
- `/api/rewrite-content` - 콘텐츠 재작성

## 작성자

최승웅 - KeywordPurple
