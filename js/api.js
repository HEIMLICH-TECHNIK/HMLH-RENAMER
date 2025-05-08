/**
 * API 래퍼 모듈
 * Electron 프로세스와의 통신을 위한 함수들을 제공합니다.
 */

/**
 * 파일 선택 대화상자를 열고 선택된 파일 경로 배열을 반환합니다.
 * @returns {Promise<string[]>} 선택된 파일 경로의 배열
 */
export async function getFilePaths() {
  try {
    return await window.api.getFilePaths();
  } catch (error) {
    console.error('파일 경로를 가져오는 중 오류 발생:', error);
    return [];
  }
}

/**
 * 파일 이름 변경 작업을 수행합니다.
 * @param {string[]} files - 변경할 파일 경로 배열
 * @param {Object} config - 이름 변경 설정
 * @returns {Promise<Object[]>} 변경 결과 객체의 배열
 */
export async function renameFiles(files, config) {
  try {
    return await window.api.renameFiles(files, config);
  } catch (error) {
    console.error('파일 이름 변경 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 규칙을 저장합니다.
 * @param {string} ruleName - 규칙 이름
 * @param {Object} ruleData - 규칙 데이터
 * @returns {Promise<Object>} 저장 결과
 */
export async function saveRule(ruleName, ruleData) {
  try {
    return await window.api.saveRule(ruleName, ruleData);
  } catch (error) {
    console.error('규칙 저장 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 저장된 모든 규칙 목록을 가져옵니다.
 * @returns {Promise<Object[]>} 규칙 객체의 배열
 */
export async function getSavedRules() {
  try {
    return await window.api.getSavedRules();
  } catch (error) {
    console.error('저장된 규칙 가져오는 중 오류 발생:', error);
    return [];
  }
}

/**
 * 특정 규칙을 로드합니다.
 * @param {string} ruleName - 로드할 규칙 이름
 * @returns {Promise<Object>} 로드된 규칙 데이터
 */
export async function loadRule(ruleName) {
  try {
    return await window.api.loadRule(ruleName);
  } catch (error) {
    console.error('규칙 로드 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 규칙을 삭제합니다.
 * @param {string} ruleName - 삭제할 규칙 이름
 * @returns {Promise<Object>} 삭제 결과
 */
export async function deleteRule(ruleName) {
  try {
    return await window.api.deleteRule(ruleName);
  } catch (error) {
    console.error('규칙 삭제 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 이미지나 비디오 파일의 크기 정보를 가져옵니다.
 * @param {string} filePath - 파일 경로
 * @returns {Promise<Object>} 이미지 크기 정보 (width, height, duration)
 */
export async function getImageSize(filePath) {
  try {
    if (!window.electron || !window.electron.getImageSize) {
      console.warn('getImageSize API를 사용할 수 없습니다.');
      return { width: 0, height: 0, duration: 0 };
    }
    
    return await window.electron.getImageSize(filePath);
  } catch (error) {
    console.error('이미지 크기 가져오는 중 오류 발생:', error);
    return { width: 0, height: 0, duration: 0 };
  }
} 