/**
 * 미리보기 컴포넌트
 * 파일 목록의 미리보기와 이름 변경 미리보기를 관리합니다.
 */

import State from '../core/state.js';
import { saveToHistory } from '../core/history.js';
import { getFileName, splitFileName } from '../utils/file-utils.js';
import { showToast } from '../utils/toast.js';
import { getDragAfterElement } from './file-handler.js';

// 업데이트 중복 방지를 위한 토큰
let previewUpdateId = 0;

// 이름 변경 방식 모듈 임포트
import { applyPattern } from '../rename-methods/pattern.js';
import { applyFindReplace } from '../rename-methods/replace.js';
import { applyRegex } from '../rename-methods/regex.js';
import { applyWordRules } from '../rename-methods/word.js';
import { applyNumbering } from '../rename-methods/numbering.js';
import { applyExpression } from '../rename-methods/expression.js';

/**
 * 미리보기 업데이트
 */
export async function updatePreview(DOM) {
    const updateId = ++previewUpdateId;

    if (!DOM) return;

    if (State.selectedFiles.length === 0) {
        if (updateId !== previewUpdateId) return;
        DOM.previewArea.innerHTML = '<p>Select files to see preview</p>';
        return;
    }

    DOM.previewArea.innerHTML = '';

    const previewList = document.createElement('div');
    previewList.className = 'preview-list';

    for (let index = 0; index < State.selectedFiles.length; index++) {
        if (updateId !== previewUpdateId) return;

        const file = State.selectedFiles[index];
        const oldName = getFileName(file);
        const newName = await generateNewName(file, index);

        if (updateId !== previewUpdateId) return;

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.dataset.index = index;
        previewItem.draggable = true;

        // 드래그 핸들 추가
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';

        const oldNameEl = document.createElement('div');
        oldNameEl.className = 'old-name';

        // 단어 선택 방식일 때 단어를 선택 가능하게 처리
        if (State.currentMethod === 'word') {
            // 개선된 단어 분리 함수를 위한 임포트
            const { splitWordsInFileName, selectSimilarPatternWords } = await import('../rename-methods/word.js');
            
            // 단어 분리
            const words = splitWordsInFileName(oldName);

            // 단어 토큰 요소들을 저장할 배열
            const wordElements = [];

            words.forEach((word, wordIndex) => {
                if (word.trim() === '') return; // 빈 문자열 건너뛰기

                const wordSpan = document.createElement('span');
                wordSpan.className = 'word-token';
                wordSpan.textContent = word;
                wordSpan.dataset.fileIndex = index;
                wordSpan.dataset.wordIndex = wordIndex;
                wordSpan.dataset.word = word;
                // 툴팁 추가
                wordSpan.dataset.tooltip = 'Select multiple words: Shift + click';

                // 이 단어가 선택됐는지 확인 - 직접 선택 또는 패턴 매칭으로 선택
                let isSelected = State.selectedWordTokens.some(token =>
                    token.fileIndex == index && token.wordIndex == wordIndex
                );

                // 일괄 적용 활성화된 경우 패턴으로도 확인
                if (!isSelected && DOM.applyToAllFiles && DOM.applyToAllFiles.checked && State.wordPatterns.length > 0) {
                    isSelected = State.wordPatterns.some(pattern => {
                        pattern.pattern.lastIndex = 0; // 정규식 상태 초기화
                        const matched = pattern.pattern.test(word);
                        pattern.pattern.lastIndex = 0; // 다시 초기화
                        return matched;
                    });
                }

                if (isSelected) {
                    wordSpan.classList.add('selected');
                }

                // 단어 요소를 배열에 저장
                wordElements.push(wordSpan);

                // 단어 클릭 이벤트
                wordSpan.addEventListener('click', (e) => {
                    const isShiftKey = e.shiftKey;
                    const wordIndex = parseInt(e.target.dataset.wordIndex);

                    // 히스토리 저장
                    saveToHistory('word-selection');

                    if (isShiftKey && State.lastSelectedWord) {
                        // Shift 키를 누른 경우 연속 선택
                        const lastFileIndex = State.lastSelectedWord.fileIndex;
                        const lastWordIndex = parseInt(State.lastSelectedWord.wordIndex);

                        // 같은 파일인 경우만 연속 선택 허용
                        if (lastFileIndex === index) {
                            // 연속 단어 선택 - 시작과 끝 사이의 모든 단어 선택
                            const startIdx = Math.min(lastWordIndex, wordIndex);
                            const endIdx = Math.max(lastWordIndex, wordIndex);

                            // 선택된 단어 그룹 생성
                            const selectedGroup = {
                                fileIndex: index,
                                startIndex: startIdx,
                                endIndex: endIdx
                            };

                            // 기존 그룹과 중복되지 않는지 확인
                            const isDuplicate = State.selectedGroups.some(group =>
                                group.fileIndex === index &&
                                group.startIndex === startIdx &&
                                group.endIndex === endIdx
                            );

                            if (!isDuplicate) {
                                State.selectedGroups.push(selectedGroup);
                            }

                            // 연속 선택된 단어들 모두 선택 상태로 변경
                            for (let idx = startIdx; idx <= endIdx; idx++) {
                                // 구분자가 아닌 단어만 선택
                                const wordSpan = document.querySelector(`.word-token[data-word-index="${idx}"][data-file-index="${index}"]`);
                                if (wordSpan && !/^[_\-\s]$/.test(wordSpan.textContent)) {
                                    wordSpan.classList.add('selected');

                                    // 선택된 단어 토큰 목록에 추가 (중복 제거)
                                    const tokenExists = State.selectedWordTokens.some(token =>
                                        token.fileIndex == index && parseInt(token.wordIndex) === idx
                                    );

                                    if (!tokenExists) {
                                        State.selectedWordTokens.push({
                                            fileIndex: index,
                                            wordIndex: idx,
                                            word: wordSpan.textContent
                                        });
                                    }
                                }
                            }

                            // 토스트 메시지 표시
                            showToast(`Selected multiple words (${endIdx - startIdx + 1}). Use "Treat consecutive selections as one word" option.`, 'info');
                        }
                    } else {
                        // 일반 클릭 - 토글 선택
                        const wordSpan = e.target;
                        const isSelected = wordSpan.classList.contains('selected');

                        if (isSelected) {
                            // 선택 해제
                            wordSpan.classList.remove('selected');

                            // 선택된 단어 토큰 목록에서 제거
                            State.selectedWordTokens = State.selectedWordTokens.filter(token =>
                                !(token.fileIndex == index && parseInt(token.wordIndex) === wordIndex)
                            );

                            // 관련 그룹 제거
                            State.selectedGroups = State.selectedGroups.filter(group =>
                                !(group.fileIndex === index &&
                                    group.startIndex <= wordIndex &&
                                    group.endIndex >= wordIndex)
                            );
                        } else {
                            // 선택 추가
                            wordSpan.classList.add('selected');

                            // 선택된 단어 토큰 목록에 추가
                            const newToken = {
                                fileIndex: index,
                                wordIndex: wordIndex,
                                word: wordSpan.textContent
                            };
                            State.selectedWordTokens.push(newToken);

                            // 유사 패턴 선택 옵션이 켜져 있는 경우
                            if (State.applySimilarPattern && DOM.applySimilarPattern && DOM.applySimilarPattern.checked) {
                                // 선택한 단어와 유사한 패턴의 다른 단어들도 자동 선택
                                // 다른 파일에서만 유사 패턴 검색
                                const similarPatternTokens = selectSimilarPatternWords(
                                    State.selectedFiles,
                                    index, [newToken],
                                    true
                                );

                                // 유사 패턴 단어가 있으면 추가
                                if (similarPatternTokens.length > 0) {
                                    // 토큰 추가
                                    State.selectedWordTokens = [...State.selectedWordTokens, ...similarPatternTokens];

                                    // 화면에 선택 상태 표시
                                    similarPatternTokens.forEach(token => {
                                        const similarWordSpan = document.querySelector(
                                            `.word-token[data-file-index="${token.fileIndex}"][data-word-index="${token.wordIndex}"]`
                                        );

                                        if (similarWordSpan) {
                                            similarWordSpan.classList.add('selected');
                                        }
                                    });

                                    // 확인 메시지 표시
                                    if (similarPatternTokens.length > 0) {
                                        showToast(`${similarPatternTokens.length} similar pattern word(s) automatically selected in other files`, 'info');
                                    }
                                }
                            }

                            // 마지막 선택 단어 저장
                            State.lastSelectedWord = {
                                fileIndex: index,
                                wordIndex: wordIndex
                            };
                        }
                    }

                    // 단어 규칙 UI 활성화
                    if (State.selectedWordTokens.length > 0 && DOM.wordRulesContainer) {
                        DOM.wordRulesContainer.classList.add('active');
                    } else if (DOM.wordRulesContainer) {
                        DOM.wordRulesContainer.classList.remove('active');
                    }

                    // 미리보기 업데이트
                    updateAfterWordSelection(DOM);
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

            // UI 업데이트
            document.dispatchEvent(new CustomEvent('files-updated'));
            console.log(`Removed file at index ${index}, remaining: ${State.selectedFiles.length}`);
        });

        previewItem.appendChild(dragHandle);
        previewItem.appendChild(oldNameEl);
        previewItem.appendChild(arrow);
        previewItem.appendChild(newNameEl);
        previewItem.appendChild(removeBtn);
        previewList.appendChild(previewItem);

        // 드래그 앤 드롭 이벤트 리스너 추가
        previewItem.addEventListener('dragstart', (e) => {
            previewItem.classList.add('dragging');
            e.dataTransfer.setData('text/plain', index);
            e.dataTransfer.effectAllowed = 'move';
        });

        previewItem.addEventListener('dragend', () => {
            previewItem.classList.remove('dragging');
        });
    }

    // 드롭 영역 이벤트 리스너
    previewList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = document.querySelector('.dragging');
        if (!draggingItem) return;

        const targetItem = getDragAfterElement(previewList, e.clientY);
        if (targetItem) {
            previewList.insertBefore(draggingItem, targetItem);
        } else {
            previewList.appendChild(draggingItem);
        }
    });

    previewList.addEventListener('drop', (e) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));

        // 새 순서로 파일 목록 재정렬
        const items = [...previewList.querySelectorAll('.preview-item')];
        const newFiles = [];

        items.forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            newFiles.push(State.selectedFiles[oldIndex]);
        });

        // 히스토리 저장
        saveToHistory();

        // 새 순서로 파일 목록 업데이트
        State.selectedFiles = newFiles;

        // UI 업데이트
        document.dispatchEvent(new CustomEvent('files-updated'));
    });

    if (updateId !== previewUpdateId) return;
    DOM.previewArea.appendChild(previewList);
}

