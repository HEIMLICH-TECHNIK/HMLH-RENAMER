/**
 * UI 컴포넌트
 * 애플리케이션의 UI 업데이트와 이벤트 처리를 담당합니다.
 */

import State from '../core/state.js';
import { updateHistoryButtons } from '../core/history.js';
import { updatePreview } from './preview.js';
import { updateFileList } from './file-handler.js';

/**
 * UI 업데이트
 */
export function updateUI(DOM) {
    if (!DOM) return;
    
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

        // 미리보기 업데이트
        updatePreview(DOM);
    }

    // 파일 목록 업데이트
    updateFileList(DOM);
    
    // 파일 개수 업데이트
    if (DOM.fileCount) {
        DOM.fileCount.textContent = State.selectedFiles.length === 1 ?
            '1' :
            `${State.selectedFiles.length}`;
    }

    // 히스토리 버튼 상태 업데이트
    updateHistoryButtons(DOM.undoBtn, DOM.redoBtn);
}

/**
 * 모달 표시 함수 - 애니메이션과 함께 모달을 표시합니다
 */
export function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
    }
}

/**
 * 모달 숨김 함수 - 애니메이션과 함께 모달을 숨깁니다
 */
export function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('hidden');
    }
}

/**
 * 커서 위치에 텍스트 삽입하는 도우미 함수
 */
export function insertAtCursor(field, text) {
    if (field.selectionStart || field.selectionStart === 0) {
        const startPos = field.selectionStart;
        const endPos = field.selectionEnd;
        field.value = field.value.substring(0, startPos) +
            text +
            field.value.substring(endPos, field.value.length);
        field.selectionStart = startPos + text.length;
        field.selectionEnd = startPos + text.length;
    } else {
        field.value += text;
    }

    // 입력 필드 변경 이벤트 트리거
    const event = new Event('input', { bubbles: true });
    field.dispatchEvent(event);

    // 포커스
    field.focus();
}

/**
 * 모달 초기화 함수
 */
export function initModals() {
    console.log('Initializing modals');
    
    // About 모달
    const aboutModal = document.getElementById('aboutModal');
    const openAboutModalBtn = document.getElementById('openAboutModalBtn');
    const closeAboutModalBtn = document.getElementById('closeAboutModalBtn');
    
    if (openAboutModalBtn) {
        openAboutModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Open About modal button clicked');
            showModal(aboutModal);
        });
    }
    
    if (closeAboutModalBtn) {
        closeAboutModalBtn.addEventListener('click', () => {
            hideModal(aboutModal);
        });
    }
    
    // 설정 모달
    const settingsModal = document.getElementById('settingsModal');
    const profileBtn = document.getElementById('profileBtn');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            showModal(settingsModal);
            
            // 시스템 정보 업데이트
            const systemOSElement = document.getElementById('systemOS');
            const electronVersionElement = document.getElementById('electronVersion');
            
            if (window.electron && window.electron.getSystemInfo && systemOSElement) {
                window.electron.getSystemInfo().then(info => {
                    if (systemOSElement) systemOSElement.textContent = info.os || 'Unknown';
                    if (electronVersionElement) electronVersionElement.textContent = info.electronVersion || 'Unknown';
                }).catch(err => {
                    console.error('Failed to get system info:', err);
                });
            }
        });
    }
    
    if (closeSettingsModalBtn) {
        closeSettingsModalBtn.addEventListener('click', () => {
            hideModal(settingsModal);
        });
    }
    
    // 규칙 모달
    const rulesModal = document.getElementById('rulesModal');
    const closeRulesModalBtn = document.getElementById('closeRulesModalBtn');
    
    if (closeRulesModalBtn) {
        closeRulesModalBtn.addEventListener('click', () => {
            hideModal(rulesModal);
        });
    }
    
    // 입력 모달
    const inputModal = document.getElementById('inputModal');
    const closeInputModalBtn = document.getElementById('closeInputModalBtn');
    
    if (closeInputModalBtn) {
        closeInputModalBtn.addEventListener('click', () => {
            hideModal(inputModal);
        });
    }
    
    // 표현식 예제 모달
    const expressionExamplesModal = document.getElementById('expressionExamplesModal');
    const closeExpressionExamplesBtn = document.getElementById('closeExpressionExamplesBtn');
    
    if (closeExpressionExamplesBtn) {
        closeExpressionExamplesBtn.addEventListener('click', () => {
            hideModal(expressionExamplesModal);
        });
    }
}

/**
 * 설정 탭 관리
 */
export function setupSettingsTabs() {
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsContents = document.querySelectorAll('.settings-content');
    
    if (settingsTabs.length > 0) {
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                // 모든 탭 비활성화
                settingsTabs.forEach(t => t.classList.remove('active'));

                // 현재 탭 활성화
                tab.classList.add('active');

                // 모든 콘텐츠 숨기기
                settingsContents.forEach(content => content.classList.remove('active'));

                // 선택한 탭의 콘텐츠 표시
                const activeContent = document.getElementById(`${tabId}-settings`);
                if (activeContent) {
                    activeContent.classList.add('active');
                }
            });
        });
    }
} 