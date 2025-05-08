/**
 * 정규식 방식 이름 변경 모듈
 * 정규식 기반 파일명 변환 기능을 제공합니다.
 */

/**
 * 정규식 방식으로 새 파일 이름 생성
 * @param {string} fileName - 전체 파일 이름
 * @param {string} fileExt - 사용하지 않음 (호환성을 위해 유지)
 * @param {string} pattern - 정규식 패턴
 * @param {string} replacement - 대체 텍스트
 * @returns {string} 새 파일 이름
 */
function applyRegex(fileName, fileExt, pattern, replacement) {
  // 패턴이 없으면 변경 없음
  if (!pattern) return fileName;
  
  try {
    const regex = new RegExp(pattern, 'g');
    return fileName.replace(regex, replacement);
  } catch (error) {
    console.error('Invalid regex pattern:', error);
    // 유효하지 않은 정규식 패턴
    return fileName;
  }
}

export { applyRegex }; 