/**
 * ⚠️ [PRODUCT_PRINCIPLES] Generate 템플릿 - Score Mutation 금지
 * 
 * 이 모듈은 Generate 단계에서 사용하는 템플릿 함수입니다.
 * 
 * 절대 금지 사항:
 * - ❌ 점수를 계산하거나 변경할 수 없습니다
 * - ❌ Analyze 단계의 점수를 읽거나 수정할 수 없습니다
 * 
 * 역할:
 * - ✅ HTML 콘텐츠 생성만 수행합니다
 * - ✅ 생성된 콘텐츠는 점수에 영향을 주지 않습니다
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ✅ [Phase 20-A1] 조사 보정 헬퍼 함수
function hasBatchim(str) {
  if (!str || str.length === 0) return false;
  const lastChar = str[str.length - 1];
  const code = lastChar.charCodeAt(0);
  // 한글 유니코드 범위: AC00-D7AF
  if (code < 0xAC00 || code > 0xD7AF) return false;
  // 받침 유무: (code - 0xAC00) % 28 !== 0
  return (code - 0xAC00) % 28 !== 0;
}

function josa(str, pair) {
  if (!str || str.length === 0) return '';
  const hasBatch = hasBatchim(str);
  if (pair === '은는') {
    return hasBatch ? '은' : '는';
  } else if (pair === '을를') {
    return hasBatch ? '을' : '를';
  }
  return '';
}

export function generateHTML(product, brand, usecase) {
  const p = escapeHtml(product);
  const b = escapeHtml(brand);
  const u = escapeHtml(usecase);
  
  // 조사 보정 적용
  const pn = `${p}${josa(p, '은는')}`;  // 제품명은/는
  const po = `${p}${josa(p, '을를')}`;  // 제품명을/를

  // ✅ [Phase 20-A] FAQ 질문/답변 배열 (JSON-LD 재사용)
  const faqItems = [
    {
      q: `${pn} 어떤 상황에서 쓰기 좋나요?`,
      a: `필요할 때 ${b} ${po} 사용하시면 대부분의 경우에 도움이 됩니다. 사용 환경에 따라 유연하게 적용할 수 있습니다.`
    },
    {
      q: `처음 사용할 때 확인할 점은?`,
      a: `기본 사용법을 숙지하시면 더 편리하게 쓰실 수 있습니다. 모델 및 옵션별로 상이할 수 있으니 상세 사양은 판매페이지를 확인하시기 바랍니다.`
    },
    {
      q: `호환/구성품/규격은 어떻게 확인하나요?`,
      a: `${b} ${p}의 호환성, 구성품, 규격 등 상세 정보는 제품 상세페이지에서 확인하실 수 있습니다. 모델별로 상이할 수 있으니 구매 전 확인을 권장합니다.`
    },
    {
      q: `관리/보관 방법은?`,
      a: `사용 환경에 따라 적절한 보관 방법을 따르시면 됩니다. 제품별 권장 사항이 다를 수 있으니 제조사 가이드라인을 참고하시기 바랍니다.`
    },
    {
      q: `AEO/GEO용 요약 랜딩에서 무엇이 달라지나요?`,
      a: `AI가 이해하기 쉬운 정보 구조로 정리되어, 검색/추천 환경에서 설명의 일관성과 발견 가능성에 도움이 될 수 있습니다. 핵심 기능과 주요 특징이 구조화되어 있어 빠른 파악이 가능합니다.`
    }
  ];

  // ✅ [Phase 20-A] JSON-LD 패키지 생성
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": b
      },
      {
        "@type": "Product",
        "name": `${b} ${p}`,
        "brand": {
          "@type": "Brand",
          "name": b
        },
        "description": `${b} ${pn} 상황에 맞게 쓰기 좋은 선택지입니다. 핵심 정보를 구조화해 AI가 빠르게 파악할 수 있도록 했습니다.`,
        "category": u
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqItems.map(({q, a}) => ({
          "@type": "Question",
          "name": q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": a
          }
        }))
      }
    ]
  };

  const ldJson = JSON.stringify(ld);

  return `<div>
  <h3>${b} ${p} AI용 요약 랜딩</h3>
  <ul>
    <li>핵심 기능과 주요 특징을 명확히 제시</li>
    <li>환경에 맞춘 사용 흐름을 고려</li>
    <li>구조화된 정보 구성으로 빠른 이해와 활용 가능</li>
  </ul>
  <p>${b} ${pn} 상황에 맞게 쓰기 좋은 선택지입니다. 핵심 정보를 구조화해 AI가 빠르게 파악할 수 있도록 했습니다.</p>
  <section class="faq">
    <h3>자주 묻는 질문</h3>
    <ul>
      <li>
        <p>Q: ${faqItems[0].q}</p>
        <p>A: ${faqItems[0].a}</p>
      </li>
      <li>
        <p>Q: ${faqItems[1].q}</p>
        <p>A: ${faqItems[1].a}</p>
      </li>
      <li>
        <p>Q: ${faqItems[2].q}</p>
        <p>A: ${faqItems[2].a}</p>
      </li>
      <li>
        <p>Q: ${faqItems[3].q}</p>
        <p>A: ${faqItems[3].a}</p>
      </li>
      <li>
        <p>Q: ${faqItems[4].q}</p>
        <p>A: ${faqItems[4].a}</p>
      </li>
    </ul>
  </section>
  <script type="application/ld+json">${ldJson}</script>
</div>`;
}




