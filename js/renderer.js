/**
 * 렌더러 메인 모듈
 * 애플리케이션의 진입점으로, 모든 기능을 초기화하고 이벤트 리스너를 설정합니다.
 */

// Core 모듈 임포트
import DOM from './core/dom.js';
import State from './core/state.js';
import { saveToHistory, updateHistoryButtons, undo, redo } from './core/history.js';

// 유틸리티 모듈 임포트
import { showToast, showToastWithDetails } from './utils/toast.js';
import { 
  getFileName, 
  splitFileName, 
  splitFilePath, 
  processRenameResults, 
  processDroppedFiles,
  copyToClipboard
} from './utils/file-utils.js';
import { getCurrentDateFormat, formatDate } from './utils/date-formatter.js';

// 이름 변경 방식 모듈 임포트
import { applyPattern, checkDateVariableInPattern } from './rename-methods/pattern.js';
import { applyFindReplace, escapeRegExp } from './rename-methods/replace.js';
import { applyRegex } from './rename-methods/regex.js';
import { addWordRule, applyWordRules, createWordPattern } from './rename-methods/word.js';
import { applyNumbering, createSortedIndexMap } from './rename-methods/numbering.js';
import { applyExpression, formatTime } from './rename-methods/expression.js';

// 컴포넌트 모듈 임포트
import {
  closeInputModal,
  showInputModal,
  setupModalHandlers,
  saveCurrentRule,
  openRulesModal,
  loadRule,
  deleteRule
} from './components/modal.js';

/**
 * 선택된 파일 목록 업데이트
 */
async function handleFiles(fileList) {
  // 파일 배열로 변환
  const files = processDroppedFiles(fileList);
  
  if (files.length > 0) {
    // 첫 파일 추가 시 히스토리 초기화
    if (State.selectedFiles.length === 0) {
      console.log('First files added, initializing history');
      State.fileHistory = [];
      State.historyIndex = -1;
      State.initialState = null;
    }
    
    // 히스토리 저장
    saveToHistory('add-files');
    
    // 파일 추가
    State.selectedFiles = [...State.selectedFiles, ...files];
    
    // 미디어 파일 감지 및 메타데이터 로드 시작
    loadMediaMetadata(files);
    
    updateUI();
    console.log(`Added ${files.length} files, total: ${State.selectedFiles.length}`);
  }
}

/**
 * 미디어 파일 메타데이터 로드
 * @param {Array} files - 파일 경로 배열
 */
async function loadMediaMetadata(files) {
  // 미디어 파일 필터링
  const mediaFiles = files.filter(file => {
    const isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(file);
    const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i.test(file);
    return isImage || isVideo;
  });
  
  if (mediaFiles.length === 0) return;
  
  // 로딩 상태 표시
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'media-loading-indicator';
  loadingIndicator.innerHTML = `
    <div class="loading-icon"></div>
    <div class="loading-text">Loading media info: <span id="loadingProgress">0/${mediaFiles.length}</span></div>
  `;
  document.body.appendChild(loadingIndicator);
  
  const progressSpan = document.getElementById('loadingProgress');
  let completed = 0;
  
  // 각 파일에 대해 병렬로 처리 (동시 요청 수 제한)
  const batchSize = 3; // 동시 처리할 최대 파일 수
  
  for (let i = 0; i < mediaFiles.length; i += batchSize) {
    const batch = mediaFiles.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (file) => {
      try {
        // 이미 캐시된 경우 스킵
        if (State.mediaCache[file]) {
          completed++;
          if (progressSpan) progressSpan.textContent = `${completed}/${mediaFiles.length}`;
          return;
        }
        
        const isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(file);
        const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i.test(file);
        
        // 기본 메타데이터 정보
        const metadata = {
          width: 0,
          height: 0,
          duration: 0,
          frames: 0,
          isImage,
          isVideo,
          loaded: false
        };
        
        // Electron API로 미디어 정보 가져오기
        if (window.electron && window.electron.getImageSize) {
          try {
            const dimensions = await window.electron.getImageSize(file);
            if (dimensions) {
              metadata.width = dimensions.width || 0;
              metadata.height = dimensions.height || 0;
              
              // 비디오 파일인 경우 duration 정보와 frames 정보
              if (isVideo) {
                if (dimensions.duration) {
                  metadata.duration = parseFloat(dimensions.duration) || 0;
                }
                if (dimensions.frames) {
                  metadata.frames = parseInt(dimensions.frames) || 0;
                }
              }
              
              metadata.loaded = true;
              console.log(`Loaded media info for ${file}: ${metadata.width}x${metadata.height}, duration: ${metadata.duration}s, frames: ${metadata.frames}`);
            }
          } catch (error) {
            console.error(`Error loading media info for ${file}:`, error);
          }
        }
        
        // 캐시에 저장
        State.mediaCache[file] = metadata;
        
        // 진행 상태 업데이트
        completed++;
        if (progressSpan) progressSpan.textContent = `${completed}/${mediaFiles.length}`;
      } catch (error) {
        console.error(`Error processing media file ${file}:`, error);
        completed++;
        if (progressSpan) progressSpan.textContent = `${completed}/${mediaFiles.length}`;
      }
    }));
  }
  
  // 모든 미디어 파일 처리 완료
  if (loadingIndicator && document.body.contains(loadingIndicator)) {
    loadingIndicator.classList.add('fade-out');
    setTimeout(() => {
      if (document.body.contains(loadingIndicator)) {
        document.body.removeChild(loadingIndicator);
      }
    }, 500);
  }
  
  // 미리보기 업데이트
  updatePreview();
}

