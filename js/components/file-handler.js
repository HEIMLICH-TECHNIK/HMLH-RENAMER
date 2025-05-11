/**
 * 파일 처리 관련 컴포넌트
 * 파일 드래그 앤 드롭, 파일 목록 관리 기능 제공
 */

import State from '../core/state.js';
import { saveToHistory } from '../core/history.js';
import { getFileName, processDroppedFiles } from '../utils/file-utils.js';
import { sortFiles as sortFilesUtil } from '../utils/sorting.js';
import { showToast } from '../utils/toast.js';

/**
 * 선택된 파일 목록 업데이트
 */
export async function handleFiles(fileList) {
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
        const mediaMetadataLoader = await import('./media-metadata.js');
        mediaMetadataLoader.loadMediaMetadata(files);

        // 업데이트 이벤트 디스패치
        document.dispatchEvent(new CustomEvent('files-updated'));
        console.log(`Added ${files.length} files, total: ${State.selectedFiles.length}`);
    }
}

/**
 * 파일 목록 업데이트
 */
export function updateFileList(DOM) {
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
            document.dispatchEvent(new CustomEvent('files-updated'));
        });

        // 요소들을 파일 항목에 추가
        fileItem.appendChild(fileIcon);
        fileItem.appendChild(fileDetails);
        fileItem.appendChild(removeBtn);
        DOM.fileList.appendChild(fileItem);
    });
}

/**
 * 파일 정렬 함수 - 별도 모듈 사용
 */
export function sortFiles(sortBy, DOM) {
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
            
            // 이벤트 디스패치
            document.dispatchEvent(new CustomEvent('preview-update'));
            console.log(`정렬 완료: ${State.selectedFiles.length}개 파일`);
        })
        .catch(error => {
            console.error('정렬 실패:', error);
            removeLoader();
            State.isSorting = false;
            
            // 에러 토스트 표시
            showToast(`정렬 실패: ${error.message}`, 'error');
            
            // 이벤트 디스패치
            document.dispatchEvent(new CustomEvent('preview-update'));
        });
}

// 드래그 앤 드롭 설정
export function setupDragAndDrop(DOM) {
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
}

/**
 * 드래그 앤 드롭 위치 계산 도우미 함수
 */
export function getDragAfterElement(container, y) {
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