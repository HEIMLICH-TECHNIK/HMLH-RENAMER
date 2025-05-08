/**
 * 단어 방식 이름 변경 모듈
 * 파일명 내 단어 단위 수정 기능을 제공합니다.
 */

import { escapeRegExp } from './replace.js';

/**
 * 단어 규칙 추가 
 * @param {HTMLElement} container - 규칙 요소를 추가할 컨테이너
 * @param {Function} updateCallback - 규칙 추가 후 호출할 콜백
 * @returns {Object} 새로 추가된 규칙 객체
 */
function addWordRule(container, updateCallback) {
  const ruleId = Date.now(); // 고유 ID 생성
  const ruleElem = document.createElement('div');
  ruleElem.className = 'word-rule';
  ruleElem.dataset.ruleId = ruleId;
  
  const actionSelect = document.createElement('select');
  actionSelect.innerHTML = `
    <option value="replace">Replace</option>
    <option value="remove">Remove</option>
    <option value="prefix">Add Prefix</option>
    <option value="suffix">Add Suffix</option>
  `;
  
  if (updateCallback) {
    actionSelect.addEventListener('change', updateCallback);
  }
  
  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'New value';
  
  if (updateCallback) {
    valueInput.addEventListener('input', updateCallback);
  }
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'word-rule-remove';
  removeBtn.innerHTML = '&times;';
  removeBtn.addEventListener('click', () => {
    // 규칙 요소 제거
    ruleElem.remove();
    // updateCallback 호출 (있는 경우)
    if (updateCallback) updateCallback();
  });
  
  ruleElem.appendChild(actionSelect);
  ruleElem.appendChild(valueInput);
  ruleElem.appendChild(removeBtn);
  
  if (container) {
    container.appendChild(ruleElem);
  }
  
  // 규칙 객체 생성 및 반환
  const newRule = {
    id: ruleId,
    action: 'replace',
    value: '',
    getAction: () => actionSelect.value,
    getValue: () => valueInput.value
  };
  
  return newRule;
}

/**
 * 단어 방식으로 새 파일 이름 생성
 * @param {string} fileName - 전체 파일 이름
 * @param {string} fileExt - 파일 확장자 (사용하지 않음)
 * @param {number} fileIndex - 파일 인덱스
 * @param {Array} wordRules - 적용할 단어 규칙 배열
 * @param {Array} selectedWordTokens - 선택된 단어 토큰 배열
 * @param {Array} wordPatterns - 일괄 적용용 단어 패턴 배열
 * @param {boolean} applyToAll - 모든 파일에 적용 여부
 * @returns {string} 새 파일 이름
 */
function applyWordRules(fileName, fileExt, fileIndex, wordRules, selectedWordTokens, wordPatterns, applyToAll) {
  // 규칙이나 선택된 단어가 없으면 변경 없음
  if ((selectedWordTokens.length === 0 && wordPatterns.length === 0) || wordRules.length === 0) {
    return fileName;
  }
  
  // 파일명을 단어와 비단어로 분리
  const words = fileName.split(/(\W+)/);
  
  // 모든 파일에 적용하는 경우 패턴 사용
  if (applyToAll) {
    // 모든 규칙 및 패턴에 대해 적용
    for (const rule of wordRules) {
      const action = rule.getAction ? rule.getAction() : rule.action;
      const value = rule.getValue ? rule.getValue() : rule.value;
      
      for (const pattern of wordPatterns) {
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          
          // 비단어 부분 건너뛰기
          if (word.trim() === '') continue;
          
          // 패턴과 일치하는지 확인
          if (pattern.pattern.test(word)) {
            pattern.pattern.lastIndex = 0; // 정규식 상태 초기화
            
            // 선택된 작업 수행
            switch (action) {
              case 'replace':
                words[i] = value;
                break;
              case 'remove':
                words[i] = '';
                break;
              case 'prefix':
                words[i] = value + words[i];
                break;
              case 'suffix':
                words[i] = words[i] + value;
                break;
            }
          }
        }
      }
    }
  } else {
    // 현재 파일에 대한 토큰만 필터링
    const fileTokens = selectedWordTokens.filter(token => token.fileIndex == fileIndex);
    
    if (fileTokens.length === 0) {
      return fileName; // 현재 파일에 대한 토큰이 없으면 변경 없음
    }
    
    // 선택된 각 단어에 규칙 적용
    for (const rule of wordRules) {
      const action = rule.getAction ? rule.getAction() : rule.action;
      const value = rule.getValue ? rule.getValue() : rule.value;
      
      for (const token of fileTokens) {
        const wordIndex = parseInt(token.wordIndex);
        
        // 선택된 작업 수행
        switch (action) {
          case 'replace':
            words[wordIndex] = value;
            break;
          case 'remove':
            words[wordIndex] = '';
            break;
          case 'prefix':
            words[wordIndex] = value + words[wordIndex];
            break;
          case 'suffix':
            words[wordIndex] = words[wordIndex] + value;
            break;
        }
      }
    }
  }
  
  // 모든 단어 조각 합치기
  return words.join('');
}

/**
 * 단어 패턴 생성
 * @param {string} word - 패턴을 생성할 단어
 * @returns {Object} 패턴 객체
 */
function createWordPattern(word) {
  return {
    word: word,
    pattern: new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g')
  };
}

export { addWordRule, applyWordRules, createWordPattern }; 