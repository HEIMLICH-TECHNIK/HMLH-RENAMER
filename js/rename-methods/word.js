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
 * 파일명을 단어 단위로 분리
 * 구분자: 언더스코어(_), 하이픈(-), 공백, 대소문자 변경
 * @param {string} fileName - 분리할 파일명
 * @returns {Array} 분리된 단어와 구분자 배열
 */
function splitWordsInFileName(fileName) {
  // 알파벳, 숫자, 한글, 기타 유니코드 문자를 단어로 취급
  // 구분자(_,-,공백)를 기준으로 분리하고 구분자도 배열에 포함
  const parts = [];
  let currentWord = '';
  let prevCharType = null;
  
  for (let i = 0; i < fileName.length; i++) {
    const char = fileName[i];
    const separator = /[_\-\s]/.test(char); // 구분자: 언더스코어, 하이픈, 공백
    
    if (separator) {
      // 현재까지의 단어 추가
      if (currentWord) {
        parts.push(currentWord);
        currentWord = '';
      }
      // 구분자 추가
      parts.push(char);
      prevCharType = 'separator';
    } else {
      // 문자 유형 감지
      const isUpperCase = /[A-Z]/.test(char);
      const isLowerCase = /[a-z]/.test(char);
      const isDigit = /[0-9]/.test(char);
      
      let charType;
      if (isUpperCase) charType = 'upper';
      else if (isLowerCase) charType = 'lower';
      else if (isDigit) charType = 'digit';
      else charType = 'other'; // 한글 등 다른 문자
      
      // 문자 유형 변경 시 단어 분리
      // 1. 소문자→대문자 변경 시
      // 2. 문자→숫자 또는 숫자→문자 변경 시
      // 3. 이전 문자가 구분자였던 경우 제외
      if (prevCharType && prevCharType !== 'separator' && 
         ((prevCharType === 'lower' && charType === 'upper') || 
          (prevCharType === 'digit' && (charType === 'upper' || charType === 'lower' || charType === 'other')) ||
          ((prevCharType === 'upper' || prevCharType === 'lower' || prevCharType === 'other') && charType === 'digit'))) {
        if (currentWord) {
          parts.push(currentWord);
          currentWord = '';
        }
      }
      
      // 현재 문자 추가
      currentWord += char;
      prevCharType = charType;
    }
  }
  
  // 마지막 단어 추가
  if (currentWord) {
    parts.push(currentWord);
  }
  
  return parts;
}

/**
 * 패턴 매칭 기반 단어 선택
 * 선택된 단어와 유사한 패턴의 단어들을 자동으로 선택 (다른 파일에서만)
 * @param {Array} allFiles - 모든 파일 배열
 * @param {number} fileIndex - 현재 파일 인덱스
 * @param {Array} wordTokens - 선택된 단어 토큰 배열
 * @param {boolean} applySimilarPattern - 유사 패턴 적용 여부
 * @return {Array} 추가로 선택할 단어 토큰 배열
 */