/**
 * UI 업데이트
 */
function updateUI() {
  if (State.selectedFiles.length === 0) {
    DOM.mainContent.classList.add('empty');
    DOM.emptyDropArea.style.display = 'flex';
    DOM.filesPreview.classList.add('hidden');
    DOM.applyBtn.disabled = true;
  } else {
    DOM.mainContent.classList.remove('empty');
    DOM.emptyDropArea.style.display = 'none';
    DOM.filesPreview.classList.remove('hidden');
    
    DOM.applyBtn.disabled = false;
    
    // 파일 개수 업데이트
    DOM.fileCount.textContent = State.selectedFiles.length === 1 
      ? '1 file selected' 
      : `${State.selectedFiles.length} files selected`;
    
    // 미리보기 업데이트
    updatePreview();
  }
  
  // 히스토리 버튼 상태 업데이트
  updateHistoryButtons(DOM.undoBtn, DOM.redoBtn);
}

/**
 * 파일 목록 업데이트
 */
function updateFileList() {
  DOM.fileList.innerHTML = '';
  
  if (State.selectedFiles.length === 0) {
    return;
  }
  
  State.selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    // 파일 아이콘 추가
    const fileIcon = document.createElement('div');
    fileIcon.className = 'file-icon';
    fileIcon.innerHTML = '📄';
    
    // 상세 정보 컨테이너 생성
    const fileDetails = document.createElement('div');
    fileDetails.className = 'file-details';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = getFileName(file);
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = file;
    
    // 상세 정보 추가
    fileDetails.appendChild(fileName);
    fileDetails.appendChild(fileInfo);
    
    // 제거 버튼 생성
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', () => {
      State.selectedFiles.splice(index, 1);
      updateUI();
    });
    
    // 요소들을 파일 항목에 추가
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileDetails);
    fileItem.appendChild(removeBtn);
    DOM.fileList.appendChild(fileItem);
  });
}

/**
 * 미리보기 업데이트
 */
