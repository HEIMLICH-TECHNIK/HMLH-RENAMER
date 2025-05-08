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
 * 입력 모달 닫기
 */
function closeInputModal() {
  DOM.inputModal.classList.add('hidden');
  DOM.inputModalField.value = '';
  State.pendingSaveCallback = null;
}

/**
 * 입력 모달 열기
 * @param {string} title - 모달 제목
 * @param {string} placeholder - 입력 필드 플레이스홀더
 * @param {Function} callback - 입력 완료 후 호출할 콜백
 */
function showInputModal(title, placeholder, callback) {
  DOM.inputModalTitle.textContent = title || 'Enter Value';
  DOM.inputModalField.placeholder = placeholder || '';
  DOM.inputModalField.value = '';
  State.pendingSaveCallback = callback;
  DOM.inputModal.classList.remove('hidden');
  DOM.inputModalField.focus();
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
  // 규칙 모달 닫기 버튼
  if (DOM.closeRulesModalBtn) {
    DOM.closeRulesModalBtn.addEventListener('click', () => {
      console.log('Close modal button clicked');
      DOM.rulesModal.classList.add('hidden');
    });
  }
  
  // 규칙 모달 외부 클릭 시 닫기
  if (DOM.rulesModal) {
    DOM.rulesModal.addEventListener('click', (e) => {
      if (e.target === DOM.rulesModal) {
        console.log('Modal background clicked');
        DOM.rulesModal.classList.add('hidden');
      }
    });
  }
  
  // 입력 모달 관련 이벤트 리스너
  if (DOM.closeInputModalBtn) {
    DOM.closeInputModalBtn.addEventListener('click', closeInputModal);
  }
  
  if (DOM.inputModalCancelBtn) {
    DOM.inputModalCancelBtn.addEventListener('click', closeInputModal);
  }
  
  if (DOM.inputModalConfirmBtn) {
    DOM.inputModalConfirmBtn.addEventListener('click', () => {
      const inputValue = DOM.inputModalField.value.trim();
      if (inputValue && State.pendingSaveCallback) {
        State.pendingSaveCallback(inputValue);
      }
      closeInputModal();
    });
  }
  
  // 입력 모달에서 Enter 키 처리
  if (DOM.inputModalField) {
    DOM.inputModalField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const inputValue = DOM.inputModalField.value.trim();
        if (inputValue && State.pendingSaveCallback) {
          State.pendingSaveCallback(inputValue);
        }
        closeInputModal();
      }
    });
  }
  
  // 입력 모달 외부 클릭 시 닫기
  if (DOM.inputModal) {
    DOM.inputModal.addEventListener('click', (e) => {
      if (e.target === DOM.inputModal) {
        closeInputModal();
      }
    });
  }
  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // 규칙 목록 모달이 열려있으면 닫기
      if (!DOM.rulesModal.classList.contains('hidden')) {
        console.log('ESC key pressed, closing rules modal');
        DOM.rulesModal.classList.add('hidden');
      }
      
      // 입력 모달이 열려있으면 닫기
      if (!DOM.inputModal.classList.contains('hidden')) {
        console.log('ESC key pressed, closing input modal');
        closeInputModal();
      }
      
      // 익스프레션 예제 모달이 열려있으면 닫기
      if (DOM.expressionExamplesModal && !DOM.expressionExamplesModal.classList.contains('hidden')) {
        console.log('ESC key pressed, closing expression examples modal');
        DOM.expressionExamplesModal.classList.add('hidden');
      }
    }
  });
  
  // 표현식 예제 모달 열기/닫기
  if (DOM.expressionExamplesBtn && DOM.expressionExamplesModal) {
    // 예제 모달 열기
    DOM.expressionExamplesBtn.addEventListener('click', openExpressionExamplesModal);
    
    // 예제 모달 닫기 버튼
    if (DOM.closeExpressionExamplesBtn) {
      DOM.closeExpressionExamplesBtn.addEventListener('click', closeExpressionExamplesModal);
    }
    
    // 모달 바깥 클릭 시 닫기
    DOM.expressionExamplesModal.addEventListener('click', (e) => {
      if (e.target === DOM.expressionExamplesModal) {
        closeExpressionExamplesModal();
      }
    });
  }
}

