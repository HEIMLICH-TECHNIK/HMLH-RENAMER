/**
 * 찾기/바꾸기 방식 이름 변경 모듈
 * 텍스트 찾기/바꾸기 기능을 제공합니다.
 */

/**
 * 문자열 내의 특수 정규식 문자를 이스케이프 처리
 * @param {string} string - 이스케이프할 문자열
 * @returns {string} 이스케이프된 문자열
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 특수문자 이스케이프
}

/**
 * 찾기/바꾸기 방식으로 새 파일 이름 생성
 * @param {string} fileName - 전체 파일 이름
 * @param {string} fileExt - 사용하지 않음 (호환성을 위해 유지)
 * @param {string} find - 찾을 텍스트
 * @param {string} replace - 대체할 텍스트
 * @param {boolean} caseSensitive - 대소문자 구분 여부
 * @returns {string} 새 파일 이름
 */
function applyFindReplace(fileName, fileExt, find, replace, caseSensitive) {
  // 찾을 텍스트가 없으면 변경 없음
  if (!find) return fileName;
  
  let result = fileName;
  const flags = caseSensitive ? 'g' : 'ig';
  
  // 찾을 텍스트를 정규표현식으로 변환 (특수문자 이스케이프)
  const regex = new RegExp(escapeRegExp(find), flags);
  result = fileName.replace(regex, replace);
  
  return result;
}

export { applyFindReplace, escapeRegExp }; 