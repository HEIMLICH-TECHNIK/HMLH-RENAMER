/**
 * 파일 유틸리티 모듈
 * 파일 처리와 관련된 유틸리티 기능을 제공합니다.
 */

/**
 * 파일 경로에서 파일 이름만 추출
 * @param {string} filePath - 파일 경로
 * @returns {string} 파일 이름
 */
function getFileName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

/**
 * 파일명을 확장자와 기본 이름으로 분리
 * @param {string} fileName - 파일 이름
 * @returns {Object} {baseName, fileExt} 객체
 */
function splitFileName(fileName) {
  const lastDotIndex = fileName.lastIndexOf('.');
  const fileExt = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  
  return { baseName, fileExt };
}

/**
 * 파일 경로를 확장자와 기본 이름으로 분리
 * @param {string} filePath - 파일 경로
 * @returns {Object} {baseName, fileExt, fileName} 객체
 */
function splitFilePath(filePath) {
  const fileName = getFileName(filePath);
  const { baseName, fileExt } = splitFileName(fileName);
  
  return { baseName, fileExt, fileName };
}

/**
 * 파일 이름 변경 결과 처리
 * @param {Array} results - 이름 변경 결과 배열
 * @returns {Object} 성공 및 실패 개수 정보
 */
function processRenameResults(results) {
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  
  // 메시지 생성
  let message = '';
  let type = 'info';
  
  if (successCount > 0 && errorCount === 0) {
    message = `${successCount} files renamed successfully`;
    type = 'success';
  } else if (successCount > 0 && errorCount > 0) {
    message = `${successCount} successful, ${errorCount} failed`;
    type = 'warning';
  } else {
    message = `Rename failed: ${errorCount} files`;
    type = 'error';
  }
  
  return { message, type, successCount, errorCount };
}

/**
 * 파일 드래그 앤 드롭 처리
 * @param {FileList|Array} fileList - 파일 목록
 * @returns {Array} 파일 경로 배열
 */
function processDroppedFiles(fileList) {
  // FileList 객체를 배열로 변환
  const fileArray = Array.from(fileList);
  
  // 파일 객체에 path 속성이 있는 경우 (Electron 환경에서만)
  if (fileArray.length > 0 && fileArray[0].path) {
    return fileArray.map(file => file.path);
  }
  
  // 웹 환경에서는 파일 객체 자체를 반환
  return fileArray;
}

/**
 * 클립보드에 텍스트 복사
 * @param {string} text - 복사할 텍스트
 * @returns {boolean} 복사 성공 여부
 */
function copyToClipboard(text) {
  // 현대적인 브라우저 API 사용
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
        // 대체 방법 시도
        return fallbackCopyToClipboard(text);
      });
  } else {
    // 구형 브라우저 지원
    return fallbackCopyToClipboard(text);
  }
}

/**
 * 클립보드 복사 대체 방법
 * @param {string} text - 복사할 텍스트
 * @returns {boolean} 복사 성공 여부
 */
function fallbackCopyToClipboard(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 화면에서 안 보이게 설정
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    let success = false;
    try {
      success = document.execCommand('copy');
      if (!success) {
        console.error('복사 실패');
      }
    } catch (err) {
      console.error('복사 중 오류 발생:', err);
    }
    
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('대체 복사 방법 실패:', err);
    return false;
  }
}

export {
  getFileName,
  splitFileName,
  splitFilePath,
  processRenameResults,
  processDroppedFiles,
  copyToClipboard
}; 