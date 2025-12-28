/**
 * ✅ 브랜드 점수 계산 모듈
 * 순수 함수로 구현되어 상태 저장/로컬스토리지 직접 접근 금지
 */

/**
 * 점수를 등급으로 변환
 */
function scoreToGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * ✅ 브랜드 점수 계산 함수
 * @param {string} brand - 브랜드명
 * @param {string} input - 전체 입력 텍스트 (HTML 또는 텍스트)
 * @returns {{score: number, grade: string} | null}
 */
export function computeBrandingScore(brand, input) {
  if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
    return null;
  }
  
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return null;
  }
  
  try {
    const brandLower = brand.trim().toLowerCase();
    const inputLower = input.toLowerCase();
    
    let score = 0;
    
    // 브랜드명이 입력 텍스트에 포함되어 있는지 확인
    if (inputLower.includes(brandLower)) {
      score += 50; // 기본 점수: 브랜드명 포함
      
      // 브랜드명이 명시적으로 언급되는 횟수 (간단한 휴리스틱)
      const brandMatches = inputLower.match(new RegExp(brandLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      const mentionCount = brandMatches ? brandMatches.length : 0;
      
      if (mentionCount >= 3) {
        score += 30; // 3회 이상 언급
      } else if (mentionCount >= 2) {
        score += 20; // 2회 언급
      } else if (mentionCount >= 1) {
        score += 10; // 1회 언급
      }
      
      // HTML 태그 내에서 브랜드명이 강조되는지 확인 (strong, em, h1-h3 등)
      const emphasisTags = ['<strong>', '<em>', '<b>', '<h1>', '<h2>', '<h3>'];
      const hasEmphasis = emphasisTags.some(tag => {
        const tagIndex = inputLower.indexOf(tag);
        if (tagIndex === -1) return false;
        const afterTag = inputLower.substring(tagIndex, tagIndex + 200);
        return afterTag.includes(brandLower);
      });
      
      if (hasEmphasis) {
        score += 10; // 강조 태그 내 브랜드명
      }
    } else {
      // 브랜드명이 포함되지 않으면 낮은 점수
      score = 20;
    }
    
    // 점수 범위 제한 (0-100)
    score = Math.max(0, Math.min(100, score));
    const grade = scoreToGrade(score);
    
    return {
      score: score,
      grade: grade
    };
  } catch (error) {
    // 계산 실패 시 null 반환
    return null;
  }
}

