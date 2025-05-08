/**
 * 미디어 파일 유틸리티 모듈
 * 이미지, 비디오 파일의 처리와 메타데이터 추출, 로딩 UI를 관리합니다.
 */

import { getImageSize } from '../api.js';

// 미디어 타입 검출 정규식
const IMAGE_REGEX = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i;
const VIDEO_REGEX = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i;
const SPECIAL_IMAGE_REGEX = /\.(exr|dpx|tiff?|psd|hdr)$/i;

/**
 * 파일이 이미지인지 확인합니다.
 * @param {string} filePath - 확인할 파일 경로
 * @returns {boolean} 이미지 여부
 */
export function isImageFile(filePath) {
  return IMAGE_REGEX.test(filePath);
}

/**
 * 파일이 비디오인지 확인합니다.
 * @param {string} filePath - 확인할 파일 경로
 * @returns {boolean} 비디오 여부
 */
export function isVideoFile(filePath) {
  return VIDEO_REGEX.test(filePath);
}

/**
 * 파일이 특수 이미지 포맷인지 확인합니다.
 * @param {string} filePath - 확인할 파일 경로
 * @returns {boolean} 특수 이미지 포맷 여부
 */
export function isSpecialImageFile(filePath) {
  return SPECIAL_IMAGE_REGEX.test(filePath);
}

/**
 * 미디어 파일의 메타데이터(크기, 길이)를 가져옵니다.
 * @param {string} filePath - 파일 경로
 * @param {Function} onProgress - 진행 상황 콜백 함수 (optional)
 * @returns {Promise<Object>} 미디어 메타데이터 (width, height, duration)
 */
export async function getMediaMetadata(filePath, onProgress) {
  try {
    if (!filePath) {
      return { width: 0, height: 0, duration: 0, isImage: false, isVideo: false };
    }
    
    const isImage = isImageFile(filePath);
    const isVideo = isVideoFile(filePath);
    
    if (!isImage && !isVideo) {
      return { width: 0, height: 0, duration: 0, isImage: false, isVideo: false };
    }
    
    // 진행 상황 업데이트
    if (onProgress) {
      onProgress('loading', 0, isImage ? '이미지 정보 로드 중...' : '비디오 정보 로드 중...');
    }
    
    // API를 통해 미디어 정보 요청
    const mediaInfo = await getImageSize(filePath);
    
    // 진행 상황 완료
    if (onProgress) {
      onProgress('complete', 100, '완료');
    }
    
    return {
      width: mediaInfo.width || 0,
      height: mediaInfo.height || 0,
      duration: mediaInfo.duration || 0,
      isImage,
      isVideo
    };
  } catch (error) {
    console.error('미디어 메타데이터 가져오기 실패:', error);
    
    // 진행 상황 에러
    if (onProgress) {
      onProgress('error', 0, '미디어 정보 로드 실패');
    }
    
    return { 
      width: 0, 
      height: 0, 
      duration: 0, 
      isImage: isImageFile(filePath), 
      isVideo: isVideoFile(filePath) 
    };
  }
}

/**
 * 파일 요소에 로딩 UI를 생성합니다.
 * @param {HTMLElement} fileElement - 로딩 표시기를 추가할 파일 요소
 * @returns {Object} 로딩 UI 컨트롤 객체
 */