/**
 * 규칙 저장
 */
async function saveCurrentRule() {
  try {
    // 커스텀 입력 모달 사용
    showInputModal('Enter Rule Name', 'My Rule', async (ruleName) => {
      if (!ruleName || ruleName.trim() === '') {
        console.log('Rule name not provided or empty, canceling save');
        return;
      }
      
      console.log('Saving rule with name:', ruleName);
      
      // 현재 규칙 데이터 수집
      const ruleData = {
        method: State.currentMethod,
        settings: {}
      };
      
      // 현재 방식에 따른 설정 수집
      switch (State.currentMethod) {
        case 'pattern':
          ruleData.settings = {
            pattern: DOM.patternInput.value || '{name}'
            // dateFormat 추가 필요
          };
          break;
        case 'replace':
          ruleData.settings = {
            find: DOM.findText.value,
            replace: DOM.replaceText.value,
            caseSensitive: DOM.caseSensitive.checked
          };
          break;
        case 'regex':
          ruleData.settings = {
            pattern: DOM.regexPattern.value,
            replacement: DOM.regexReplacement.value
          };
          break;
        case 'word':
          // 단어 규칙 수집
          const wordRuleData = State.wordRules.map(rule => ({
            action: rule.getAction ? rule.getAction() : rule.action,
            value: rule.getValue ? rule.getValue() : rule.value
          }));
          
          ruleData.settings = {
            applyToAll: DOM.applyToAllFiles && DOM.applyToAllFiles.checked,
            wordRules: wordRuleData
          };
          break;
        case 'numbering':
          ruleData.settings = {
            pattern: DOM.numberingPattern.value,
            startNumber: DOM.startNumber.value,
            padding: DOM.numberPadding.value,
            step: DOM.numberStep.value,
            sort: DOM.sortingMethod.value,
            reverse: DOM.reverseOrder.checked
          };
          break;
        case 'expression':
          ruleData.settings = {
            expression: DOM.expressionInput && DOM.expressionInput.value ? 
              DOM.expressionInput.value.trim() : 
              'name + "_" + padnum(index + 1, 3) + "." + fileext'
          };
          break;
      }
      
      console.log('Final rule data to save:', ruleData);
      
      // API를 통해 규칙 저장
      const result = await window.api.saveRule(ruleName, ruleData);
      console.log('Save result:', result);
      
      if (result.success) {
        showToast(`Rule "${ruleName}" saved successfully!`, 'success');
      } else {
        console.error('Error saving rule:', result.error);
        showToast(`Error saving rule: ${result.error}`, 'error');
      }
    });
  } catch (error) {
    console.error('Exception during save:', error);
    showToast(`Error saving rule: ${error.message}`, 'error');
  }
}

/**
 * 저장된 규칙 모달 열기
 */
