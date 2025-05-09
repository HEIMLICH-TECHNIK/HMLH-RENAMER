/**
 * 패턴 방식 이름 변경 모듈
 * 파일 이름 패턴 기반 변환 기능을 제공합니다.
 */

import { getCurrentDateFormat, formatDate } from '../utils/date-formatter.js';

/**
 * 패턴 방식으로 새 파일 이름 생성
 * @param {string} baseName - 확장자 없는 파일 이름
 * @param {string} fileExt - 파일 확장자 (점 포함)
 * @param {number} index - 파일 인덱스
 * @param {string} pattern - 적용할 패턴
 * @param {Object} metaData - 파일 메타데이터 (너비, 높이, 기간 등)
 * @returns {string} 새 파일 이름
 */
async function applyPattern(baseName, fileExt, index, pattern, filePath, metaData = {}) {
  // 패턴이 없으면 기본값 사용
  const patternToUse = pattern || '{name}';
  
  // 순차 번호 포맷팅 (1부터 시작하는 인덱스)
  const numValue = index + 1;
  let formattedNumber = numValue.toString();
  
  // 오늘 날짜를 지정된 형식으로 포맷팅
  const today = new Date();
  const dateFormat = getCurrentDateFormat();
  const dateString = formatDate(today, dateFormat);
  
  // 미디어 파일 타입 확인
  const isImage = metaData.isImage || /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath || '');
  const isVideo = metaData.isVideo || /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(filePath || '');
  
  // 메타데이터 값 추출 또는 기본값 설정
  const width = metaData.width || 0;
  const height = metaData.height || 0;
  const duration = metaData.duration || 0;
  const frames = metaData.frames || 0;
  const colorspace = metaData.colorspace || 'unknown';
  const colorTransfer = metaData.color_transfer || 'unknown';
  const codec = metaData.codec || 'unknown';
  const bitDepth = metaData.bit_depth || 'unknown';
  const chromaSubsampling = metaData.chroma_subsampling || 'unknown';
  const scanType = metaData.scan_type || 'unknown';
  const bitrate = metaData.bitrate || 'unknown';
  const pixelFormat = metaData.pixel_format || 'unknown';
  
  // 비디오 시간 포맷팅
  let durationFormatted = '00:00:00';
  if (duration > 0) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    durationFormatted = [hours, minutes, seconds]
      .map(v => v.toString().padStart(2, '0'))
      .join(':');
  }
  
  // 패딩 처리된 숫자 (3자리)
  const paddedNumber = numValue.toString().padStart(3, '0');
  
  // 패턴의 변수 교체
  let newName = patternToUse
    .replace(/{name}/g, baseName)
    .replace(/{ext}/g, fileExt.replace('.', ''))
    .replace(/{num}/g, formattedNumber)
    .replace(/{padnum3}/g, paddedNumber)
    .replace(/{date}/g, dateString)
    .replace(/{width}/g, width.toString())
    .replace(/{height}/g, height.toString())
    .replace(/{duration}/g, duration.toString())
    .replace(/{duration_fmt}/g, durationFormatted)
    .replace(/{frames}/g, frames.toString())
    .replace(/{colorspace}/g, colorspace)
    .replace(/{log}/g, colorTransfer)
    .replace(/{codec}/g, codec)
    .replace(/{bit_depth}/g, bitDepth)
    .replace(/{chroma_subsampling}/g, chromaSubsampling)
    .replace(/{scan_type}/g, scanType)
    .replace(/{bitrate}/g, bitrate)
    .replace(/{pixel_format}/g, pixelFormat)
    .replace(/{is_image}/g, isImage ? 'image' : '')
    .replace(/{is_video}/g, isVideo ? 'video' : '')
    .replace(/{upper_name}/g, baseName.toUpperCase())
    .replace(/{lower_name}/g, baseName.toLowerCase());
  
  // 조건부 변수 처리 - {if_image:텍스트} 형식
  newName = newName.replace(/{if_image:(.*?)}/g, (match, content) => isImage ? content : '');
  
  // 조건부 변수 처리 - {if_video:텍스트} 형식
  newName = newName.replace(/{if_video:(.*?)}/g, (match, content) => isVideo ? content : '');
  
  // 조건부 변수 처리 - {if_landscape:텍스트} 형식 (가로가 세로보다 큰 경우)
  newName = newName.replace(/{if_landscape:(.*?)}/g, (match, content) => width > height ? content : '');
  
  // 조건부 변수 처리 - {if_portrait:텍스트} 형식 (세로가 가로보다 큰 경우)
  newName = newName.replace(/{if_portrait:(.*?)}/g, (match, content) => height > width ? content : '');
  
  // 패턴에 확장자가 포함되지 않은 경우 확장자 추가
  if (fileExt && !newName.includes(fileExt)) {
    newName += fileExt;
  }
  
  return newName;
}

/**
 * 패턴에 {date} 변수가 있는지 확인하고 UI 업데이트
 * @param {string} pattern - 확인할 패턴
 * @param {HTMLElement} dateFormatContainer - 날짜 형식 컨테이너 요소
 * @param {HTMLElement} dateFormatOptions - 날짜 형식 옵션 요소
 * @param {HTMLElement} toggleDateOptions - 날짜 형식 토글 버튼
 * @returns {boolean} 날짜 변수 포함 여부
 */
function checkDateVariableInPattern(pattern, dateFormatContainer, dateFormatOptions, toggleDateOptions) {
  if (!dateFormatContainer) return false;
  
  const hasDateVar = pattern.includes('{date}');
  
  if (hasDateVar) {
    dateFormatContainer.classList.add('active');
  } else {
    dateFormatContainer.classList.remove('active');
    
    // 옵션 패널도 닫기
    if (dateFormatOptions && toggleDateOptions) {
      dateFormatOptions.classList.remove('expanded');
      toggleDateOptions.textContent = 'Options ▼';
    }
  }
  
  return hasDateVar;
}

export { applyPattern, checkDateVariableInPattern }; 