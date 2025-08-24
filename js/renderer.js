/**
 * 렌더러 메인 모듈
 * 애플리케이션의 진입점으로, 모든 기능을 초기화하고 이벤트 리스너를 설정합니다.
 */

// Core 모듈 임포트
import DOM from './core/dom.js';
import State from './core/state.js';
import { saveToHistory, updateHistoryButtons, undo, redo } from './core/history.js';

// 컴포넌트 모듈 임포트
import { setupModalHandlers, saveCurrentRule, openRulesModal, loadRule, deleteRule } from './components/modal.js';
import { handleFiles, setupDragAndDrop, sortFiles } from './components/file-handler.js';
import { loadMediaMetadata } from './components/media-metadata.js';
import { updatePreview, generateNewName, showResults, updateWordMethodPreview, updateAfterWordSelection } from './components/preview.js';
import { renameFiles, handleRenameResults } from './components/rename.js';
import { updateUI, showModal, hideModal, initModals, setupSettingsTabs, insertAtCursor } from './components/ui.js';
import { initializeUpdater, checkForUpdates } from './components/updater.js';

// 유틸리티 모듈 임포트
import { showToast, showToastWithDetails } from './utils/toast.js';
import { checkDateVariableInPattern } from './rename-methods/pattern.js';
import { addWordRule } from './rename-methods/word.js';

// 커스텀 이벤트 리스너 추가 - 인라인 스크립트에서 발생시킨 이벤트 처리
document.addEventListener('files-selected', function(e) {
  const filePaths = e.detail;
  if (filePaths && filePaths.length > 0) {
    // 파일 목록 업데이트
    State.selectedFiles = [...filePaths];
    
    // 첫 파일 추가 시 히스토리 초기화
    if (State.fileHistory.length === 0) {
      console.log('First files added, initializing history');
      State.fileHistory = [];
      State.historyIndex = -1;
      State.initialState = null;
    }
    
    // 히스토리 저장
    saveToHistory('add-files');
    
    // 미디어 파일 감지 및 메타데이터 로드
    loadMediaMetadata(filePaths);
    
    // UI 명시적 업데이트
    // DOM이 정의되어 있는지 확인
    if (DOM) {
      if (DOM.mainContent) DOM.mainContent.classList.remove('empty');
      if (DOM.emptyDropArea) DOM.emptyDropArea.style.display = 'none';
      if (DOM.filesPreview) DOM.filesPreview.classList.remove('hidden');
      if (DOM.applyBtn) DOM.applyBtn.disabled = false;
      
      // 파일 개수 업데이트
      if (DOM.fileCount) {
        DOM.fileCount.textContent = State.selectedFiles.length === 1 ?
          '1 file selected' :
          `${State.selectedFiles.length} files selected`;
      }
    }
    
    // UI 전체 업데이트
    updateUI(DOM);
    console.log(`Added ${filePaths.length} files via button click, total: ${State.selectedFiles.length}`);
  }
});

/**
 * 애플리케이션 초기화
 */
