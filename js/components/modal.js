/**
 * 모달 컴포넌트 모듈
 * 규칙 관리 모달, 입력 모달 등의 기능을 제공합니다.
 */

import DOM from '../core/dom.js';
import State from '../core/state.js';
import { showToast } from '../utils/toast.js';
import { addWordRule } from '../rename-methods/word.js';
import { copyToClipboard } from '../utils/file-utils.js';

/**
 * 모달 표시 함수 - 애니메이션과 함께 모달을 표시합니다
 * @param {Element} modalElement - 표시할 모달 요소
 */
export function showModal(modalElement) {
    if (!modalElement) return;

    // hidden 클래스 제거만으로 애니메이션이 트리거됨
    modalElement.classList.remove('hidden');
}

/**
 * 모달 숨김 함수 - 애니메이션과 함께 모달을 숨깁니다
 * @param {Element} modalElement - 숨길 모달 요소
 */
export function hideModal(modalElement) {
    if (!modalElement) return;

    // hidden 클래스 추가만으로 애니메이션이 트리거됨
    modalElement.classList.add('hidden');
}

/**
 * 입력 모달 닫기
 */
function closeInputModal() {
    const inputModal = document.getElementById('inputModal');
    if (inputModal) {
        hideModal(inputModal);
    }
}

/**
 * 입력 모달 표시
 */
function showInputModal(title, placeholder, confirmCallback) {
    const inputModal = document.getElementById('inputModal');
    const inputModalTitle = document.getElementById('inputModalTitle');
    const inputModalField = document.getElementById('inputModalField');
    const inputModalConfirmBtn = document.getElementById('inputModalConfirmBtn');

    if (inputModal && inputModalTitle && inputModalField && inputModalConfirmBtn) {
        // 모달 설정
        inputModalTitle.textContent = title || 'Enter Value';
        inputModalField.placeholder = placeholder || '';
        inputModalField.value = '';

        // 확인 버튼 이벤트
        const confirmHandler = () => {
            const value = inputModalField.value.trim();
            if (value && confirmCallback) {
                confirmCallback(value);
            }
            closeInputModal();

            // 이벤트 리스너 제거
            inputModalConfirmBtn.removeEventListener('click', confirmHandler);
        };

        // 이벤트 리스너 추가
        inputModalConfirmBtn.addEventListener('click', confirmHandler);

        // 모달 표시
        showModal(inputModal);

        // 입력 필드에 포커스
        setTimeout(() => inputModalField.focus(), 50);
    }
}

/**
 * 표현식 예제 모달 열기
 */
function openExpressionExamplesModal() {
    DOM.expressionExamplesModal.classList.remove('hidden');
    setupExpressionExamples();
}

/**
 * 표현식 예제 모달 닫기
 */
function closeExpressionExamplesModal() {
    DOM.expressionExamplesModal.classList.add('hidden');
}

/**
 * 표현식 예제 항목에 클릭 이벤트 설정
 */
function setupExpressionExamples() {
    const exampleItems = document.querySelectorAll('.example-item');
    exampleItems.forEach(item => {
        item.addEventListener('click', () => {
            const expression = item.getAttribute('data-expression');

            // 클립보드에 복사
            copyToClipboard(expression);

            // 복사 표시 애니메이션
            DOM.copyStatus.classList.remove('hidden');
            setTimeout(() => {
                DOM.copyStatus.classList.add('hidden');
            }, 2000);

            // 표현식 입력창에 표현식 설정
            if (DOM.expressionInput) {
                DOM.expressionInput.value = expression;

                // 모달 닫기
                closeExpressionExamplesModal();

                // 미리보기 업데이트 이벤트 발생
                document.dispatchEvent(new CustomEvent('preview-update'));
            }
        });
    });
}

/**
 * 모달 관련 이벤트 핸들러 등록
 */
