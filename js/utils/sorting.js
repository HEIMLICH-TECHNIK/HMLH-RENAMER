/**
 * 파일 정렬 유틸리티
 * 파일 목록 정렬 관련 함수들을 제공합니다.
 */

import { getFileName, splitFileName } from './file-utils.js';

/**
 * 이름으로 파일 정렬
 * @param {Array<string>} files 파일 경로 배열
 * @returns {Array<string>} 정렬된 파일 배열
 */
export const sortByName = (files) => {
  return [...files].sort((a, b) => {
    const nameA = getFileName(a).toLowerCase();
    const nameB = getFileName(b).toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

/**
 * 파일 타입(확장자)으로 정렬
 * @param {Array<string>} files 파일 경로 배열
 * @returns {Array<string>} 정렬된 파일 배열
 */
export const sortByType = (files) => {
  return [...files].sort((a, b) => {
    const extA = splitFileName(getFileName(a)).fileExt.toLowerCase();
    const extB = splitFileName(getFileName(b)).fileExt.toLowerCase();
    return extA.localeCompare(extB) || getFileName(a).localeCompare(getFileName(b));
  });
};

/**
 * 파일 날짜 정보 가져오기
 * @param {Array<string>} files 파일 경로 배열
 * @param {Object} api API 객체
 * @returns {Object} 파일 경로를 키로 하는 날짜 객체
 */
export const getFileDates = async (files, api) => {
  const dateCache = {};
  
  await Promise.all(files.map(file => 
    new Promise(async (resolve) => {
      try {
        // API로 파일 메타데이터 가져오기
        if (api && api.getFileStats) {
          const stats = await api.getFileStats(file);
          if (stats && stats.mtime) {
            dateCache[file] = new Date(stats.mtime);
            resolve();
            return;
          }
        }
        
        // 파일명에서 날짜 추출 시도
        const fileName = getFileName(file);
        const dateMatch = fileName.match(/\d{4}[-_]?\d{2}[-_]?\d{2}/);
        if (dateMatch) {
          const dateStr = dateMatch[0].replace(/[-_]/g, '');
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          dateCache[file] = new Date(year, month, day);
        } else {
          dateCache[file] = new Date(0);
        }
        resolve();
      } catch (error) {
        console.error(`날짜 정보 가져오기 실패: ${file}`, error);
        dateCache[file] = new Date(0);
        resolve();
      }
    })
  ));
  
  return dateCache;
};

/**
 * 날짜로 파일 정렬
 * @param {Array<string>} files 파일 경로 배열
 * @param {Object} dateCache 파일별 날짜 정보
 * @returns {Array<string>} 정렬된 파일 배열
 */
export const sortByDate = (files, dateCache) => {
  return [...files].sort((a, b) => {
    const dateA = dateCache[a] || new Date(0);
    const dateB = dateCache[b] || new Date(0);
    return dateB - dateA; // 최신 날짜 우선
  });
};

/**
 * 파일 크기 정보 가져오기
 * @param {Array<string>} files 파일 경로 배열
 * @param {Object} api API 객체
 * @returns {Object} 파일 경로를 키로 하는 크기 정보
 */
export const getFileSizes = async (files, api) => {
  const sizeCache = {};
  
  await Promise.all(files.map(file => 
    new Promise(async (resolve) => {
      try {
        // API로 파일 크기 가져오기
        if (api && api.getFileStats) {
          const stats = await api.getFileStats(file);
          if (stats && stats.size !== undefined) {
            sizeCache[file] = stats.size;
            resolve();
            return;
          }
        }
        
        // 확장자로 대략적인 크기 추정
        const { fileExt } = splitFileName(getFileName(file));
        if (/\.(mp4|mov|avi|mkv)$/i.test(fileExt)) {
          sizeCache[file] = 100000000; // 비디오 파일
        } else if (/\.(jpg|jpeg|png|webp)$/i.test(fileExt)) {
          sizeCache[file] = 2000000; // 이미지 파일
        } else {
          sizeCache[file] = 1000; // 기타 파일
        }
        resolve();
      } catch (error) {
        console.error(`크기 정보 가져오기 실패: ${file}`, error);
        sizeCache[file] = 0;
        resolve();
      }
    })
  ));
  
  return sizeCache;
};

/**
 * 크기로 파일 정렬
 * @param {Array<string>} files 파일 경로 배열
 * @param {Object} sizeCache 파일별 크기 정보
 * @returns {Array<string>} 정렬된 파일 배열
 */
export const sortBySize = (files, sizeCache) => {
  return [...files].sort((a, b) => {
    const sizeA = sizeCache[a] || 0;
    const sizeB = sizeCache[b] || 0;
    return sizeB - sizeA; // 큰 파일 우선
  });
};

/**
 * 중복 파일 제거
 * @param {Array<string>} files 파일 경로 배열
 * @returns {Array<string>} 중복이 제거된 파일 배열
 */
export const removeDuplicates = (files) => {
  const uniqueFiles = [...new Set(files)];
  if (uniqueFiles.length !== files.length) {
    console.warn(`중복 파일 제거: ${files.length} -> ${uniqueFiles.length}`);
  }
  return uniqueFiles;
};

/**
 * 파일 정렬 통합 함수
 * @param {Array<string>} files 정렬할 파일 경로 배열
 * @param {string} sortBy 정렬 기준 ('name', 'type', 'date', 'size')
 * @param {Object} api 파일 메타데이터 접근용 API 객체
 * @returns {Promise<Array<string>>} 정렬된 파일 배열
 */
export const sortFiles = async (files, sortBy, api) => {
  // 중복 제거
  const uniqueFiles = removeDuplicates(files);
  
  try {
    // 정렬 방식에 따라 처리
    if (sortBy === 'name') {
      return sortByName(uniqueFiles);
    } 
    else if (sortBy === 'type') {
      return sortByType(uniqueFiles);
    }
    else if (sortBy === 'date') {
      const dateCache = await getFileDates(uniqueFiles, api);
      return sortByDate(uniqueFiles, dateCache);
    }
    else if (sortBy === 'size') {
      const sizeCache = await getFileSizes(uniqueFiles, api);
      return sortBySize(uniqueFiles, sizeCache);
    }
    
    // 지원하지 않는 정렬 방식
    console.warn(`지원하지 않는 정렬 방식: ${sortBy}`);
    return uniqueFiles;
  } catch (error) {
    console.error('파일 정렬 중 오류 발생:', error);
    return uniqueFiles; // 오류 발생 시 원본 반환
  }
}; 