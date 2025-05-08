/**
 * 파일 프리뷰 컴포넌트
 * 파일 목록 표시 및 미리보기 기능을 관리합니다.
 */

import { getFileName } from '../utils/file-utils.js';
import { 
  loadMediaInfo, 
  createThumbnail, 
  isImageFile, 
  isVideoFile,
  formatTime
} from '../utils/media-utils.js';
import { showToast } from '../utils/ui-utils.js';

// 프리뷰 관련 DOM 요소
const previewArea = document.getElementById('previewArea');
const fileList = document.getElementById('fileList');

// 저장된 미디어 메타데이터 캐시
const mediaMetadataCache = new Map();

/**
 * 파일 목록을 업데이트합니다.
 * @param {Array} files - 파일 경로 배열
 * @param {Function} onRemove - 파일 제거 이벤트 핸들러
 */
export function updateFileList(files, onRemove) {
  if (!fileList) return;
  
  fileList.innerHTML = '';
  
  if (files.length === 0) {
    return;
  }
  
  files.forEach((file, index) => {
    const fileItem = createFileItem(file, index);
    
    // 제거 버튼 이벤트 추가
    const removeBtn = fileItem.querySelector('.remove-btn');
    if (removeBtn && onRemove) {
      removeBtn.addEventListener('click', () => onRemove(index));
    }
    
    fileList.appendChild(fileItem);
    
    // 미디어 정보 로드 (비동기)
    loadFileMediaInfo(fileItem, file, index);
  });
}

/**
 * 파일 항목 요소를 생성합니다.
 * @param {string} file - 파일 경로
 * @param {number} index - 파일 인덱스
 * @returns {HTMLElement} 파일 항목 요소
 */
function createFileItem(file, index) {
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  fileItem.dataset.index = index;
  fileItem.dataset.path = file;
  
  // 파일 썸네일 추가
  const thumbnail = createThumbnail(file);
  
  // 파일 정보 컨테이너
  const fileDetails = document.createElement('div');
  fileDetails.className = 'file-details';
  
  // 파일명
  const fileName = document.createElement('div');
  fileName.className = 'file-name';
  fileName.textContent = getFileName(file);
  
  // 파일 경로
  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-info';
  fileInfo.textContent = file;
  
  // 파일 정보 구성
  fileDetails.appendChild(fileName);
  fileDetails.appendChild(fileInfo);
  
  // 제거 버튼
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = '파일 제거';
  
  // 요소 조합
  fileItem.appendChild(thumbnail);
  fileItem.appendChild(fileDetails);
  fileItem.appendChild(removeBtn);
  
  return fileItem;
}

/**
 * 파일의 미디어 정보를 로드하고 표시합니다.
 * @param {HTMLElement} fileItem - 파일 항목 요소
 * @param {string} filePath - 파일 경로
 * @param {number} index - 파일 인덱스
 */
async function loadFileMediaInfo(fileItem, filePath, index) {
  if (!isImageFile(filePath) && !isVideoFile(filePath)) {
    return; // 미디어 파일이 아니면 처리하지 않음
  }
  
  // 캐시에서 정보 확인
  if (mediaMetadataCache.has(filePath)) {
    const cachedInfo = mediaMetadataCache.get(filePath);
    displayMediaInfo(fileItem, cachedInfo);
    return;
  }
  
  try {
    // 미디어 정보 로드 및 표시
    const mediaInfo = await loadMediaInfo(fileItem, filePath);
    
    // 유효한 정보가 있으면 캐시에 저장
    if (mediaInfo && (mediaInfo.width > 0 || mediaInfo.height > 0)) {
      mediaMetadataCache.set(filePath, mediaInfo);
    }
    
    displayMediaInfo(fileItem, mediaInfo);
  } catch (error) {
    console.error('파일 미디어 정보 로드 실패:', error);
  }
}

/**
 * 미디어 정보를 UI에 표시합니다.
 * @param {HTMLElement} fileItem - 파일 항목 요소
 * @param {Object} mediaInfo - 미디어 메타데이터
 */
