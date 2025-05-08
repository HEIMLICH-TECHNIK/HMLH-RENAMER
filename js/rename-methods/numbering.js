/**
 * 넘버링 방식 이름 변경 모듈
 * 순차적 번호 부여 기능을 제공합니다.
 */

/**
 * 넘버링 방식으로 새 파일 이름 생성
 * @param {string} baseName - 확장자 없는 파일 이름
 * @param {string} fileExt - 파일 확장자 (점 포함)
 * @param {number} index - 파일 인덱스
 * @param {Object} options - 넘버링 옵션
 * @param {string} options.pattern - 패턴 (기본값: '{name}_{num}')
 * @param {number} options.start - 시작 번호 (기본값: 1)
 * @param {number} options.padding - 패딩 자릿수 (기본값: 0)
 * @param {number} options.step - 증가 간격 (기본값: 1)
 * @returns {string} 새 파일 이름
 */
function applyNumbering(baseName, fileExt, index, options = {}) {
  // 기본 옵션 설정
  const pattern = options.pattern || '{name}_{num}';
  const start = options.start || 1;
  const padding = options.padding || 0;
  const step = options.step || 1;
  
  // 현재 번호 계산
  const num = start + (index * step);
  
  // 패딩이 있는 경우 순차 번호 포맷
  let formattedNumber = num.toString();
  if (padding > 0) {
    formattedNumber = formattedNumber.padStart(padding, '0');
  }
  
  // 패턴의 변수 교체
  let newName = pattern
    .replace(/{name}/g, baseName)
    .replace(/{num}/g, formattedNumber)
    .replace(/{ext}/g, fileExt.replace('.', ''));
  
  // 패턴에 확장자가 포함되지 않은 경우 확장자 추가
  if (fileExt && !newName.includes(fileExt)) {
    newName += fileExt;
  }
  
  return newName;
}

/**
 * 파일 정렬 방식에 따른 인덱스 매핑 생성
 * @param {Array} files - 파일 경로 배열
 * @param {string} sortMethod - 정렬 방식 ('name', 'date', 'size', 'random')
 * @param {boolean} reverse - 역순 정렬 여부
 * @returns {Array} 정렬된 인덱스 배열
 */
function createSortedIndexMap(files, sortMethod = 'name', reverse = false) {
  const fs = window.require ? window.require('fs') : null;
  
  // 인덱스 배열 생성 (0부터 파일 개수-1까지)
  let indices = files.map((_, i) => i);
  
  switch (sortMethod) {
    case 'name':
      // 파일 이름으로 정렬
      indices.sort((a, b) => {
        const nameA = getFileName(files[a]).toLowerCase();
        const nameB = getFileName(files[b]).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      break;
      
    case 'date':
      // 파일 수정 날짜로 정렬 (fs 모듈 필요)
      if (fs) {
        indices.sort((a, b) => {
          try {
            const statsA = fs.statSync(files[a]);
            const statsB = fs.statSync(files[b]);
            return statsA.mtime.getTime() - statsB.mtime.getTime();
          } catch (error) {
            console.error('Error sorting by date:', error);
            return 0;
          }
        });
      }
      break;
      
    case 'size':
      // 파일 크기로 정렬 (fs 모듈 필요)
      if (fs) {
        indices.sort((a, b) => {
          try {
            const statsA = fs.statSync(files[a]);
            const statsB = fs.statSync(files[b]);
            return statsA.size - statsB.size;
          } catch (error) {
            console.error('Error sorting by size:', error);
            return 0;
          }
        });
      }
      break;
      
    case 'random':
      // 무작위 정렬
      indices.sort(() => Math.random() - 0.5);
      break;
  }
  
  // 역순 정렬이 필요한 경우
  if (reverse) {
    indices.reverse();
  }
  
  return indices;
}

/**
 * 파일 경로에서 파일 이름만 추출
 * @param {string} filePath - 파일 경로
 * @returns {string} 파일 이름
 */
function getFileName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

export { applyNumbering, createSortedIndexMap }; 