function setupModalHandlers() {
    // 입력 모달 관련 이벤트
    const inputModal = document.getElementById('inputModal');
    const inputModalCancelBtn = document.getElementById('inputModalCancelBtn');
    const closeInputModalBtn = document.getElementById('closeInputModalBtn');

    if (inputModal) {
        // 모달 외부 클릭 시 닫기
        inputModal.addEventListener('click', (e) => {
            if (e.target === inputModal) {
                closeInputModal();
            }
        });

        // 취소 버튼
        if (inputModalCancelBtn) {
            inputModalCancelBtn.addEventListener('click', closeInputModal);
        }

        // 닫기 버튼
        if (closeInputModalBtn) {
            closeInputModalBtn.addEventListener('click', closeInputModal);
        }
    }

    // 규칙 모달 관련 이벤트
    const rulesModal = document.getElementById('rulesModal');
    const closeRulesModalBtn = document.getElementById('closeRulesModalBtn');

    if (rulesModal) {
        // 모달 외부 클릭 시 닫기
        rulesModal.addEventListener('click', (e) => {
            if (e.target === rulesModal) {
                hideModal(rulesModal);
            }
        });

        // 닫기 버튼
        if (closeRulesModalBtn) {
            closeRulesModalBtn.addEventListener('click', () => hideModal(rulesModal));
        }
    }
}

/**
 * 규칙 저장
 */
function saveCurrentRule() {
    showInputModal('Save Rule', 'Enter rule name', (ruleName) => {
        // 현재 메소드 및 설정 가져오기
        const currentMethod = document.querySelector('.tab.active').dataset.method;

        // 설정 가져오기
        let settings = {};

        switch (currentMethod) {
            case 'pattern':
                const patternInput = document.getElementById('patternInput');
                if (patternInput) {
                    settings.pattern = patternInput.value;
                }
                break;

            case 'replace':
                const findText = document.getElementById('findText');
                const replaceText = document.getElementById('replaceText');
                const caseSensitive = document.getElementById('caseSensitive');

                if (findText && replaceText && caseSensitive) {
                    settings.find = findText.value;
                    settings.replace = replaceText.value;
                    settings.caseSensitive = caseSensitive.checked;
                }
                break;

            case 'regex':
                const regexPattern = document.getElementById('regexPattern');
                const regexReplacement = document.getElementById('regexReplacement');

                if (regexPattern && regexReplacement) {
                    settings.pattern = regexPattern.value;
                    settings.replacement = regexReplacement.value;
                }
                break;

                // 다른 메소드들에 대한 설정 추가
        }

        // 규칙 저장
        const rule = {
            name: ruleName,
            method: currentMethod,
            settings
        };

        // 저장된 규칙 가져오기
        let savedRules = JSON.parse(localStorage.getItem('renameRules') || '[]');

        // 새 규칙 추가
        savedRules.push(rule);

        // 규칙 저장
        localStorage.setItem('renameRules', JSON.stringify(savedRules));

        // 성공 메시지
        if (window.showToast) {
            window.showToast(`Rule "${ruleName}" has been saved`, 'success');
        }
    });
}

/**
 * 규칙 모달 열기
 */
function openRulesModal() {
    const rulesModal = document.getElementById('rulesModal');
    const modalRulesList = document.getElementById('modalRulesList');

    if (rulesModal && modalRulesList) {
        // 규칙 목록 초기화
        modalRulesList.innerHTML = '';

        // 저장된 규칙 가져오기
        const savedRules = JSON.parse(localStorage.getItem('renameRules') || '[]');

        if (savedRules.length === 0) {
            modalRulesList.innerHTML = `
        <div class="empty-rules-message">
          No saved rules yet. Click "Save" to create a rule.
        </div>
      `;
        } else {
            // 각 규칙에 대한 UI 생성
            savedRules.forEach((rule, index) => {
                const ruleItem = document.createElement('div');
                ruleItem.className = 'rule-item';

                const ruleName = document.createElement('div');
                ruleName.className = 'rule-name';
                ruleName.textContent = rule.name;

                const ruleActions = document.createElement('div');
                ruleActions.className = 'rule-actions';

                // 로드 버튼
                const loadBtn = document.createElement('button');
                loadBtn.className = 'rule-btn rule-load';
                loadBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"></path>
            <path d="M12 5l7 7-7 7"></path>
          </svg>
        `;
                loadBtn.title = 'Load Rule';
                loadBtn.addEventListener('click', () => loadRule(rule));

                // 삭제 버튼
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'rule-btn rule-delete';
                deleteBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        `;
                deleteBtn.title = 'Delete Rule';
                deleteBtn.addEventListener('click', () => deleteRule(index));

                ruleActions.appendChild(loadBtn);
                ruleActions.appendChild(deleteBtn);

                ruleItem.appendChild(ruleName);
                ruleItem.appendChild(ruleActions);

                modalRulesList.appendChild(ruleItem);
            });
        }

        // 모달 표시
        showModal(rulesModal);
    }
}