async function openRulesModal() {
  try {
    // 모달 표시
    DOM.rulesModal.classList.remove('hidden');
    console.log('Opening rules modal, hidden class removed');
    
    // 명시적 닫기 버튼 이벤트 추가
    const closeButton = DOM.closeRulesModalBtn;
    if (closeButton) {
      closeButton.onclick = function() {
        console.log('Close button clicked (inline handler)');
        DOM.rulesModal.classList.add('hidden');
      };
    }
    
    // 규칙 목록 로드
    const rules = await window.api.getSavedRules();
    
    // UI 업데이트
    DOM.modalRulesList.innerHTML = '';
    
    if (rules.length === 0) {
      // 빈 규칙 메시지 표시
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-rules-message';
      emptyMessage.textContent = 'No saved rules';
      DOM.modalRulesList.appendChild(emptyMessage);
      
      // 빈 상태에서 하단 닫기 버튼 추가
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn-primary';
      closeBtn.textContent = 'Close';
      closeBtn.style.marginTop = '20px';
      closeBtn.addEventListener('click', () => {
        DOM.rulesModal.classList.add('hidden');
      });
      
      DOM.modalRulesList.appendChild(closeBtn);
      return;
    }
    
    // 규칙 목록 항목 생성
    rules.forEach(rule => {
      const ruleItem = document.createElement('div');
      ruleItem.className = 'rule-item';
      
      const ruleName = document.createElement('div');
      ruleName.className = 'rule-name';
      ruleName.textContent = rule.name;
      
      const ruleActions = document.createElement('div');
      ruleActions.className = 'rule-actions';
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'rule-btn rule-load';
      loadBtn.innerHTML = '↓';
      loadBtn.title = 'Load rule';
      loadBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        loadRule(rule.name);
        DOM.rulesModal.classList.add('hidden');
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rule-btn rule-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Delete rule';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        deleteRule(rule.name);
      });
      
      ruleActions.appendChild(loadBtn);
      ruleActions.appendChild(deleteBtn);
      
      ruleItem.appendChild(ruleName);
      ruleItem.appendChild(ruleActions);
      
      DOM.modalRulesList.appendChild(ruleItem);
    });
  } catch (error) {
    console.error('Error loading saved rules:', error);
    alert('Error loading saved rules');
    DOM.rulesModal.classList.add('hidden');
  }
}

/**
 * 규칙 로드
 * @param {string} ruleName - 로드할 규칙 이름
 */