function initializeApp() {
    // 상태 초기화
    State.resetState();

    // DOM 요소 참조 가져오기
    DOM.applySimilarPattern = document.getElementById('applySimilarPattern');
    DOM.wordRulesContainer = document.getElementById('wordRulesContainer');

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
            updatePreview(DOM);
        });
    });

    // 드래그 앤 드롭 이벤트 설정
    setupDragAndDrop(DOM);

    // 파일 선택 버튼
    DOM.fileSelectBtn.addEventListener('click', async() => {
        const filePaths = await window.api.getFilePaths();
        if (filePaths && filePaths.length > 0) {
            handleFiles(filePaths);
        }
    });

    // 적용 버튼
    DOM.applyBtn.addEventListener('click', () => renameFiles(DOM));

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
            updateUI(DOM);
            DOM.resultArea.classList.add('hidden');
            console.log('All files cleared');
        }
    });

    // 패턴 입력 필드
    if (DOM.patternInput) {
        DOM.patternInput.addEventListener('input', async() => {
            // 패턴에 {date} 변수 확인
            checkDateVariableInPattern(
                DOM.patternInput.value || '',
                DOM.dateFormatContainer,
                DOM.dateFormatOptions,
                DOM.toggleDateOptions
            );
            await updatePreview(DOM);
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
    if (DOM.findText) DOM.findText.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.replaceText) DOM.replaceText.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.caseSensitive) DOM.caseSensitive.addEventListener('change', async() => await updatePreview(DOM));

    // 정규식 필드
    if (DOM.regexPattern) DOM.regexPattern.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.regexReplacement) DOM.regexReplacement.addEventListener('input', async() => await updatePreview(DOM));

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

        DOM.dateFormatPreset.addEventListener('change', async() => {
            const isCustom = DOM.dateFormatPreset.value === 'custom';

            if (isCustom) {
                DOM.customDateFormat.classList.add('active');
                DOM.dateFormatCustom.focus();
            } else {
                DOM.customDateFormat.classList.remove('active');
            }

            await updatePreview(DOM);
        });
    }

    // 커스텀 날짜 포맷
    if (DOM.dateFormatCustom) {
        DOM.dateFormatCustom.addEventListener('input', async() => await updatePreview(DOM));
    }

    // 단어 방식 컨트롤
    if (DOM.addWordRuleBtn) {
        DOM.addWordRuleBtn.addEventListener('click', () => {
            const newRule = addWordRule(DOM.wordRulesContainer, () => updatePreview(DOM));
            State.wordRules.push(newRule);
            updatePreview(DOM);
        });
    }

    if (DOM.applyToAllFiles) {
        DOM.applyToAllFiles.addEventListener('change', () => {
            // 히스토리 저장
            saveToHistory('apply-to-all-toggle');

            // 체크 해제 시 패턴 초기화
            if (!DOM.applyToAllFiles.checked) {
                State.wordPatterns = [];
                console.log('전체 적용 패턴 초기화');
            } else {
                // 체크 활성화 시 현재 선택된 단어들을 패턴으로 자동 추가
                import('./rename-methods/word.js').then(({ createWordPattern }) => {
                    State.selectedWordTokens.forEach(token => {
                        const word = token.word;
                        // 이미 패턴에 추가되지 않은 경우에만 추가
                        if (word && !State.wordPatterns.some(pattern => pattern.word === word)) {
                            State.wordPatterns.push(createWordPattern(word));
                            console.log(`패턴 추가: "${word}"`);
                        }
                    });
                    
                    // 전체 UI 업데이트
                    updateUI(DOM);
                });
            }
        });
    }

    // 새로 추가된 "유사 패턴에만 적용" 체크박스 처리
    const applySimilarPattern = document.getElementById('applySimilarPattern');
    if (applySimilarPattern) {
        applySimilarPattern.addEventListener('change', () => {
            // 상태 저장
            State.applySimilarPattern = applySimilarPattern.checked;
            console.log(`유사 패턴 적용: ${State.applySimilarPattern}`);

            // UI 업데이트
            updateUI(DOM);
        });
    }

    // 새로 추가된 "연속 선택을 하나의 단어로 취급" 체크박스 처리
    const treatSelectionAsOne = document.getElementById('treatSelectionAsOne');
    if (treatSelectionAsOne) {
        treatSelectionAsOne.addEventListener('change', () => {
            // 상태 저장
            State.treatSelectionAsOne = treatSelectionAsOne.checked;
            console.log(`연속 선택을 하나로 취급: ${State.treatSelectionAsOne}`);

            // UI 업데이트
            updateUI(DOM);
        });
    }

    // 넘버링 방식 컨트롤
    if (DOM.numberingPattern) DOM.numberingPattern.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.startNumber) DOM.startNumber.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.numberPadding) DOM.numberPadding.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.numberStep) DOM.numberStep.addEventListener('input', async() => await updatePreview(DOM));
    if (DOM.sortingMethod) DOM.sortingMethod.addEventListener('change', async() => await updatePreview(DOM));
    if (DOM.reverseOrder) DOM.reverseOrder.addEventListener('change', async() => await updatePreview(DOM));

    // 표현식 방식 컨트롤
    if (DOM.expressionInput) DOM.expressionInput.addEventListener('input', async() => await updatePreview(DOM));

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
                        updatePreview(DOM);

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
            updatePreview(DOM);

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

    // 정렬 드롭다운 이벤트 리스너 추가
    const previewSortSelect = document.getElementById('previewSortSelect');
    if (previewSortSelect) {
        previewSortSelect.addEventListener('change', () => {
            const sortBy = previewSortSelect.value;
            if (sortBy === 'none') {
                // 커스텀 정렬 - 아무것도 하지 않음
                return;
            }

            // 히스토리 저장
            saveToHistory();

            // 정렬 기준에 따라 파일 정렬
            sortFiles(sortBy, DOM);
        });
    }

    // 토스트 결과 이벤트 리스너
    document.addEventListener('show-rename-results', (e) => {
        showResults(e.detail, DOM);
    });

    // 결과 준비 이벤트 리스너 - 결과는 저장되지만 모달은 표시하지 않음
    document.addEventListener('results-ready', () => {
        // 결과가 준비되었지만 모달은 표시하지 않고 UI만 업데이트
        updateUI(DOM);
    });

    // 파일 업데이트 이벤트 리스너
    document.addEventListener('files-updated', () => {
        updateUI(DOM);
    });

    // 히스토리 변경 이벤트 리스너
    document.addEventListener('history-changed', () => {
        updateHistoryButtons(DOM.undoBtn, DOM.redoBtn);
    });

    // 미리보기 업데이트 이벤트 리스너
    document.addEventListener('preview-update', () => {
        updatePreview(DOM);
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
        updatePreview(DOM);
    });

    // 모달 핸들러 설정
    setupModalHandlers();

    // 모달 초기화
    initModals();
    
    // 설정 탭 관리
    setupSettingsTabs();
    
    // 업데이터 초기화
    initializeUpdater();

    // 클릭 가능한 변수 및 예시 처리를 위한 이벤트 리스너 추가
    setupClickableElements();

    // UI 초기화
    updateUI(DOM);
}