/**
 * 새 파일 이름 생성
 */
export async function generateNewName(filePath, index) {
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
        colorspace: 'unknown',
        color_transfer: 'unknown',
        codec: 'unknown',
        isImage: false,
        isVideo: false
    };

    // 캐시된 미디어 메타데이터가 있는지 확인
    if (State.mediaCache[filePath]) {
        metaData = State.mediaCache[filePath];
    } else {
        // 기본적인 파일 타입 정보는 설정
        metaData.isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath);
        metaData.isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(filePath);
    }
    
    // UI 요소 참조를 얻어옴
    const DOM = {
        patternInput: document.getElementById('patternInput'),
        findText: document.getElementById('findText'),
        replaceText: document.getElementById('replaceText'),
        caseSensitive: document.getElementById('caseSensitive'),
        regexPattern: document.getElementById('regexPattern'),
        regexReplacement: document.getElementById('regexReplacement'),
        applyToAllFiles: document.getElementById('applyToAllFiles'),
        numberingPattern: document.getElementById('numberingPattern'),
        startNumber: document.getElementById('startNumber'),
        numberPadding: document.getElementById('numberPadding'),
        numberStep: document.getElementById('numberStep'),
        expressionInput: document.getElementById('expressionInput')
    };

    switch (State.currentMethod) {
        case 'pattern':
            newName = await applyPattern(
                baseName,
                fileExt,
                index,
                DOM.patternInput?.value || '{name}',
                filePath,
                metaData
            );
            break;
        case 'replace':
            newName = applyFindReplace(
                fileName,
                fileExt,
                DOM.findText?.value || '',
                DOM.replaceText?.value || '',
                DOM.caseSensitive?.checked || false
            );
            break;
        case 'regex':
            newName = applyRegex(
                fileName,
                fileExt,
                DOM.regexPattern?.value || '',
                DOM.regexReplacement?.value || ''
            );
            break;
        case 'word':
            newName = await applyWordRules(
                fileName,
                fileExt,
                index,
                State.wordRules,
                State.selectedWordTokens,
                State.wordPatterns,
                DOM.applyToAllFiles?.checked || false,
                State.applySimilarPattern,
                State.treatSelectionAsOne,
                State.selectedGroups
            );
            break;
        case 'numbering':
            newName = applyNumbering(baseName, fileExt, index, {
                pattern: DOM.numberingPattern?.value || '{name}_{num}',
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
                DOM.expressionInput?.value || null
            );
            break;
    }

    return newName;
}