function selectSimilarPatternWords(allFiles, fileIndex, wordTokens, applySimilarPattern) {
  if (!applySimilarPattern || wordTokens.length === 0 || allFiles.length === 0) {
    return [];
  }
  
  // 새로 선택할 토큰 배열
  const newTokens = [];
  
  // 선택된 각 단어에 대해 처리
  for (const token of wordTokens) {
    const selectedWord = token.word;
    const selectedWordIndex = parseInt(token.wordIndex);
    
    // 숫자 패턴 검출 (예: 001, 002 등)
    const numericPattern = /^([A-Za-z]*)(\d+)([A-Za-z]*)$/;
    const match = selectedWord.match(numericPattern);
    
    if (match) {
      // 접두사, 숫자 부분, 접미사 분리
      const prefix = match[1] || '';
      const numericPart = match[2];
      const suffix = match[3] || '';
      
      // 선택된 단어의 파일에서 단어 목록 가져오기 (컨텍스트 분석용)
      const selectedFileName = getFileName(allFiles[fileIndex]);
      const selectedFileWords = splitWordsInFileName(selectedFileName);
      
      // 선택된 단어의 주변 컨텍스트 (앞뒤 1-2개 단어) 분석
      const contextBefore = selectedWordIndex > 0 ? selectedFileWords.slice(Math.max(0, selectedWordIndex - 2), selectedWordIndex) : [];
      const contextAfter = selectedWordIndex < selectedFileWords.length - 1 ? 
                           selectedFileWords.slice(selectedWordIndex + 1, Math.min(selectedFileWords.length, selectedWordIndex + 3)) : [];
      
      // 단어 컨텍스트를 패턴화 (구분자는 유지, 다른 단어는 유형만 저장)
      const contextPattern = {
        before: contextBefore.map(w => characterizeWord(w)),
        after: contextAfter.map(w => characterizeWord(w))
      };
      
      // 다른 파일에 대해서만 검사 (현재 파일은 제외)
      for (let i = 0; i < allFiles.length; i++) {
        // 현재 파일은 건너뜀 - 다른 파일에서만 유사 패턴 검색
        if (i === fileIndex) {
          continue;
        }
        
        // 다른 파일의 단어들 처리
        const otherFileName = getFileName(allFiles[i]);
        const otherWords = splitWordsInFileName(otherFileName);
        
        // 다른 파일의 모든 단어에 대해 패턴 검사
        for (let j = 0; j < otherWords.length; j++) {
          const currentWord = otherWords[j];
          
          // 현재 단어가 같은 패턴인지 확인
          const currentMatch = currentWord.match(numericPattern);
          
          if (currentMatch) {
            const currentPrefix = currentMatch[1] || '';
            const currentNumeric = currentMatch[2];
            const currentSuffix = currentMatch[3] || '';
            
            // 기본 패턴 매칭: 접두사와 접미사가 같고, 숫자 부분의 길이가 같으면 유사 패턴으로 판단
            if (prefix === currentPrefix && 
                suffix === currentSuffix && 
                numericPart.length === currentNumeric.length) {
              
              // 컨텍스트 매칭 추가 - 주변 단어의 패턴도 확인
              let contextMatchScore = 0;
              const maxContextScore = contextPattern.before.length + contextPattern.after.length;
              
              // 앞쪽 컨텍스트 확인
              for (let k = 0; k < contextPattern.before.length; k++) {
                const targetIdx = j - (contextPattern.before.length - k);
                if (targetIdx >= 0) {
                  const targetWord = otherWords[targetIdx];
                  const targetType = characterizeWord(targetWord);
                  if (targetType === contextPattern.before[k]) {
                    contextMatchScore++;
                  }
                }
              }
              
              // 뒤쪽 컨텍스트 확인
              for (let k = 0; k < contextPattern.after.length; k++) {
                const targetIdx = j + k + 1;
                if (targetIdx < otherWords.length) {
                  const targetWord = otherWords[targetIdx];
                  const targetType = characterizeWord(targetWord);
                  if (targetType === contextPattern.after[k]) {
                    contextMatchScore++;
                  }
                }
              }
              
              // 컨텍스트 매칭 점수가 일정 수준 이상이면 매칭으로 판단
              // (컨텍스트가 없으면 기본 패턴 매칭만으로 진행)
              const contextMatchThreshold = maxContextScore > 0 ? 0.5 : 0; // 컨텍스트 매칭 임계값 (최소 50%)
              const contextMatchRate = maxContextScore > 0 ? contextMatchScore / maxContextScore : 1;
              
              if (contextMatchRate >= contextMatchThreshold) {
                // 새 토큰 추가 (중복 체크)
                const exists = newTokens.some(t => 
                  t.fileIndex === i && parseInt(t.wordIndex) === j
                );
                
                if (!exists) {
                  newTokens.push({
                    fileIndex: i,
                    wordIndex: j,
                    word: currentWord,
                    contextMatchRate: contextMatchRate // 컨텍스트 매칭 점수 저장 (디버깅용)
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  
  return newTokens;
}

/**
 * 단어의 특성을 분석하여 유형 반환
 * 컨텍스트 매칭에 사용됨
 * @param {string} word - 분석할 단어
 * @returns {string} 단어 유형 ('separator', 'numeric', 'alpha', 'mixed', 'other')
 */
function characterizeWord(word) {
  if (/^[_\-\s]$/.test(word)) {
    return 'separator';
  } else if (/^\d+$/.test(word)) {
    return 'numeric';
  } else if (/^[A-Za-z]+$/.test(word)) {
    return 'alpha';
  } else if (/^[A-Za-z0-9]+$/.test(word)) {
    return 'mixed';
  } else {
    return 'other';
  }
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
 * @param {boolean} applySimilarPattern - 유사한 파일명 패턴에만 적용 여부
 * @param {boolean} treatSelectionAsOne - 연속 선택을 하나의 단어로 취급 여부
 * @param {Array} selectedGroups - 연속 선택된 단어 그룹
 * @returns {Promise<string>} 새 파일 이름
 */
async function applyWordRules(fileName, fileExt, fileIndex, wordRules, selectedWordTokens, wordPatterns, applyToAll, applySimilarPattern = false, treatSelectionAsOne = false, selectedGroups = []) {
  // 규칙이나 선택된 단어가 없으면 변경 없음
  if ((selectedWordTokens.length === 0 && wordPatterns.length === 0) || wordRules.length === 0) {
    return fileName;
  }
  
  // 파일명을 단어와 구분자로 분리 (개선된 로직 사용)
  const words = splitWordsInFileName(fileName);
  
  // 유사한 파일명 패턴에만 적용하는 경우 패턴 확인
  if (applyToAll && applySimilarPattern) {
    // 첫 번째 선택된 토큰의 파일명 패턴 구조 추출
    if (selectedWordTokens.length > 0) {
      const firstTokenFileIndex = selectedWordTokens[0].fileIndex;
      const firstFileName = fileName; // 현재 파일명
      
      // 기준이 되는 패턴을 파일명에서 추출 (예: A_0001C001_240715_155424_p1DVA.mxf)
      // -> 패턴: A_####C###_######_######_p#DVA.mxf
      const patternStructure = extractFilePattern(firstFileName);
      
      // 현재 파일의 패턴 추출
      const currentPattern = extractFilePattern(fileName);
      
      // 패턴이 유사한지 확인 (80% 이상 일치)
      const similarity = calculatePatternSimilarity(patternStructure, currentPattern);
      console.log(`패턴 유사도: ${similarity * 100}% (${patternStructure} vs ${currentPattern})`);
      
      // 유사도가 낮으면 변경하지 않음 (80% 미만)
      if (similarity < 0.8) {
        console.log(`유사한 패턴이 아니므로 건너뜀: ${fileName}`);
        return fileName;
      }
    }
  }
  
  // 연속 선택을 하나의 단어로 취급하는 경우
  if (treatSelectionAsOne && selectedGroups.length > 0) {
    // 현재 파일에 대한 그룹만 필터링
    const fileGroups = selectedGroups.filter(group => 
      group.fileIndex == fileIndex
    );
    
    // 그룹별로 적용
    for (const group of fileGroups) {
      const startIdx = group.startIndex;
      const endIdx = group.endIndex;
      
      // 그룹에 모든 규칙 적용
      for (const rule of wordRules) {
        const action = rule.getAction ? rule.getAction() : rule.action;
        const value = rule.getValue ? rule.getValue() : rule.value;
        
        // 첫 번째 단어에 값 적용
        if (action === 'replace') {
          // 첫 번째 단어만 교체하고 나머지는 제거
          words[startIdx] = value;
          
          // 그룹 내 나머지 단어 제거 (구분자 포함)
          for (let i = startIdx + 1; i <= endIdx; i++) {
            words[i] = '';
          }
        } else if (action === 'remove') {
          // 그룹 내 모든 단어 제거
          for (let i = startIdx; i <= endIdx; i++) {
            words[i] = '';
          }
        } else if (action === 'prefix') {
          // 첫 번째 단어에만 접두사 추가
          words[startIdx] = value + words[startIdx];
        } else if (action === 'suffix') {
          // 마지막 단어에만 접미사 추가
          words[endIdx] = words[endIdx] + value;
        }
      }
    }
    
    // 모든 단어 조각 합치기 (빈 문자열 제거)
    return words.join('');
  }
  
  // 기존 로직 - 모든 파일에 적용하는 경우 패턴 사용
  if (applyToAll) {
    // 모든 규칙 및 패턴에 대해 적용
    for (const rule of wordRules) {
      const action = rule.getAction ? rule.getAction() : rule.action;
      const value = rule.getValue ? rule.getValue() : rule.value;
      
      for (const pattern of wordPatterns) {
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          
          // 구분자 건너뛰기
          if (/[_\-\s]/.test(word)) continue;
          
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
  // 특수문자가 있는 단어도 정확히 매칭하도록 수정
  return {
    word: word,
    pattern: new RegExp(escapeRegExp(word), 'g')
  };
}

/**
 * 파일명에서 패턴 구조 추출
 * 숫자는 #으로, 알파벳은 그대로 유지
 * @param {string} fileName - 파일명
 * @returns {string} 패턴 구조
 */
function extractFilePattern(fileName) {
  return fileName.replace(/[0-9]+/g, match => '#'.repeat(match.length));
}

/**
 * 두 패턴 간의 유사도 계산 (0~1)
 * @param {string} pattern1 - 첫 번째 패턴
 * @param {string} pattern2 - 두 번째 패턴
 * @returns {number} 유사도 (0~1)
 */
function calculatePatternSimilarity(pattern1, pattern2) {
  // 레벤슈타인 거리 계산 (문자열 간 편집 거리)
  const distance = levenshteinDistance(pattern1, pattern2);
  const maxLength = Math.max(pattern1.length, pattern2.length);
  
  // 구조적 유사도 = 1 - (거리 / 최대 길이)
  const structureSimilarity = 1 - (distance / maxLength);
  
  // 위치 유사도 계산
  const positionSimilarity = calculatePositionSimilarity(pattern1, pattern2);
  
  // 최종 유사도는 구조적 유사도와 위치 유사도의 가중 평균
  // 구조적 유사도에 더 많은 가중치(0.7)를 줌
  return (structureSimilarity * 0.7) + (positionSimilarity * 0.3);
}

/**
 * 레벤슈타인 거리 계산 (두 문자열 간의 편집 거리)
 * @param {string} a - 첫 번째 문자열
 * @param {string} b - 두 번째 문자열
 * @returns {number} 편집 거리
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  
  // 행렬 초기화
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // 행렬 채우기
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 대체
          matrix[i][j - 1] + 1,     // 삽입
          matrix[i - 1][j] + 1      // 삭제
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * 두 패턴의 위치 유사도 계산
 * 특수 문자(#, _, -, 등)의 위치를 고려하여 유사도 계산
 * @param {string} pattern1 - 첫 번째 패턴
 * @param {string} pattern2 - 두 번째 패턴
 * @returns {number} 위치 유사도 (0~1)
 */
function calculatePositionSimilarity(pattern1, pattern2) {
  // 특수 문자 위치 추출
  const specialChars = ['#', '_', '-', '.'];
  const positions1 = {};
  const positions2 = {};
  
  // 각 특수 문자의 위치 패턴 추출
  specialChars.forEach(char => {
    positions1[char] = getCharPositions(pattern1, char);
    positions2[char] = getCharPositions(pattern2, char);
  });
  
  // 위치 유사도 계산
  let totalSimilarity = 0;
  let totalWeight = 0;
  
  specialChars.forEach(char => {
    const pos1 = positions1[char];
    const pos2 = positions2[char];
    
    // 둘 다 해당 문자가 있는 경우에만 계산
    if (pos1.length > 0 && pos2.length > 0) {
      // 상대적 위치 배열로 변환 (0~1 범위)
      const relPos1 = pos1.map(p => p / pattern1.length);
      const relPos2 = pos2.map(p => p / pattern2.length);
      
      // 두 배열 간의 위치 유사도 계산
      const similarity = calculatePositionArraySimilarity(relPos1, relPos2);
      
      // 가중치는 문자 출현 횟수에 비례
      const weight = Math.max(pos1.length, pos2.length);
      totalSimilarity += similarity * weight;
      totalWeight += weight;
    }
  });
  
  // 유사도 계산이 가능한 경우만 처리
  return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
}

/**
 * 문자열에서 특정 문자의 위치 배열 반환
 * @param {string} str - 검색할 문자열
 * @param {string} char - 찾을 문자
 * @returns {Array} 위치 배열
 */
function getCharPositions(str, char) {
  const positions = [];
  let pos = str.indexOf(char);
  
  while (pos !== -1) {
    positions.push(pos);
    pos = str.indexOf(char, pos + 1);
  }
  
  return positions;
}

/**
 * 두 위치 배열 간의 유사도 계산
 * @param {Array} arr1 - 첫 번째 위치 배열 (0~1 범위의 상대적 위치)
 * @param {Array} arr2 - 두 번째 위치 배열 (0~1 범위의 상대적 위치)
 * @returns {number} 위치 유사도 (0~1)
 */
function calculatePositionArraySimilarity(arr1, arr2) {
  // 배열 길이가 다른 경우
  if (arr1.length !== arr2.length) {
    // 가장 가까운 위치끼리 매칭
    let totalDiff = 0;
    
    // 두 배열 중 작은 쪽을 기준으로 순회
    const shorter = arr1.length < arr2.length ? arr1 : arr2;
    const longer = arr1.length < arr2.length ? arr2 : arr1;
    
    shorter.forEach(pos => {
      // 가장 가까운 위치 찾기
      const closestPos = longer.reduce((closest, curr) => {
        return Math.abs(curr - pos) < Math.abs(closest - pos) ? curr : closest;
      }, longer[0]);
      
      // 차이 누적
      totalDiff += Math.abs(pos - closestPos);
    });
    
    // 유사도 계산 (차이가 클수록 유사도는 낮아짐)
    return Math.max(0, 1 - totalDiff / shorter.length);
  } else {
    // 배열 길이가 같은 경우는 직접 비교
    let totalDiff = 0;
    
    for (let i = 0; i < arr1.length; i++) {
      totalDiff += Math.abs(arr1[i] - arr2[i]);
    }
    
    // 유사도 계산 (차이가 클수록 유사도는 낮아짐)
    return Math.max(0, 1 - totalDiff / arr1.length);
  }
}

/**
 * 파일명에서 이름 추출 (경로 제외)
 * @param {string} filePath - 파일 경로
 * @returns {string} 파일명 (경로 제외)
 */
function getFileName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

export { addWordRule, applyWordRules, createWordPattern, splitWordsInFileName, extractFilePattern, calculatePatternSimilarity, selectSimilarPatternWords }; 