function displayMediaInfo(fileItem, mediaInfo) {
  if (!mediaInfo || (!mediaInfo.isImage && !mediaInfo.isVideo)) {
    return;
  }
  
  const fileDetails = fileItem.querySelector('.file-details');
  if (!fileDetails) return;
  
  // 기존 미디어 정보 요소 확인 또는 생성
  let mediaInfoElem = fileItem.querySelector('.media-info');
  if (!mediaInfoElem) {
    mediaInfoElem = document.createElement('div');
    mediaInfoElem.className = 'media-info';
    fileDetails.appendChild(mediaInfoElem);
  }
  
  // 미디어 정보 텍스트 설정
  const dimensions = `${mediaInfo.width}x${mediaInfo.height}`;
  let infoText = mediaInfo.isImage ? `이미지: ${dimensions}` : `비디오: ${dimensions}`;
  
  if (mediaInfo.isVideo && mediaInfo.duration > 0) {
    infoText += `, ${formatTime(mediaInfo.duration)}`;
  }
  
  mediaInfoElem.textContent = infoText;
  mediaInfoElem.classList.add('show');
}

/**
 * 프리뷰 영역을 업데이트합니다.
 * @param {Array} files - 파일 경로 배열
 * @param {Function} generateNewName - 새 이름 생성 함수
 */
export async function updatePreview(files, generateNewName) {
  if (!previewArea) return;
  
  if (files.length === 0) {
    previewArea.innerHTML = '<p>파일을 선택하면 미리보기가 표시됩니다</p>';
    return;
  }
  
  previewArea.innerHTML = '';
  const previewList = document.createElement('div');
  previewList.className = 'preview-list';
  
  // 각 파일에 대한 미리보기 생성
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const oldName = getFileName(file);
    let newName;
    
    try {
      newName = await generateNewName(file, index);
    } catch (error) {
      console.error('새 이름 생성 오류:', error);
      newName = oldName;
      showToast(`파일 이름 생성 오류: ${error.message}`, 'error');
    }
    
    const previewItem = createPreviewItem(file, oldName, newName, index);
    previewList.appendChild(previewItem);
  }
  
  previewArea.appendChild(previewList);
}

/**
 * 개별 프리뷰 항목을 생성합니다.
 * @param {string} file - 파일 경로
 * @param {string} oldName - 현재 파일 이름
 * @param {string} newName - 새 파일 이름
 * @param {number} index - 파일 인덱스
 * @returns {HTMLElement} 프리뷰 항목 요소
 */
function createPreviewItem(file, oldName, newName, index) {
  const previewItem = document.createElement('div');
  previewItem.className = 'preview-item';
  previewItem.dataset.index = index;
  previewItem.dataset.path = file;
  
  // 원래 이름
  const oldNameEl = document.createElement('div');
  oldNameEl.className = 'old-name';
  oldNameEl.textContent = oldName;
  
  // 화살표
  const arrow = document.createElement('div');
  arrow.className = 'arrow';
  arrow.textContent = '→';
  
  // 새 이름
  const newNameEl = document.createElement('div');
  newNameEl.className = 'new-name';
  newNameEl.textContent = newName;
  
  // 미디어 정보 표시 (캐시에서 가져오기)
  const mediaInfo = mediaMetadataCache.get(file);
  if (mediaInfo && (mediaInfo.isImage || mediaInfo.isVideo)) {
    const infoElement = document.createElement('div');
    infoElement.className = 'media-info show';
    
    const dimensions = `${mediaInfo.width}x${mediaInfo.height}`;
    let infoText = mediaInfo.isImage ? `이미지: ${dimensions}` : `비디오: ${dimensions}`;
    
    if (mediaInfo.isVideo && mediaInfo.duration > 0) {
      infoText += `, ${formatTime(mediaInfo.duration)}`;
    }
    
    infoElement.textContent = infoText;
    newNameEl.appendChild(infoElement);
  }
  
  // 모든 요소 추가
  previewItem.appendChild(oldNameEl);
  previewItem.appendChild(arrow);
  previewItem.appendChild(newNameEl);
  
  return previewItem;
}

/**
 * 메타데이터 캐시를 비웁니다.
 */
export function clearMetadataCache() {
  mediaMetadataCache.clear();
} 