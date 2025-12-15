function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function generateHTML(product, brand, usecase) {
  const p = escapeHtml(product);
  const b = escapeHtml(brand);
  const u = escapeHtml(usecase);

  return `<div>
  <h3>${b} ${p} AI용 요약 랜딩</h3>
  <ul>
    <li>핵심 기능과 주요 특징을 명확히 제시</li>
    <li>${u} 사용하는 사용자에게 최적화된 솔루션</li>
    <li>구조화된 정보 구성으로 빠른 이해와 활용 가능</li>
  </ul>
  <p>${b} ${p}는 ${u} 효과적으로 활용할 수 있는 솔루션입니다. AI가 빠르게 이해할 수 있도록 구조화했습니다.</p>
  <section class="faq">
    <h4>자주 묻는 질문</h4>
    <div>
      <p><strong>Q: ${p}는 어떤 경우에 사용하나요?</strong></p>
      <p>A: ${u} 필요할 때 ${b} ${p}를 활용하시면 효과적입니다. 다양한 상황에서 유연하게 적용 가능합니다.</p>
    </div>
    <div>
      <p><strong>Q: ${b} ${p}의 주요 특징은 무엇인가요?</strong></p>
      <p>A: 핵심 기능과 구조화된 정보 구성으로 빠른 이해와 활용이 가능합니다. ${u} 사용자에게 최적화되어 있습니다.</p>
    </div>
    <div>
      <p><strong>Q: ${p} 사용 시 주의사항이 있나요?</strong></p>
      <p>A: 기본 사용법을 숙지하시면 ${u} 효과적으로 활용하실 수 있습니다. 구조화된 정보를 참고하여 사용하시기 바랍니다.</p>
    </div>
  </section>
</div>`;
}

