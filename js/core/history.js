/**
 * 히스토리 관리 모듈
 * 파일 작업 히스토리 관리와 실행취소/다시실행 기능을 제공합니다.
 */

import State from './state.js';
import { showToast } from '../utils/toast.js';

/**
 * 현재 상태를 히스토리에 저장
 * @param {string} operation - 수행된 작업 정보
 */
function saveToHistory(operation = null) {
  // undo/redo 작업 중이면 히스토리에 저장하지 않음
  if (State.isUndoRedoAction) return;

  // 현재 파일 목록 복사 (깊은 복사)
  const currentState = {
    files: JSON.parse(JSON.stringify(State.selectedFiles)),
    operation: operation // 수행된 작업 정보
  };
  
  // 초기 상태 저장 (첫 번째 변경점 인식을 위함)
  if (State.initialState === null && State.selectedFiles.length > 0) {
    State.initialState = {
      files: JSON.parse(JSON.stringify(State.selectedFiles)),
      operation: null
    };
    console.log('Initial state saved');
    
    // 첫 번째 작업 전에 초기 상태를 히스토리에 저장
    State.fileHistory.push(State.initialState);
    State.historyIndex = 0;
  }
  
  // 이전 상태와 현재 상태가 같으면 저장하지 않음
  if (State.fileHistory.length > 0 && State.historyIndex >= 0) {
    const prevState = State.fileHistory[State.historyIndex];
    if (JSON.stringify(prevState.files) === JSON.stringify(currentState.files)) {
      return; // 변화가 없으면 히스토리에 추가하지 않음
    }
  }
  
  // 히스토리 인덱스 이후의 내용 제거 (undo 후 새 작업 시)
  if (State.historyIndex < State.fileHistory.length - 1) {
    State.fileHistory = State.fileHistory.slice(0, State.historyIndex + 1);
  }
  
  // 히스토리에 현재 상태 추가
  State.fileHistory.push(currentState);
  
  // 최대 히스토리 개수 제한
  if (State.fileHistory.length > State.MAX_HISTORY) {
    State.fileHistory.shift();
    State.historyIndex = Math.max(0, State.historyIndex - 1);
  } else {
    // 현재 인덱스 업데이트
    State.historyIndex = State.fileHistory.length - 1;
  }
  
  console.log(`History saved: index=${State.historyIndex}, total=${State.fileHistory.length}, operation=${operation}`);
  
  // 버튼 상태 업데이트 이벤트 발생
  const event = new CustomEvent('history-changed');
  document.dispatchEvent(event);
}

/**
 * 히스토리 버튼 상태 업데이트
 * @param {HTMLElement} undoBtn - 실행취소 버튼
 * @param {HTMLElement} redoBtn - 다시실행 버튼
 */
function updateHistoryButtons(undoBtn, redoBtn) {
  if (!undoBtn || !redoBtn) return;
  
  // 첫 번째 상태부터 undo 가능하도록 historyIndex > 0 조건 사용
  undoBtn.disabled = State.historyIndex <= 0;
  redoBtn.disabled = State.historyIndex >= State.fileHistory.length - 1 || State.fileHistory.length <= 1;
  
  // 비활성화된 버튼의 경우 추가 스타일 클래스 적용
  if (undoBtn.disabled) {
    undoBtn.classList.add('disabled');
  } else {
    undoBtn.classList.remove('disabled');
  }
  
  if (redoBtn.disabled) {
    redoBtn.classList.add('disabled');
  } else {
    redoBtn.classList.remove('disabled');
  }
  
  console.log(`Button states - Undo: ${!undoBtn.disabled}, Redo: ${!redoBtn.disabled}`);
}

/**
 * 실행취소 기능
 * @returns {Promise<boolean>} 성공 여부
 */
async function undo() {
  console.log(`Undo requested: current index=${State.historyIndex}, history length=${State.fileHistory.length}`);
  
  if (State.historyIndex > 0) {
    State.isUndoRedoAction = true;
    
    // 현재 상태 및 이전 상태 가져오기
    const currentState = State.fileHistory[State.historyIndex];
    State.historyIndex--;
    const prevState = State.fileHistory[State.historyIndex];
    
    console.log(`Undo to index: ${State.historyIndex}`);
    
    try {
      // 파일 시스템에 변경 적용
      if (prevState.files.length > 0 && currentState.files.length > 0) {
        // 1. 현재 상태의 파일들을 이전 상태의 이름으로 되돌림
        const renameResults = await performFileSystemRevert(currentState.files, prevState.files);
        
        if (renameResults && renameResults.some(r => !r.success)) {
          console.error('Some files failed to rename during undo:', renameResults.filter(r => !r.success));
          showToast('Some files could not be reverted', 'error');
        }
      }
      
      // 상태 업데이트
      State.selectedFiles = JSON.parse(JSON.stringify(prevState.files));
      
      // UI 업데이트 이벤트 발생
      const event = new CustomEvent('files-updated');
      document.dispatchEvent(event);
      
      // 버튼 상태 업데이트 이벤트 발생
      const historyEvent = new CustomEvent('history-changed');
      document.dispatchEvent(historyEvent);
      
      showToast('Undo completed', 'info');
      return true;
      
    } catch (error) {
      console.error('Error during undo:', error);
      showToast(`Undo failed: ${error.message}`, 'error');
      return false;
    } finally {
      State.isUndoRedoAction = false;
    }
  }
  
  return false;
}