export function createLoaderUI(fileElement) {
  // 기존 로딩 UI가 있으면 제거
  const existingLoader = fileElement.querySelector('.file-loader');
  if (existingLoader) {
    existingLoader.remove();
  }
  
  // 로더 컨테이너 생성
  const loader = document.createElement('div');
  loader.className = 'file-loader';
  
  // 로딩 바 생성
  const progressBar = document.createElement('div');
  progressBar.className = 'loader-progress';
  
  const progressFill = document.createElement('div');
  progressFill.className = 'loader-progress-fill';
  progressBar.appendChild(progressFill);
  
  // 로딩 텍스트 생성
  const statusText = document.createElement('div');
  statusText.className = 'loader-status';
  statusText.textContent = '로딩 중...';
  
  // 컨테이너에 추가
  loader.appendChild(progressBar);
  loader.appendChild(statusText);
  
  // 파일 요소에 로더 추가
  fileElement.appendChild(loader);
  
  // 로더 UI 컨트롤 객체 반환
  return {
    /**
     * 로딩 상태를 업데이트합니다.
     * @param {string} state - 상태 (loading, complete, error)
     * @param {number} progress - 진행률 (0-100)
     * @param {string} message - 상태 메시지
     */
    update(state, progress, message) {
      // 진행률 업데이트
      progressFill.style.width = `${progress}%`;
      
      // 메시지 업데이트
      statusText.textContent = message || '로딩 중...';
      
      // 상태에 따른 클래스 변경
      loader.className = `file-loader ${state}`;
      
      // 완료 또는 에러 상태면 일정 시간 후 제거
      if (state === 'complete' || state === 'error') {
        setTimeout(() => {
          loader.classList.add('fade-out');
          setTimeout(() => {
            if (loader.parentNode === fileElement) {
              loader.remove();
            }
          }, 500);
        }, 1500);
      }
    },
    
    /**
     * 로딩 UI를 제거합니다.
     */
    remove() {
      if (loader.parentNode === fileElement) {
        loader.remove();
      }
    }
  };
}

/**
 * 파일의 섬네일 이미지를 생성합니다.
 * @param {string} filePath - 파일 경로
 * @returns {HTMLElement} 섬네일 요소
 */
export function createThumbnail(filePath) {
  const thumbnail = document.createElement('div');
  thumbnail.className = 'file-thumbnail';
  
  if (isImageFile(filePath)) {
    // 이미지 파일인 경우
    const img = document.createElement('img');
    img.src = `file://${filePath}`; // Electron에서 로컬 파일 접근
    img.alt = 'Thumbnail';
    img.onerror = () => {
      img.src = 'assets/image-icon.svg'; // 로드 실패 시 기본 이미지
    };
    thumbnail.appendChild(img);
    thumbnail.classList.add('image-thumbnail');
  } else if (isVideoFile(filePath)) {
    // 비디오 파일인 경우
    thumbnail.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
        <path d="M9.5 8.5L16.5 12L9.5 15.5V8.5Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;
    thumbnail.classList.add('video-thumbnail');
  } else {
    // 기타 파일인 경우
    thumbnail.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    thumbnail.classList.add('file-thumbnail');
  }
  
  return thumbnail;
}

/**
 * 파일 요소에 미디어 메타데이터를 추가하고 표시합니다.
 * @param {HTMLElement} fileElement - 파일 요소
 * @param {string} filePath - 파일 경로
 * @returns {Promise<Object>} 미디어 메타데이터
 */
export async function loadMediaInfo(fileElement, filePath) {
  // 로딩 UI 생성
  const loader = createLoaderUI(fileElement);
  
  try {
    // 미디어 정보 로드
    const mediaInfo = await getMediaMetadata(filePath, (state, progress, message) => {
      loader.update(state, progress, message);
    });
    
    // 미디어 정보 표시 영역 생성 또는 가져오기
    let infoElement = fileElement.querySelector('.media-info');
    if (!infoElement) {
      infoElement = document.createElement('div');
      infoElement.className = 'media-info';
      fileElement.appendChild(infoElement);
    }
    
    // 미디어 정보 표시
    if (mediaInfo.isImage || mediaInfo.isVideo) {
      const dimensions = `${mediaInfo.width}x${mediaInfo.height}`;
      let infoText = mediaInfo.isImage ? `이미지: ${dimensions}` : `비디오: ${dimensions}`;
      
      if (mediaInfo.isVideo && mediaInfo.duration > 0) {
        infoText += `, ${formatTime(mediaInfo.duration)}`;
      }
      
      infoElement.textContent = infoText;
      infoElement.classList.add('show');
    } else {
      infoElement.remove();
    }
    
    return mediaInfo;
  } catch (error) {
    console.error('미디어 정보 로드 실패:', error);
    loader.update('error', 0, '미디어 정보 로드 실패');
    return { width: 0, height: 0, duration: 0, isImage: false, isVideo: false };
  }
}

/**
 * 초 단위 시간을 HH:MM:SS 형식으로 변환합니다.
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포맷팅된 시간 문자열
 */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00:00";
  
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
} 