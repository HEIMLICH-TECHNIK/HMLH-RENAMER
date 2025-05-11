/**
 * 이름 변경 컴포넌트
 * 파일 이름 변경 기능을 제공합니다.
 */

import State from '../core/state.js';
import { saveToHistory } from '../core/history.js';
import { processRenameResults } from '../utils/file-utils.js';
import { showToastWithDetails } from '../utils/toast.js';

/**
 * 이름 변경 실행
 */
export async function renameFiles(DOM) {
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
                
                // 단어 규칙 처리를 위한 임포트
                const { applyWordRules } = await import('../rename-methods/word.js');

                for (let i = 0; i < State.selectedFiles.length; i++) {
                    const file = State.selectedFiles[i];
                    const fileName = getFileName(file);
                    const newName = await applyWordRules(
                        fileName,
                        '',
                        i,
                        State.wordRules,
                        State.selectedWordTokens,
                        State.wordPatterns,
                        DOM.applyToAllFiles && DOM.applyToAllFiles.checked,
                        State.applySimilarPattern,
                        State.treatSelectionAsOne,
                        State.selectedGroups
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
                
                // 표현식 처리를 위한 임포트
                const { applyExpression } = await import('../rename-methods/expression.js');
                const { getFileName, splitFileName } = await import('../utils/file-utils.js');

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
        handleRenameResults(results, DOM);

        // 히스토리 저장
        saveToHistory('rename-' + State.currentMethod);

    } catch (error) {
        showToastWithDetails(`Error: ${error.message}`, 'error');
    } finally {
        DOM.applyBtn.textContent = 'Rename Files';
        DOM.applyBtn.disabled = State.selectedFiles.length === 0;
    }
}

/**
 * 이름 변경 결과 처리
 */
export function handleRenameResults(results, DOM) {
    // 결과 저장
    State.lastRenameResults = results;

    // 결과 처리
    const { message, type, successCount, errorCount } = processRenameResults(results);

    // 토스트 표시 (View Details 버튼 포함)
    showToastWithDetails(message, type, true);

    // 성공한 파일 업데이트
    updateSuccessfulFiles(results);
    
    // 결과를 저장하고 이벤트는 발생시키지만, 자동으로 모달을 표시하지는 않음
    document.dispatchEvent(new CustomEvent('results-ready', { detail: results }));
}

/**
 * 성공한 파일 업데이트
 */
export function updateSuccessfulFiles(results) {
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

    // 미리보기 업데이트 이벤트 디스패치
    document.dispatchEvent(new CustomEvent('preview-update'));
} 