/**
 * 클릭 가능한 요소 설정
 */
function setupClickableElements() {
    // 패턴 변수 클릭 처리
    document.querySelectorAll('.clickable-var').forEach(el => {
        el.addEventListener('click', function() {
            const currentMethod = document.querySelector('.tab.active').dataset.method;
            let targetInput;

            if (currentMethod === 'pattern') {
                targetInput = document.getElementById('patternInput');

                // 커서 위치에 변수 삽입
                insertAtCursor(targetInput, this.textContent);
            } else if (currentMethod === 'expression') {
                targetInput = document.getElementById('expressionInput');

                // 변수 형식 변환 (예: {name} -> name, {width} -> width)
                let varText = this.textContent;
                if (varText.startsWith('{') && varText.endsWith('}')) {
                    varText = varText.substring(1, varText.length - 1);
                }

                // 커서 위치에 변수 삽입
                insertAtCursor(targetInput, varText);
            }
        });
    });

    // 클릭 가능한 예시 코드 처리
    document.querySelectorAll('.clickable-example').forEach(el => {
        el.addEventListener('click', function() {
            const currentMethod = document.querySelector('.tab.active').dataset.method;
            let targetInput;

            if (currentMethod === 'pattern') {
                targetInput = document.getElementById('patternInput');
                // 패턴 메서드에는 전체 예시를 값으로 설정
                targetInput.value = this.textContent;
            } else if (currentMethod === 'expression') {
                targetInput = document.getElementById('expressionInput');
                // Expression 모달의 경우 data-expression 속성 사용
                const parent = this.closest('.example-item');
                const expressionValue = parent ? parent.dataset.expression : this.textContent;
                targetInput.value = expressionValue || this.textContent;
            }

            // 입력 필드에 포커스
            if (targetInput) {
                targetInput.focus();
            }
        });
    });

    // 표현식 예시 모달의 예시 처리
    document.querySelectorAll('#expressionExamplesModal .example-item').forEach(el => {
        el.addEventListener('click', function() {
            const expressionInput = document.getElementById('expressionInput');
            const expressionValue = this.dataset.expression;
            if (expressionValue) {
                expressionInput.value = expressionValue;
                // 모달 닫기
                document.getElementById('expressionExamplesModal').classList.add('hidden');
            }
        });
    });
}

// 앱 초기화
initializeApp();