async function updatePreview() {
  if (State.selectedFiles.length === 0) {
    DOM.previewArea.innerHTML = '<p>Select files to see preview</p>';
    return;
  }
  
  DOM.previewArea.innerHTML = '';
  
  const previewList = document.createElement('div');
  previewList.className = 'preview-list';
  
  for (let index = 0; index < State.selectedFiles.length; index++) {
    const file = State.selectedFiles[index];
    const oldName = getFileName(file);
    const newName = await generateNewName(file, index);
    
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    
    const oldNameEl = document.createElement('div');
    oldNameEl.className = 'old-name';
    
    // 단어 선택 방식일 때 단어를 선택 가능하게 처리
    if (State.currentMethod === 'word') {
      const words = oldName.split(/(\W+)/); // 단어와 비단어로 분리
      words.forEach((word, wordIndex) => {
        if (word.trim() === '') return; // 빈 문자열 건너뛰기
        
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word-token';
        wordSpan.textContent = word;
        wordSpan.dataset.fileIndex = index;
        wordSpan.dataset.wordIndex = wordIndex;
        wordSpan.dataset.word = word;
        
        // 이 단어가 선택됐는지 확인
        const isSelected = State.selectedWordTokens.some(token => 
          token.fileIndex == index && token.wordIndex == wordIndex
        );
        
        if (isSelected) {
          wordSpan.classList.add('selected');
        }
        
        wordSpan.addEventListener('click', () => {
          // 선택 토글
          if (wordSpan.classList.contains('selected')) {
            wordSpan.classList.remove('selected');
            // 선택된 토큰에서 제거
            const tokenIndex = State.selectedWordTokens.findIndex(token => 
              token.fileIndex == index && token.wordIndex == wordIndex
            );
            if (tokenIndex !== -1) {
              State.selectedWordTokens.splice(tokenIndex, 1);
            }
          } else {
            wordSpan.classList.add('selected');
            // 선택된 토큰에 추가
            State.selectedWordTokens.push({
              fileIndex: index,
              wordIndex: wordIndex,
              word: word
            });
            
            // 일괄 적용 위한 패턴 저장
            if (DOM.applyToAllFiles && DOM.applyToAllFiles.checked) {
              // 이 단어 패턴이 이미 저장됐는지 확인
              if (!State.wordPatterns.some(pattern => pattern.word === word)) {
                State.wordPatterns.push(createWordPattern(word));
              }
            }
          }
          updatePreview();
        });
        
        oldNameEl.appendChild(wordSpan);
      });
    } else {
      oldNameEl.textContent = oldName;
    }
    
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    
    const newNameEl = document.createElement('div');
    newNameEl.className = 'new-name';
    newNameEl.textContent = newName;
    
    // 미리보기 항목에 제거 버튼 추가
    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', () => {
      // 히스토리 저장
      saveToHistory();
      
      // 파일 제거
      State.selectedFiles = [
        ...State.selectedFiles.slice(0, index),
        ...State.selectedFiles.slice(index + 1)
      ];
      
      updateUI();
      console.log(`Removed file at index ${index}, remaining: ${State.selectedFiles.length}`);
    });
    
    previewItem.appendChild(oldNameEl);
    previewItem.appendChild(arrow);
    previewItem.appendChild(newNameEl);
    previewItem.appendChild(removeBtn);
    previewList.appendChild(previewItem);
  }
  
  DOM.previewArea.appendChild(previewList);
}

/**
 * 새 파일 이름 생성
 */
async function generateNewName(filePath, index) {
  // 파일명에서 경로 추출
  const fileName = getFileName(filePath);
  const { baseName, fileExt } = splitFileName(fileName);
  
  let newName = '';
  
  // 캐시에서 미디어 메타데이터 가져오기
  let metaData = {
    width: 0,
    height: 0,
    duration: 0,
    frames: 0,
    isImage: false,
    isVideo: false
  };
  
  // 캐시된 미디어 메타데이터가 있는지 확인
  if (State.mediaCache[filePath]) {
    metaData = State.mediaCache[filePath];
  } else {
    // 기본적인 파일 타입 정보는 설정
    metaData.isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath);
    metaData.isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i.test(filePath);
  }
  
  switch (State.currentMethod) {
    case 'pattern':
      newName = await applyPattern(
        baseName, 
        fileExt, 
        index, 
        DOM.patternInput.value,
        filePath,
        metaData
      );
      break;
    case 'replace':
      newName = applyFindReplace(
        fileName, 
        fileExt, 
        DOM.findText.value, 
        DOM.replaceText.value, 
        DOM.caseSensitive.checked
      );
      break;
    case 'regex':
      newName = applyRegex(
        fileName, 
        fileExt, 
        DOM.regexPattern.value, 
        DOM.regexReplacement.value
      );
      break;
    case 'word':
      newName = applyWordRules(
        fileName, 
        fileExt, 
        index, 
        State.wordRules, 
        State.selectedWordTokens, 
        State.wordPatterns, 
        DOM.applyToAllFiles && DOM.applyToAllFiles.checked
      );
      break;
    case 'numbering':
      newName = applyNumbering(baseName, fileExt, index, {
        pattern: DOM.numberingPattern ? DOM.numberingPattern.value : '{name}_{num}',
        start: DOM.startNumber ? parseInt(DOM.startNumber.value) || 1 : 1,
        padding: DOM.numberPadding ? parseInt(DOM.numberPadding.value) || 0 : 0,
        step: DOM.numberStep ? parseInt(DOM.numberStep.value) || 1 : 1
      });
      break;
    case 'expression':
      newName = await applyExpression(
        baseName, 
        fileExt, 
        fileName, 
        filePath, 
        index, 
        DOM.expressionInput ? DOM.expressionInput.value : null,
        metaData
      );
      break;
  }
  
  return newName;
}