/**
 * 규칙 불러오기
 */
function loadRule(rule) {
    // 메소드 탭 설정
    const tab = document.querySelector(`.tab[data-method="${rule.method}"]`);
    if (tab) {
        // 탭 클릭
        tab.click();

        // 설정 적용
        switch (rule.method) {
            case 'pattern':
                const patternInput = document.getElementById('patternInput');
                if (patternInput && rule.settings.pattern) {
                    patternInput.value = rule.settings.pattern;
                    patternInput.dispatchEvent(new Event('input'));
                }
                break;

            case 'replace':
                const findText = document.getElementById('findText');
                const replaceText = document.getElementById('replaceText');
                const caseSensitive = document.getElementById('caseSensitive');

                if (findText && rule.settings.find !== undefined) {
                    findText.value = rule.settings.find;
                    findText.dispatchEvent(new Event('input'));
                }

                if (replaceText && rule.settings.replace !== undefined) {
                    replaceText.value = rule.settings.replace;
                    replaceText.dispatchEvent(new Event('input'));
                }

                if (caseSensitive && rule.settings.caseSensitive !== undefined) {
                    caseSensitive.checked = rule.settings.caseSensitive;
                    caseSensitive.dispatchEvent(new Event('change'));
                }
                break;

            case 'regex':
                const regexPattern = document.getElementById('regexPattern');
                const regexReplacement = document.getElementById('regexReplacement');

                if (regexPattern && rule.settings.pattern !== undefined) {
                    regexPattern.value = rule.settings.pattern;
                    regexPattern.dispatchEvent(new Event('input'));
                }

                if (regexReplacement && rule.settings.replacement !== undefined) {
                    regexReplacement.value = rule.settings.replacement;
                    regexReplacement.dispatchEvent(new Event('input'));
                }
                break;

                // 다른 메소드들에 대한 설정 적용
        }

        // 규칙 모달 닫기
        const rulesModal = document.getElementById('rulesModal');
        if (rulesModal) {
            hideModal(rulesModal);
        }

        // 성공 메시지
        if (window.showToast) {
            window.showToast(`Rule "${rule.name}" has been loaded`, 'success');
        }

        // 미리보기 업데이트
        document.dispatchEvent(new CustomEvent('preview-update'));
    }
}

/**
 * 규칙 삭제
 */
function deleteRule(index) {
    // 저장된 규칙 가져오기
    let savedRules = JSON.parse(localStorage.getItem('renameRules') || '[]');

    if (index >= 0 && index < savedRules.length) {
        const ruleName = savedRules[index].name;

        // 규칙 삭제
        savedRules.splice(index, 1);

        // 규칙 저장
        localStorage.setItem('renameRules', JSON.stringify(savedRules));

        // 규칙 모달 다시 열기
        openRulesModal();

        // 성공 메시지
        if (window.showToast) {
            window.showToast(`Rule "${ruleName}" has been deleted`, 'info');
        }
    }
}

export {
    closeInputModal,
    showInputModal,
    setupModalHandlers,
    saveCurrentRule,
    openRulesModal,
    loadRule,
    deleteRule,
    openExpressionExamplesModal,
    closeExpressionExamplesModal,
    setupExpressionExamples
};