/**
 * 결과 표시
 */
export function showResults(results, DOM) {
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
 * 단어 미리보기 업데이트 함수
 * 단어 선택 후 미리보기만 업데이트하는 경량화된 함수
 */
export function updateWordMethodPreview(DOM) {
    const updateId = ++previewUpdateId;

    // 현재 메소드가 word가 아니면 전체 미리보기 업데이트
    if (State.currentMethod !== 'word') {
        updatePreview(DOM);
        return;
    }

    // 모든 파일의 새 이름 생성 및 미리보기 업데이트
    for (let index = 0; index < State.selectedFiles.length; index++) {
        if (updateId !== previewUpdateId) return;
        const file = State.selectedFiles[index];
        const fileName = getFileName(file);

        // 이 파일에 대한 새 이름 생성
        applyWordRules(
            fileName,
            '',
            index,
            State.wordRules,
            State.selectedWordTokens,
            State.wordPatterns,
            DOM.applyToAllFiles && DOM.applyToAllFiles.checked,
            State.applySimilarPattern,
            State.treatSelectionAsOne,
            State.selectedGroups
        ).then(newName => {
            if (updateId !== previewUpdateId) return;
            // 미리보기 요소 찾기
            const previewItem = document.querySelector(`.preview-item[data-index="${index}"]`);
            if (previewItem) {
                const newNameEl = previewItem.querySelector('.new-name');
                if (newNameEl) {
                    // 새 이름 업데이트
                    newNameEl.textContent = newName;
                }
            }
        });
    }
}

/**
 * 단어 선택 후 UI 업데이트
 */
export function updateAfterWordSelection(DOM) {
    // 미리보기 업데이트
    if (State.currentMethod === 'word') {
        updateWordMethodPreview(DOM);
    } else {
        updatePreview(DOM);
    }
} 