/**
 * 다시실행 기능
 * @returns {Promise<boolean>} 성공 여부
 */
async function redo() {
  console.log(`Redo requested: current index=${State.historyIndex}, history length=${State.fileHistory.length}`);
  
  if (State.historyIndex < State.fileHistory.length - 1) {
    State.isUndoRedoAction = true;
    
    // 현재 상태 및 다음 상태 가져오기
    const currentState = State.fileHistory[State.historyIndex];
    State.historyIndex++;
    const nextState = State.fileHistory[State.historyIndex];
    
    console.log(`Redo to index: ${State.historyIndex}`);
    
    try {
      // 파일 시스템에 변경 적용
      if (currentState.files.length > 0 && nextState.files.length > 0) {
        // 현재 상태의 파일들을 다음 상태의 이름으로 적용
        const renameResults = await performFileSystemRevert(currentState.files, nextState.files);
        
        if (renameResults && renameResults.some(r => !r.success)) {
          console.error('Some files failed to rename during redo:', renameResults.filter(r => !r.success));
          showToast('Some files could not be redone', 'error');
        }
      }
      
      // 상태 업데이트
      State.selectedFiles = JSON.parse(JSON.stringify(nextState.files));
      
      // UI 업데이트 이벤트 발생
      const event = new CustomEvent('files-updated');
      document.dispatchEvent(event);
      
      // 버튼 상태 업데이트 이벤트 발생
      const historyEvent = new CustomEvent('history-changed');
      document.dispatchEvent(historyEvent);
      
      showToast('Redo completed', 'info');
      return true;
      
    } catch (error) {
      console.error('Error during redo:', error);
      showToast(`Redo failed: ${error.message}`, 'error');
      return false;
    } finally {
      State.isUndoRedoAction = false;
    }
  }
  
  return false;
}

/**
 * 파일 시스템에서 이름 되돌리기/다시 적용하기
 * @param {Array} sourceFiles - 원본 파일 경로 배열
 * @param {Array} targetFiles - 대상 파일 경로 배열
 * @returns {Promise<Array>} 이름 변경 결과 배열
 */
async function performFileSystemRevert(sourceFiles, targetFiles) {
  // 원본 파일들과 대상 파일들 매핑
  const fileMappings = [];
  
  // 가장 간단한 매핑 방식: 인덱스 기반 (더 복잡한 상황에서는 향상 필요)
  for (let i = 0; i < Math.min(sourceFiles.length, targetFiles.length); i++) {
    if (sourceFiles[i] !== targetFiles[i]) {
      fileMappings.push({
        oldPath: sourceFiles[i],
        newPath: targetFiles[i]
      });
    }
  }
  
  console.log('File mappings for revert:', fileMappings);
  
  if (fileMappings.length === 0) {
    return []; // 변경할 파일이 없음
  }
  
  // 파일 이름 변경 수행
  const results = [];
  for (const mapping of fileMappings) {
    try {
      // 개별 파일 이름 변경 - pattern 방식 사용
      // 실제 파일 경로에서 파일명만 추출
      const oldFileName = mapping.oldPath.split(/[\\/]/).pop();
      const newFileName = mapping.newPath.split(/[\\/]/).pop();
      
      console.log(`Renaming: ${oldFileName} -> ${newFileName}`);
      
      // 파일이름만 변경하는 설정으로 변경
      const result = await window.api.renameFiles([mapping.oldPath], {
        method: 'pattern',
        // 정확한 새 파일명을 지정
        pattern: newFileName
      });
      
      results.push(...result);
    } catch (error) {
      console.error(`Error renaming file from ${mapping.oldPath} to ${mapping.newPath}:`, error);
      results.push({
        oldPath: mapping.oldPath,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

export { saveToHistory, updateHistoryButtons, undo, redo }; 