async function loadRule(ruleName) {
  try {
    console.log('Loading rule:', ruleName);
    // API를 통해 규칙 데이터 가져오기
    const response = await window.api.loadRule(ruleName);
    
    if (!response || !response.success) {
      showToast(`Rule "${ruleName}" not found`, 'error');
      return;
    }
    
    // API 응답에서 rule 데이터 가져오기
    const rule = response.data;
    
    if (!rule) {
      showToast(`Rule "${ruleName}" data is invalid`, 'error');
      return;
    }
    
    console.log('Rule data loaded:', rule);
    console.log('Rule method:', rule.method);
    console.log('Rule settings:', rule.settings);
    
    // method-changed 이벤트 발생
    const methodEvent = new CustomEvent('method-changed', {
      detail: { method: rule.method }
    });
    document.dispatchEvent(methodEvent);
    
    // 트리거가 작동하지 않을 경우를 대비해 currentMethod 직접 설정
    if (State.currentMethod !== rule.method) {
      console.log(`Changing method from ${State.currentMethod} to ${rule.method}`);
      State.currentMethod = rule.method;
    }
    
    // 메소드별 설정 적용
    switch (rule.method) {
      case 'pattern':
        if (DOM.patternInput && rule.settings.pattern) {
          console.log('Setting pattern:', rule.settings.pattern);
          DOM.patternInput.value = rule.settings.pattern;
        }
        break;
        
      case 'replace':
        if (DOM.findText) {
          console.log('Setting find text:', rule.settings.find || '');
          DOM.findText.value = rule.settings.find || '';
        }
        if (DOM.replaceText) {
          console.log('Setting replace text:', rule.settings.replace || '');
          DOM.replaceText.value = rule.settings.replace || '';
        }
        if (DOM.caseSensitive) {
          console.log('Setting case sensitive:', rule.settings.caseSensitive || false);
          DOM.caseSensitive.checked = rule.settings.caseSensitive || false;
        }
        break;
        
      case 'regex':
        if (DOM.regexPattern) {
          console.log('Setting regex pattern:', rule.settings.pattern || '');
          DOM.regexPattern.value = rule.settings.pattern || '';
        }
        if (DOM.regexReplacement) {
          console.log('Setting regex replacement:', rule.settings.replacement || '');
          DOM.regexReplacement.value = rule.settings.replacement || '';
        }
        break;
        
      case 'word':
        // 단어 규칙 초기화
        if (DOM.wordRulesContainer) {
          console.log('Initializing word rules container');
          DOM.wordRulesContainer.innerHTML = '';
          State.wordRules = [];
          
          // 저장된 단어 규칙 생성
          if (rule.settings.wordRules && Array.isArray(rule.settings.wordRules)) {
            console.log('Creating word rules:', rule.settings.wordRules);
            rule.settings.wordRules.forEach(wordRule => {
              const newRule = addWordRule(DOM.wordRulesContainer, () => {
                // updatePreview 직접 호출 대신 이벤트 발생
                const updateEvent = new CustomEvent('preview-update');
                document.dispatchEvent(updateEvent);
              });
              
              // 규칙 값 설정
              const actionSelect = DOM.wordRulesContainer.lastChild.querySelector('select');
              const valueInput = DOM.wordRulesContainer.lastChild.querySelector('input[type="text"]');
              
              if (actionSelect) {
                console.log('Setting word rule action:', wordRule.action || 'replace');
                actionSelect.value = wordRule.action || 'replace';
              }
              if (valueInput) {
                console.log('Setting word rule value:', wordRule.value || '');
                valueInput.value = wordRule.value || '';
              }
              
              State.wordRules.push(newRule);
            });
          }
          
          // 일괄 적용 설정
          if (DOM.applyToAllFiles) {
            console.log('Setting apply to all:', rule.settings.applyToAll || false);
            DOM.applyToAllFiles.checked = rule.settings.applyToAll || false;
          }
        }
        break;
        
      case 'numbering':
        if (DOM.numberingPattern) {
          console.log('Setting numbering pattern:', rule.settings.pattern || '{name}_{num}');
          DOM.numberingPattern.value = rule.settings.pattern || '{name}_{num}';
        }
        if (DOM.startNumber) {
          console.log('Setting start number:', rule.settings.startNumber || 1);
          DOM.startNumber.value = rule.settings.startNumber || 1;
        }
        if (DOM.numberPadding) {
          console.log('Setting number padding:', rule.settings.padding || 0);
          DOM.numberPadding.value = rule.settings.padding || 0;
        }
        if (DOM.numberStep) {
          console.log('Setting number step:', rule.settings.step || 1);
          DOM.numberStep.value = rule.settings.step || 1;
        }
        if (DOM.sortingMethod) {
          console.log('Setting sorting method:', rule.settings.sort || 'name');
          DOM.sortingMethod.value = rule.settings.sort || 'name';
        }
        if (DOM.reverseOrder) {
          console.log('Setting reverse order:', rule.settings.reverse || false);
          DOM.reverseOrder.checked = rule.settings.reverse || false;
        }
        break;
        
      case 'expression':
        if (DOM.expressionInput) {
          const expression = rule.settings.expression || 'name + "_" + padnum(index + 1, 3) + "." + fileext';
          console.log('Setting expression:', expression);
          DOM.expressionInput.value = expression;
        }
        break;
    }
    
    // 미리보기 업데이트 이벤트 발생
    const updateEvent = new CustomEvent('preview-update');
    document.dispatchEvent(updateEvent);
    
    // 탭 변경 완료됐는지 확인용 로그
    setTimeout(() => {
      console.log('Current method after load:', State.currentMethod);
      console.log('Active tab:', document.querySelector('.tab.active')?.dataset.method);
    }, 100);
    
    showToast(`Rule "${ruleName}" loaded successfully`, 'success');
  } catch (error) {
    console.error('Error loading rule:', error);
    showToast(`Error loading rule: ${error.message}`, 'error');
  }
}

/**
 * 규칙 삭제
 * @param {string} ruleName - 삭제할 규칙 이름
 */
async function deleteRule(ruleName) {
  if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
    return;
  }
  
  try {
    const result = await window.api.deleteRule(ruleName);
    
    if (result.success) {
      // 규칙 목록 새로고침
      openRulesModal();
      showToast(`Rule "${ruleName}" deleted successfully!`, 'success');
    } else {
      showToast(`Error deleting rule: ${result.error}`, 'error');
    }
  } catch (error) {
    showToast(`Error deleting rule: ${error.message}`, 'error');
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