/**
 * 이름 변경 실행
 */
async function renameFiles() {
  if (State.selectedFiles.length === 0) return;
  
  try {
    DOM.applyBtn.disabled = true;
    DOM.applyBtn.textContent = 'Processing...';
    
    // 초기 상태 저장
    if (State.initialState === null) {
      saveToHistory('initial');
    }
    
    let config = {};
    let results = [];
    
    switch (State.currentMethod) {
      case 'pattern':
        config = {
          method: 'pattern',
          pattern: DOM.patternInput.value || '{name}'
        };
        
        results = await window.api.renameFiles(State.selectedFiles, config);
        break;
        
      case 'replace':
        config = {
          method: 'replace',
          find: DOM.findText.value,
          replace: DOM.replaceText.value,
          caseSensitive: DOM.caseSensitive.checked,
          matchAll: true
        };
        
        results = await window.api.renameFiles(State.selectedFiles, config);
        break;
        
      case 'regex':
        config = {
          method: 'regex',
          pattern: DOM.regexPattern.value,
          replacement: DOM.regexReplacement.value
        };
        
        results = await window.api.renameFiles(State.selectedFiles, config);
        break;
        
      case 'word':
        // 단어 방식은 각 파일별로 개별 처리
        config = {
          method: 'word',
          applyToAll: DOM.applyToAllFiles && DOM.applyToAllFiles.checked
        };
        
        // 모든 파일의 새 이름 생성
        const wordResults = [];
        
        for (let i = 0; i < State.selectedFiles.length; i++) {
          const file = State.selectedFiles[i];
          const fileName = getFileName(file);
          const newName = applyWordRules(
            fileName, 
            '', 
            i, 
            State.wordRules, 
            State.selectedWordTokens, 
            State.wordPatterns, 
            DOM.applyToAllFiles && DOM.applyToAllFiles.checked
          );
          
          // 개별 파일 이름 변경
          const fileConfig = { 
            ...config, 
            wordResult: newName 
          };
          
          const result = await window.api.renameFiles([file], fileConfig);
          wordResults.push(...result);
        }
        
        results = wordResults;
        break;
        
      case 'numbering':
        config = {
          method: 'numbering',
          pattern: DOM.numberingPattern ? DOM.numberingPattern.value : '{name}_{num}',
          startNumber: DOM.startNumber ? parseInt(DOM.startNumber.value) || 1 : 1,
          padding: DOM.numberPadding ? parseInt(DOM.numberPadding.value) || 0 : 0,
          step: DOM.numberStep ? parseInt(DOM.numberStep.value) || 1 : 1,
          sort: DOM.sortingMethod ? DOM.sortingMethod.value : 'name',
          reverse: DOM.reverseOrder ? DOM.reverseOrder.checked : false
        };
        
        results = await window.api.renameFiles(State.selectedFiles, config);
        break;
        
      case 'expression':
        // 표현식 방식도 각 파일별로 개별 처리
        const expressionResults = [];
        
        for (let i = 0; i < State.selectedFiles.length; i++) {
          const file = State.selectedFiles[i];
          const fileName = getFileName(file);
          const { baseName, fileExt } = splitFileName(fileName);
          
          // 해당 파일의 새 이름 생성
          const newName = await applyExpression(
            baseName, 
            fileExt, 
            fileName, 
            file, 
            i, 
            DOM.expressionInput ? DOM.expressionInput.value : null
          );
          
          if (newName !== fileName) {
            // 단일 파일 이름 변경
            const fileConfig = {
              method: 'pattern',
              pattern: newName
            };
            
            try {
              const result = await window.api.renameFiles([file], fileConfig);
              expressionResults.push(...result);
            } catch (error) {
              console.error(`Error renaming file ${file}:`, error);
              expressionResults.push({
                oldPath: file,
                success: false,
                error: error.message
              });
            }
          } else {
            // 이름이 변경되지 않은 경우 (성공으로 처리)
            expressionResults.push({
              oldPath: file,
              newPath: file,
              success: true
            });
          }
        }
        
        results = expressionResults;
        break;
    }
    
    // 결과 처리
    handleRenameResults(results);
    
    // 히스토리 저장
    saveToHistory('rename-' + State.currentMethod);
    
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    DOM.applyBtn.textContent = 'Rename Files';
    DOM.applyBtn.disabled = State.selectedFiles.length === 0;
  }
}

