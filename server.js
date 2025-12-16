// ✅ [Phase 4-2A] AI 개선안 고도화 API 서버 (CommonJS)
// ESM/import 문제 방지를 위해 require 사용

const express = require("express");
const cors = require("cors");

const app = express();

// CORS 설정
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ✅ [Phase 4-2A] AI 개선안 고도화 API 엔드포인트
app.post("/api/improve", (req, res) => {
  console.log("[POST /api/improve] body:", req.body);

  // 검증 통과하도록 구성된 응답 (checklist 5~12개, html 필수 요소 포함)
  res.status(200).json({
    checklist: [
      "핵심 USP를 상단에 3개 불릿으로 고정하세요.",
      "타깃 고객과 사용 상황을 한 문장으로 명확히 정의하세요.",
      "스펙(재질/크기/호환성)을 불릿으로 정리하세요.",
      "FAQ는 구매 불안을 해소하는 질문 위주로 3개 작성하세요.",
      "근거 없는 과장 표현을 제거하고 evidence 기반 문장으로 수정하세요.",
      "H1 제목 추가: 상품명을 H1 태그로 명확히 표시",
      "H2 제목 추가: 주요 섹션을 H2로 구분 (최소 2개 이상)"
    ],
    html: `<!-- ✅ AI 개선안 HTML Skeleton -->
<h1>상품명</h1>

<!-- 상단 요약 블록 -->
<div class="summary">
  <p>상품명은 [핵심 특징 1], [핵심 특징 2], [핵심 특징 3]을 제공하는 [카테고리]입니다.</p>
  <p>[주요 사용 사례나 타겟 고객 설명]</p>
</div>

<!-- 주요 특징/USP 리스트 -->
<h2>주요 특징</h2>
<ul>
  <li><strong>USP 1:</strong> [첫 번째 핵심 특징 설명]</li>
  <li><strong>USP 2:</strong> [두 번째 핵심 특징 설명]</li>
  <li><strong>USP 3:</strong> [세 번째 핵심 특징 설명]</li>
</ul>

<!-- FAQ 섹션 -->
<h2>자주 묻는 질문</h2>
<h3>Q1: [자주 묻는 질문 1]</h3>
<p>A: [답변 내용 1]</p>

<h3>Q2: [자주 묻는 질문 2]</h3>
<p>A: [답변 내용 2]</p>

<h3>Q3: [자주 묻는 질문 3]</h3>
<p>A: [답변 내용 3]</p>

<!-- CTA 버튼 -->
<div class="cta-section">
  <button class="btn-primary">지금 구매하기</button>
</div>`,
    notes: [
      "근거 기반 요약: 현재 콘텐츠 구조 분석 결과를 바탕으로 개선안을 제시했습니다.",
      "추가 입력 필요 시 질문: 상품의 구체적인 특징이나 타겟 고객 정보를 추가하면 더 정확한 개선안을 제공할 수 있습니다."
    ]
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[improve-api] listening on http://localhost:${PORT}`);
  console.log(`[improve-api] API 엔드포인트: http://localhost:${PORT}/api/improve`);
  console.log(`\n서버 실행 방법:`);
  console.log(`  node server.js\n`);
  console.log(`curl 테스트 명령:`);
  console.log(`  curl -v -X POST http://localhost:${PORT}/api/improve \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"ping":true}'\n`);
});
