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

// 정렬 유틸리티 모듈 임포트
import { sortFiles as sortFilesUtil } from './utils/sorting.js';

// 이름 변경 방식 모듈 임포트
import { applyPattern, checkDateVariableInPattern } from './rename-methods/pattern.js';
import { applyFindReplace, escapeRegExp } from './rename-methods/replace.js';
import { applyRegex } from './rename-methods/regex.js';
import { addWordRule, applyWordRules, createWordPattern, splitWordsInFileName, selectSimilarPatternWords } from './rename-methods/word.js';
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
        const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(file);
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

        await Promise.all(batch.map(async(file) => {
            try {
                // 이미 캐시된 경우 스킵
                if (State.mediaCache[file]) {
                    completed++;
                    if (progressSpan) progressSpan.textContent = `${completed}/${mediaFiles.length}`;
                    return;
                }

                const isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(file);
                const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(file);

                // 기본 메타데이터 정보
                const metadata = {
                    width: 0,
                    height: 0,
                    duration: 0,
                    frames: 0,
                    colorspace: 'unknown',
                    color_transfer: 'unknown',
                    codec: 'unknown',
                    bit_depth: 'unknown',
                    chroma_subsampling: 'unknown',
                    scan_type: 'unknown',
                    bitrate: 'unknown',
                    pixel_format: 'unknown',
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

                            // 비디오 파일인 경우 추가 정보
                            if (isVideo) {
                                if (dimensions.duration) {
                                    metadata.duration = parseFloat(dimensions.duration) || 0;
                                }
                                if (dimensions.frames) {
                                    metadata.frames = parseInt(dimensions.frames) || 0;
                                }
                                if (dimensions.colorspace) {
                                    metadata.colorspace = dimensions.colorspace;
                                }
                                if (dimensions.color_transfer) {
                                    metadata.color_transfer = dimensions.color_transfer;
                                }
                                if (dimensions.codec) {
                                    metadata.codec = dimensions.codec;
                                }
                                if (dimensions.bit_depth) {
                                    metadata.bit_depth = dimensions.bit_depth;
                                }
                                if (dimensions.chroma_subsampling) {
                                    metadata.chroma_subsampling = dimensions.chroma_subsampling;
                                }
                                if (dimensions.scan_type) {
                                    metadata.scan_type = dimensions.scan_type;
                                }
                                if (dimensions.bitrate) {
                                    metadata.bitrate = dimensions.bitrate;
                                }
                                if (dimensions.pixel_format) {
                                    metadata.pixel_format = dimensions.pixel_format;
                                }
                            }

                            metadata.loaded = true;
                            console.log(`Loaded media info for ${file}: ${metadata.width}x${metadata.height}, duration: ${metadata.duration}s, frames: ${metadata.frames}, colorspace: ${metadata.colorspace}, log: ${metadata.color_transfer}, codec: ${metadata.codec}, bit_depth: ${metadata.bit_depth}, chroma: ${metadata.chroma_subsampling}, scan: ${metadata.scan_type}, bitrate: ${metadata.bitrate}`);
                        }
                    } catch (error) {
                        console.error(`Error loading media info for ${file}:`, error);
                    }
                }

                // 비디오 파일에 대해 추가 정보 가져오기 시도
                if (isVideo && window.electron && window.electron.getVideoMetadata) {
                    try {
                        const videoInfo = await window.electron.getVideoMetadata(file);
                        if (videoInfo) {
                            // 비디오 메타데이터 병합
                            Object.assign(metadata, videoInfo);
                            metadata.loaded = true;
                            console.log(`Loaded extended video info for ${file}:`, videoInfo);
                        }
                    } catch (error) {
                        console.error(`Error loading video metadata for ${file}:`, error);
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
        DOM.fileCount.textContent = State.selectedFiles.length === 1 ?
            '1 file selected' :
            `${State.selectedFiles.length} files selected`;

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
            // 개선된 단어 분리 함수 사용
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
                // 툴큰 추가
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
                    updateAfterWordSelection();
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

        updateUI();
    });

    DOM.previewArea.appendChild(previewList);
}

/**
 * 드래그 앤 드롭 위치 계산 도우미 함수
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.preview-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - (box.top + box.height / 2);

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
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
            newName = await applyWordRules(
                fileName,
                fileExt,
                index,
                State.wordRules,
                State.selectedWordTokens,
                State.wordPatterns,
                DOM.applyToAllFiles && DOM.applyToAllFiles.checked,
                State.applySimilarPattern,
                State.treatSelectionAsOne,
                State.selectedGroups
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
 * 단어 미리보기 업데이트 함수
 * 단어 선택 후 미리보기만 업데이트하는 경량화된 함수
 */
function updateWordMethodPreview() {
    // 현재 메소드가 word가 아니면 전체 미리보기 업데이트
    if (State.currentMethod !== 'word') {
        updatePreview();
        return;
    }

    // 모든 파일의 새 이름 생성 및 미리보기 업데이트
    for (let index = 0; index < State.selectedFiles.length; index++) {
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
function updateAfterWordSelection() {
    // 미리보기 업데이트
    if (State.currentMethod === 'word') {
        updateWordMethodPreview();
    } else {
        updatePreview();
    }
}

/**
 * 앱 초기화
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
    DOM.fileSelectBtn.addEventListener('click', async() => {
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
        DOM.patternInput.addEventListener('input', async() => {
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
    if (DOM.findText) DOM.findText.addEventListener('input', async() => await updatePreview());
    if (DOM.replaceText) DOM.replaceText.addEventListener('input', async() => await updatePreview());
    if (DOM.caseSensitive) DOM.caseSensitive.addEventListener('change', async() => await updatePreview());

    // 정규식 필드
    if (DOM.regexPattern) DOM.regexPattern.addEventListener('input', async() => await updatePreview());
    if (DOM.regexReplacement) DOM.regexReplacement.addEventListener('input', async() => await updatePreview());

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

            await updatePreview();
        });
    }

    // 커스텀 날짜 포맷
    if (DOM.dateFormatCustom) {
        DOM.dateFormatCustom.addEventListener('input', async() => await updatePreview());
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
            // 히스토리 저장
            saveToHistory('apply-to-all-toggle');

            // 체크 해제 시 패턴 초기화
            if (!DOM.applyToAllFiles.checked) {
                State.wordPatterns = [];
                console.log('전체 적용 패턴 초기화');
            } else {
                // 체크 활성화 시 현재 선택된 단어들을 패턴으로 자동 추가
                State.selectedWordTokens.forEach(token => {
                    const word = token.word;
                    // 이미 패턴에 추가되지 않은 경우에만 추가
                    if (word && !State.wordPatterns.some(pattern => pattern.word === word)) {
                        State.wordPatterns.push(createWordPattern(word));
                        console.log(`패턴 추가: "${word}"`);
                    }
                });
            }

            // 전체 UI 업데이트 - 단순 미리보기 대신 더 포괄적인 UI 업데이트 실행
            updateUI();
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
            updateUI();
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
            updateUI();
        });
    }

    // 넘버링 방식 컨트롤
    if (DOM.numberingPattern) DOM.numberingPattern.addEventListener('input', async() => await updatePreview());
    if (DOM.startNumber) DOM.startNumber.addEventListener('input', async() => await updatePreview());
    if (DOM.numberPadding) DOM.numberPadding.addEventListener('input', async() => await updatePreview());
    if (DOM.numberStep) DOM.numberStep.addEventListener('input', async() => await updatePreview());
    if (DOM.sortingMethod) DOM.sortingMethod.addEventListener('change', async() => await updatePreview());
    if (DOM.reverseOrder) DOM.reverseOrder.addEventListener('change', async() => await updatePreview());

    // 표현식 방식 컨트롤
    if (DOM.expressionInput) DOM.expressionInput.addEventListener('input', async() => await updatePreview());

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
            sortFiles(sortBy);

            // UI 업데이트
            updateUI();
        });
    }

    // 설정 버튼과 모달 초기화
    const profileBtn = document.getElementById('profileBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');

    // 설정 탭 관련 요소들
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsContents = document.querySelectorAll('.settings-content');

    // 시스템 정보 표시
    const systemOSElement = document.getElementById('systemOS');
    const electronVersionElement = document.getElementById('electronVersion');

    // 설정 버튼 클릭 이벤트
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            if (settingsModal) {
                showModal(settingsModal);

                // 시스템 정보 업데이트
                if (window.electron && window.electron.getSystemInfo && systemOSElement) {
                    window.electron.getSystemInfo().then(info => {
                        if (systemOSElement) systemOSElement.textContent = info.os || 'Unknown';
                        if (electronVersionElement) electronVersionElement.textContent = info.electronVersion || 'Unknown';
                    }).catch(err => {
                        console.error('Failed to get system info:', err);
                    });
                }
            }
        });
    }

    // 설정 탭 클릭 이벤트
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

    // 계정 설정 관련 이벤트
    const saveAccountBtn = document.getElementById('saveAccountBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');

    if (saveAccountBtn) {
        saveAccountBtn.addEventListener('click', () => {
            const displayName = document.getElementById('userDisplayName').value;
            const email = document.getElementById('userEmail').value;

            // 계정 정보 저장 처리 (향후 구현)
            console.log('Saving account info:', { displayName, email });
            showToast('Account information saved successfully', 'success');
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            // 로그아웃 처리 (향후 구현)
            console.log('User signed out');
            showToast('You have been signed out', 'info');
        });
    }

    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', async() => {
            // 이미지 선택 다이얼로그 표시 (향후 구현)
            console.log('Change avatar clicked');

            if (window.api && window.api.selectImage) {
                try {
                    const imagePath = await window.api.selectImage();
                    if (imagePath) {
                        const profilePicture = document.getElementById('profilePicture');
                        if (profilePicture) {
                            profilePicture.style.backgroundImage = `url('${imagePath}')`;
                            profilePicture.style.backgroundSize = 'cover';
                            profilePicture.style.backgroundPosition = 'center';
                            // 기본 텍스트 내용 제거
                            profilePicture.innerHTML = '';
                            console.log('Profile picture updated:', imagePath);
                        }
                    }
                } catch (error) {
                    console.error('Failed to select image:', error);
                }
            }
        });
    }

    // 파일 설정 관련 이벤트
    const browseFolderBtn = document.getElementById('browseFolderBtn');
    if (browseFolderBtn) {
        browseFolderBtn.addEventListener('click', async() => {
            if (window.api && window.api.selectFolder) {
                try {
                    const folderPath = await window.api.selectFolder();
                    if (folderPath) {
                        const defaultFolderPath = document.getElementById('defaultFolderPath');
                        if (defaultFolderPath) {
                            defaultFolderPath.value = folderPath;
                            console.log('Default folder updated:', folderPath);
                        }
                    }
                } catch (error) {
                    console.error('Failed to select folder:', error);
                }
            }
        });
    }

    // 업데이트 확인 이벤트
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', () => {
            // 업데이트 확인 기능 (향후 구현)
            console.log('Checking for updates...');

            // 임시 토스트 메시지
            setTimeout(() => {
                showToast('You are using the latest version', 'success');
            }, 1000);
        });
    }

    // 설정 모달 닫기 버튼 이벤트
    if (closeSettingsModalBtn) {
        closeSettingsModalBtn.addEventListener('click', () => {
            if (settingsModal) {
                hideModal(settingsModal);
            }
        });
    }

    // 설정 모달 외부 클릭 시 닫기
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                hideModal(settingsModal);
            }
        });
    }

    // About 모달 관련 이벤트 핸들러
    document.addEventListener('DOMContentLoaded', function() {
        // About 모달 관련 요소
        const aboutModal = document.getElementById('aboutModal');
        const openAboutModalBtn = document.getElementById('openAboutModalBtn');
        const closeAboutModalBtn = document.getElementById('closeAboutModalBtn');
        const checkUpdatesBtn2 = document.getElementById('checkUpdatesBtn2');
        const versionInfoBtn = document.getElementById('versionInfoBtn');

        // About 모달에 사용할 시스템 정보 요소
        const aboutSystemOS = document.getElementById('aboutSystemOS');
        const aboutElectronVersion = document.getElementById('aboutElectronVersion');

        // 버전 정보 버튼 이벤트 리스너 추가
        if (versionInfoBtn && aboutModal) {
            versionInfoBtn.addEventListener('click', () => {
                showModal(aboutModal);

                // 시스템 정보 업데이트
                if (window.electron && window.electron.getSystemInfo) {
                    window.electron.getSystemInfo().then(info => {
                        if (aboutSystemOS) aboutSystemOS.textContent = info.os || 'Unknown';
                        if (aboutElectronVersion) aboutElectronVersion.textContent = info.electronVersion || 'Unknown';
                    }).catch(err => {
                        console.error('Failed to get system info for About modal:', err);
                    });
                }
            });
        }

        // About 모달 열기 버튼 이벤트
        if (openAboutModalBtn && aboutModal) {
            openAboutModalBtn.addEventListener('click', () => {
                // 설정 모달 닫기
                if (settingsModal) {
                    hideModal(settingsModal);
                }

                // 약간의 딜레이 후 About 모달 열기
                setTimeout(() => {
                    showModal(aboutModal);

                    // 시스템 정보 업데이트
                    if (window.electron && window.electron.getSystemInfo) {
                        window.electron.getSystemInfo().then(info => {
                            if (aboutSystemOS) aboutSystemOS.textContent = info.os || 'Unknown';
                            if (aboutElectronVersion) aboutElectronVersion.textContent = info.electronVersion || 'Unknown';
                        }).catch(err => {
                            console.error('Failed to get system info for About modal:', err);
                        });
                    }
                }, 300); // 설정 모달 닫힘 애니메이션 시간을 고려한 딜레이
            });
        }

        // About 모달 닫기 버튼 이벤트
        if (closeAboutModalBtn && aboutModal) {
            closeAboutModalBtn.addEventListener('click', () => {
                hideModal(aboutModal);
            });
        }

        // About 모달 외부 클릭 시 닫기
        if (aboutModal) {
            aboutModal.addEventListener('click', (e) => {
                if (e.target === aboutModal) {
                    hideModal(aboutModal);
                }
            });
        }

        // About 모달의 업데이트 확인 버튼 이벤트
        if (checkUpdatesBtn2) {
            checkUpdatesBtn2.addEventListener('click', () => {
                console.log('Checking for updates from About modal...');

                // 임시 토스트 메시지
                setTimeout(() => {
                    showToast('You are using the latest version', 'success');
                }, 1000);
            });
        }
    });

    // 다른 모달 관련 코드도 showModal/hideModal 함수를 사용하도록 업데이트
    const closeRulesModalBtn = document.getElementById('closeRulesModalBtn');
    if (closeRulesModalBtn) {
        closeRulesModalBtn.addEventListener('click', () => {
            hideModal(document.getElementById('rulesModal'));
        });
    }

    const closeInputModalBtn = document.getElementById('closeInputModalBtn');
    if (closeInputModalBtn) {
        closeInputModalBtn.addEventListener('click', () => {
            hideModal(document.getElementById('inputModal'));
        });
    }

    const closeExpressionExamplesBtn = document.getElementById('closeExpressionExamplesBtn');
    if (closeExpressionExamplesBtn) {
        closeExpressionExamplesBtn.addEventListener('click', () => {
            hideModal(document.getElementById('expressionExamplesModal'));
        });
    }

    // UI 초기화
    updateUI();
}

/**
 * 파일 정렬 함수 - 별도 모듈 사용
 */
function sortFiles(sortBy) {
    // 이미 정렬 중이면 중단
    if (State.isSorting) return;

    console.log(`정렬 시작(${sortBy}) - 파일 수: ${State.selectedFiles.length}`);

    // 정렬 상태 설정
    State.isSorting = true;

    // 정렬 로딩 표시
    DOM.previewArea.innerHTML = '<div class="sorting-indicator">정렬 중...</div>';

    // 로딩 인디케이터 표시
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'media-loading-indicator';
    loadingIndicator.innerHTML = `
    <div class="loading-icon"></div>
    <div class="loading-text">정렬 중: ${sortBy === 'date' ? '날짜' : sortBy === 'size' ? '크기' : sortBy}</div>
  `;
    document.body.appendChild(loadingIndicator);

    // 인디케이터 제거 함수
    const removeLoader = () => {
        loadingIndicator.classList.add('fade-out');
        setTimeout(() => {
            if (document.body.contains(loadingIndicator)) {
                document.body.removeChild(loadingIndicator);
            }
        }, 500);
    };

    // 정렬 모듈의 sortFiles 함수 사용
    sortFilesUtil(State.selectedFiles, sortBy, window.api)
        .then(sortedFiles => {
            // 정렬된 파일 목록 적용
            State.selectedFiles = sortedFiles;

            // UI 업데이트
            removeLoader();
            State.isSorting = false;
            setTimeout(() => updatePreview(), 0);

            console.log(`정렬 완료: ${State.selectedFiles.length}개 파일`);
        })
        .catch(error => {
            console.error('정렬 실패:', error);
            removeLoader();
            State.isSorting = false;
            setTimeout(() => updatePreview(), 0);
        });
}

// 클릭 가능한 변수 및 예시 처리를 위한 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function() {
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
});

// 커서 위치에 텍스트 삽입하는 도우미 함수
function insertAtCursor(field, text) {
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

// 모달 표시 함수 - 애니메이션과 함께 모달을 표시합니다
function showModal(modalElement) {
    if (!modalElement) return;

    // 모달에 표시 전 준비 클래스 추가 (트랜지션을 위해)
    modalElement.classList.add('preparing-modal');

    // 레이아웃 리플로우를 강제하기 위한 트릭
    void modalElement.offsetWidth;

    // hidden 클래스 제거 및 준비 클래스 제거
    modalElement.classList.remove('hidden');

    // 약간의 지연 후 준비 클래스 제거
    setTimeout(() => {
        modalElement.classList.remove('preparing-modal');
    }, 10);
}

// 모달 숨김 함수 - 애니메이션과 함께 모달을 숨깁니다
function hideModal(modalElement) {
    if (!modalElement) return;

    // hidden 클래스 추가
    modalElement.classList.add('hidden');
}

// 앱 초기화
initializeApp();