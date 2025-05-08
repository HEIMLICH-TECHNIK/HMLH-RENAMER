/**
 * 날짜 포맷 유틸리티
 * 날짜 형식 변환 기능을 제공합니다.
 */

import DOM from '../core/dom.js';

/**
 * 현재 선택된 날짜 포맷 가져오기
 * @returns {string} 날짜 형식 문자열
 */
function getCurrentDateFormat() {
  if (!DOM.dateFormatPreset) return 'YYYY-MM-DD'; // 기본 포맷
  
  const selectedFormat = DOM.dateFormatPreset.value;
  
  if (selectedFormat === 'custom' && DOM.dateFormatCustom) {
    return DOM.dateFormatCustom.value || 'YYYY-MM-DD';
  }
  
  return selectedFormat;
}

/**
 * 날짜를 지정된 포맷으로 변환
 * @param {Date} date - 포맷할 날짜 객체
 * @param {string} format - 날짜 형식 문자열
 * @returns {string} 포맷된 날짜 문자열
 */
function formatDate(date, format) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // 날짜 포맷 토큰 대체
  return format
    .replace(/YYYY/g, year.toString())
    .replace(/YY/g, year.toString().slice(-2))
    .replace(/MM/g, month.toString().padStart(2, '0'))
    .replace(/DD/g, day.toString().padStart(2, '0'))
    .replace(/HH/g, hours.toString().padStart(2, '0'))
    .replace(/mm/g, minutes.toString().padStart(2, '0'))
    .replace(/ss/g, seconds.toString().padStart(2, '0'));
}

export { getCurrentDateFormat, formatDate }; 