/**
 * 이름 변경 결과 처리
 */
function handleRenameResults(results) {
  // 결과 저장
  State.lastRenameResults = results;
  
  // 결과 처리
  const { message, type, successCount, errorCount } = processRenameResults(results);
  
  // 토스트 표시
  showToastWithDetails(message, type);
  
  // 성공한 파일 업데이트
  updateSuccessfulFiles(results);
}

/**
 * 성공한 파일 업데이트
 */
function updateSuccessfulFiles(results) {
  // 성공한 파일 추출
  const successfulResults = results.filter(r => r.success);
  
  // 파일 목록 업데이트
  successfulResults.forEach(result => {
    // 기존 파일 경로와 일치하는 항목 찾기
    const fileIndex = State.selectedFiles.findIndex(file => file === result.oldPath);
    if (fileIndex !== -1) {
      // 성공한 파일의 경로 업데이트
      State.selectedFiles[fileIndex] = result.newPath;
    }
  });
  
  // UI 업데이트
  updatePreview();
}

/**
 * 결과 표시
 */
function showResults(results) {
  DOM.resultList.innerHTML = '';
  
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${result.success ? 'success' : 'error'}`;
    
    const oldPathEl = document.createElement('div');
    oldPathEl.className = 'path';
    oldPathEl.textContent = `Original: ${result.oldPath}`;
    
    resultItem.appendChild(oldPathEl);
    
    if (result.success) {
      const newPathEl = document.createElement('div');
      newPathEl.className = 'path';
      newPathEl.textContent = `Renamed to: ${result.newPath}`;
      resultItem.appendChild(newPathEl);
    } else {
      const errorEl = document.createElement('div');
      errorEl.className = 'error-msg';
      errorEl.textContent = `Error: ${result.error}`;
      resultItem.appendChild(errorEl);
    }
    
    DOM.resultList.appendChild(resultItem);
  });
  
  DOM.resultArea.classList.remove('hidden');
}

/**
 * 앱 초기화
 */
function initializeApp() {
  // 상태 초기화
  State.resetState();
  
  // 탭 이벤트 리스너
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 활성 탭 업데이트
      DOM.tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 현재 방식 업데이트
      State.currentMethod = tab.getAttribute('data-method');
      
      // 활성 패널 업데이트
      document.querySelectorAll('.method-content').forEach(panel => {
        panel.classList.remove('active');
      });
      
      document.getElementById(`${State.currentMethod}-panel`).classList.add('active');
      
      // 미리보기 업데이트
      updatePreview();
    });
  });
  
  // 드래그 앤 드롭 이벤트
  DOM.mainContent.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    DOM.mainContent.classList.add('drop-active');
  });
  
  DOM.mainContent.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 영역을 실제로 벗어났는지 확인
    const rect = DOM.mainContent.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      DOM.mainContent.classList.remove('drop-active');
    }
  });
  
  DOM.mainContent.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    DOM.mainContent.classList.remove('drop-active');
    
    handleFiles(e.dataTransfer.files);
  });
  
  // 파일 선택 버튼
  DOM.fileSelectBtn.addEventListener('click', async () => {
    const filePaths = await window.api.getFilePaths();
    if (filePaths && filePaths.length > 0) {
      handleFiles(filePaths);
    }
  });
  
  // 적용 버튼
  DOM.applyBtn.addEventListener('click', renameFiles);
  
  // 결과 영역 컨트롤
  DOM.closeResultsBtn.addEventListener('click', () => {
    DOM.resultArea.classList.add('hidden');
  });
  
  DOM.doneBtn.addEventListener('click', () => {
    DOM.resultArea.classList.add('hidden');
  });
  
  // 모든 파일 지우기 버튼
  DOM.clearBtn.addEventListener('click', () => {
    if (State.selectedFiles.length > 0) {
      // 히스토리 저장
      saveToHistory();
      
      State.selectedFiles = [];
      updateUI();
      DOM.resultArea.classList.add('hidden');
      console.log('All files cleared');
    }
  });
  
  // 패턴 입력 필드
  if (DOM.patternInput) {
    DOM.patternInput.addEventListener('input', async () => {
      // 패턴에 {date} 변수 확인
      checkDateVariableInPattern(
        DOM.patternInput.value || '',
        DOM.dateFormatContainer,
        DOM.dateFormatOptions,
        DOM.toggleDateOptions
      );
      await updatePreview();
    });
  }
  
  // 패턴 확장 변수 토글 버튼
  const togglePatternVarsBtn = document.getElementById('togglePatternVarsBtn');
  const patternExtendedVars = document.getElementById('patternExtendedVars');
  
  if (togglePatternVarsBtn && patternExtendedVars) {
    togglePatternVarsBtn.addEventListener('click', () => {
      const isVisible = patternExtendedVars.style.display !== 'none';
      
      if (isVisible) {
        patternExtendedVars.style.display = 'none';
        togglePatternVarsBtn.textContent = 'More Variables ▼';
      } else {
        patternExtendedVars.style.display = 'block';
        togglePatternVarsBtn.textContent = 'Close ▲';
      }
    });
  }
  
  // 찾기/바꾸기 필드
  if (DOM.findText) DOM.findText.addEventListener('input', async () => await updatePreview());
  if (DOM.replaceText) DOM.replaceText.addEventListener('input', async () => await updatePreview());
  if (DOM.caseSensitive) DOM.caseSensitive.addEventListener('change', async () => await updatePreview());
  
  // 정규식 필드
  if (DOM.regexPattern) DOM.regexPattern.addEventListener('input', async () => await updatePreview());
  if (DOM.regexReplacement) DOM.regexReplacement.addEventListener('input', async () => await updatePreview());
  
  // 날짜 포맷 UI
  if (DOM.toggleDateOptions) {
    DOM.toggleDateOptions.addEventListener('click', () => {
      DOM.dateFormatOptions.classList.toggle('expanded');
      DOM.toggleDateOptions.textContent = DOM.dateFormatOptions.classList.contains('expanded') ? 'Options ▲' : 'Options ▼';
    });
  }
  
  // 날짜 포맷 설정
  if (DOM.dateFormatPreset) {
    DOM.dateFormatPreset.value = 'YYYY-MM-DD'; // 기본값
    
    DOM.dateFormatPreset.addEventListener('change', async () => {
      const isCustom = DOM.dateFormatPreset.value === 'custom';
      
      if (isCustom) {
        DOM.customDateFormat.classList.add('active');
        DOM.dateFormatCustom.focus();
      } else {
        DOM.customDateFormat.classList.remove('active');
      }
      
      await updatePreview();
    });
  }
  
  // 커스텀 날짜 포맷
  if (DOM.dateFormatCustom) {
    DOM.dateFormatCustom.addEventListener('input', async () => await updatePreview());
  }
  
  // 단어 방식 컨트롤
  if (DOM.addWordRuleBtn) {
    DOM.addWordRuleBtn.addEventListener('click', () => {
      const newRule = addWordRule(DOM.wordRulesContainer, updatePreview);
      State.wordRules.push(newRule);
      updatePreview();
    });
  }
  
  if (DOM.applyToAllFiles) {
    DOM.applyToAllFiles.addEventListener('change', () => {
      // 체크 해제 시 패턴 초기화
      if (!DOM.applyToAllFiles.checked) {
        State.wordPatterns = [];
      }
      updatePreview();
    });
  }
  
  // 넘버링 방식 컨트롤
  if (DOM.numberingPattern) DOM.numberingPattern.addEventListener('input', async () => await updatePreview());
  if (DOM.startNumber) DOM.startNumber.addEventListener('input', async () => await updatePreview());
  if (DOM.numberPadding) DOM.numberPadding.addEventListener('input', async () => await updatePreview());
  if (DOM.numberStep) DOM.numberStep.addEventListener('input', async () => await updatePreview());
  if (DOM.sortingMethod) DOM.sortingMethod.addEventListener('change', async () => await updatePreview());
  if (DOM.reverseOrder) DOM.reverseOrder.addEventListener('change', async () => await updatePreview());
  
  // 표현식 방식 컨트롤
  if (DOM.expressionInput) DOM.expressionInput.addEventListener('input', async () => await updatePreview());
  
  // 표현식 예제 버튼 및 예제 클릭 이벤트 추가
  if (DOM.expressionExamplesBtn) {
    DOM.expressionExamplesBtn.addEventListener('click', () => {
      DOM.expressionExamplesModal.classList.remove('hidden');
      
      // 예제 항목 이벤트 리스너 추가
      document.querySelectorAll('.example-item').forEach(item => {
        item.addEventListener('click', () => {
          const expression = item.dataset.expression;
          if (expression && DOM.expressionInput) {
            DOM.expressionInput.value = expression;
            updatePreview();
            
            // 복사 완료 메시지 표시
            if (DOM.copyStatus) {
              DOM.copyStatus.classList.remove('hidden');
              setTimeout(() => {
                DOM.copyStatus.classList.add('hidden');
              }, 2000);
            }
          }
        });
      });
    });
  }
  
  // 표현식 예제 모달 닫기 버튼
  if (DOM.closeExpressionExamplesBtn) {
    DOM.closeExpressionExamplesBtn.addEventListener('click', () => {
      DOM.expressionExamplesModal.classList.add('hidden');
    });
  }
  
  // 규칙 관리
  DOM.saveRuleBtn.addEventListener('click', saveCurrentRule);
  DOM.viewRulesBtn.addEventListener('click', openRulesModal);
  
  // 찾기/바꾸기 스왑 버튼
  if (DOM.swapReplaceBtn) {
    DOM.swapReplaceBtn.addEventListener('click', () => {
      const findValue = DOM.findText.value;
      const replaceValue = DOM.replaceText.value;
      
      // 값 교체
      DOM.findText.value = replaceValue;
      DOM.replaceText.value = findValue;
      
      // 미리보기 업데이트
      updatePreview();
      
      // 애니메이션 효과
      DOM.swapReplaceBtn.classList.add('active');
      setTimeout(() => {
        DOM.swapReplaceBtn.classList.remove('active');
      }, 300);
    });
  }
  
  // 히스토리 버튼
  if (DOM.undoBtn) {
    DOM.undoBtn.addEventListener('click', undo);
  }
  
  if (DOM.redoBtn) {
    DOM.redoBtn.addEventListener('click', redo);
  }
  
  // 익스프레션 도움말 토글
  if (DOM.toggleExpressionHelpBtn && DOM.expressionHelp) {
    // 기본적으로 도움말 표시
    let isHelpVisible = true;
    
    DOM.toggleExpressionHelpBtn.addEventListener('click', () => {
      isHelpVisible = !isHelpVisible;
      
      if (isHelpVisible) {
        DOM.expressionHelp.classList.remove('collapsed');
        DOM.toggleExpressionHelpBtn.textContent = 'Help ▼';
      } else {
        DOM.expressionHelp.classList.add('collapsed');
        DOM.toggleExpressionHelpBtn.textContent = 'Help ▲';
      }
    });
  }
  
  // 토스트 결과 이벤트 리스너
  document.addEventListener('show-rename-results', (e) => {
    showResults(e.detail);
  });
  
  // 파일 업데이트 이벤트 리스너
  document.addEventListener('files-updated', () => {
    updateUI();
  });
  
  // 히스토리 변경 이벤트 리스너
  document.addEventListener('history-changed', () => {
    updateHistoryButtons(DOM.undoBtn, DOM.redoBtn);
  });
  
  // 미리보기 업데이트 이벤트 리스너
  document.addEventListener('preview-update', () => {
    updatePreview();
  });
  
  // 메소드 변경 이벤트 리스너
  document.addEventListener('method-changed', (event) => {
    const method = event.detail.method;
    console.log('Method changed event received:', method);
    
    // 현재 메소드 업데이트
    State.currentMethod = method;
    
    // 해당 메소드의 탭 찾기
    const tab = document.querySelector(`.tab[data-method="${method}"]`);
    if (tab) {
      console.log('Found tab for method:', method);
      
      // 모든 탭 비활성화
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
      });
      
      // 선택한 탭 활성화
      tab.classList.add('active');
      
      // 모든 컨텐츠 패널 비활성화
      document.querySelectorAll('.method-content').forEach(panel => {
        panel.classList.remove('active');
      });
      
      // 선택한 메소드의 컨텐츠 패널 활성화
      const panel = document.getElementById(`${method}-panel`);
      if (panel) {
        panel.classList.add('active');
        console.log('Activated panel:', method);
      } else {
        console.error('Panel not found for method:', method);
      }
    } else {
      console.error('Tab not found for method:', method);
    }
    
    // 미리보기 업데이트
    updatePreview();
  });
  
  // 모달 핸들러 설정
  setupModalHandlers();
  
  // UI 초기화
  updateUI();
}

// 앱 초기화
initializeApp(); 