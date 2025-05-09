/**
 * 표현식 방식 이름 변경 모듈
 * JavaScript 표현식 기반 파일명 변환 기능을 제공합니다.
 */

import { showToast } from '../utils/toast.js';

/**
 * 비디오 시간을 HH:MM:SS 형식으로 변환
 * @param {number} seconds - 초 단위 시간
 * @returns {string} HH:MM:SS 형식 문자열
 */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00:00";
  
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}

/**
 * 표현식을 주어진 컨텍스트와 함께 평가
 * @param {string} expression - JavaScript 표현식
 * @param {Object} context - 평가 컨텍스트 객체
 * @returns {string} 평가 결과
 */
function evalWithContext(expression, context) {
  try {
    // 컨텍스트 변수를 함수 파라미터로 설정
    const contextKeys = Object.keys(context);
    const contextValues = contextKeys.map(key => context[key]);
    
    // 함수 생성 및 호출
    const func = new Function(...contextKeys, `return ${expression};`);
    const result = func(...contextValues);
    
    console.log('Expression result:', result);
    
    // 문자열이 아닌 경우 문자열로 변환
    return result !== null && result !== undefined ? String(result) : '';
  } catch (error) {
    console.error('Error evaluating expression:', error);
    
    // 사용자에게 더 유용한 에러 메시지 제공
    if (error.message.includes("Unexpected token 'if'")) {
      throw new Error("'if' is a reserved keyword. Use cond(condition, trueValue, falseValue) or try the ternary operator: condition ? trueValue : falseValue");
    }
    
    throw error;
  }
}

/**
 * 표현식 방식으로 새 파일 이름 생성
 * @param {string} baseName - 확장자 없는 파일 이름
 * @param {string} fileExt - 파일 확장자 (점 포함)
 * @param {string} fileName - 전체 파일 이름
 * @param {string} filePath - 파일 경로
 * @param {number} index - 파일 인덱스
 * @param {string} expression - JavaScript 표현식
 * @param {Object} metaData - 미디어 메타데이터 (선택적)
 * @returns {Promise<string>} 새 파일 이름
 */
async function applyExpression(baseName, fileExt, fileName, filePath, index, expression, metaData = null) {
  try {
    // 기본 표현식 사용
    const expressionToUse = expression || 'name + "_" + padnum(index + 1, 3) + "." + fileext';
    
    console.log(`Evaluating expression: ${expressionToUse}`);
    
    // if 키워드 사용 오류 검사
    if (expressionToUse.includes(' if(') || expressionToUse.includes(' if (')) {
      throw new Error("'if' is a reserved keyword. Use cond(condition, trueValue, falseValue) instead.");
    }
    
    // 미디어 파일 타입 확인
    let isImage = metaData ? metaData.isImage : /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath);
    let isVideo = metaData ? metaData.isVideo : /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(filePath);
    
    // 미디어 크기 정보 초기화
    let width = metaData ? metaData.width : 0;
    let height = metaData ? metaData.height : 0;
    let duration = metaData ? metaData.duration : 0;
    let frames = metaData ? metaData.frames : 0;
    let colorspace = metaData ? metaData.colorspace : 'unknown';
    let colorTransfer = metaData ? metaData.color_transfer : 'unknown';
    let codec = metaData ? metaData.codec : 'unknown';
    let bitDepth = metaData ? metaData.bit_depth : 'unknown';
    let chromaSubsampling = metaData ? metaData.chroma_subsampling : 'unknown';
    let scanType = metaData ? metaData.scan_type : 'unknown';
    let bitrate = metaData ? metaData.bitrate : 'unknown';
    let pixelFormat = metaData ? metaData.pixel_format : 'unknown';
    let date = metaData && metaData.date ? metaData.date : new Date().toISOString().split('T')[0];
    
    // 표현식 평가를 위한 컨텍스트 생성
    const context = {
      name: baseName,
      fileext: fileExt.replace('.', ''),
      fullname: fileName,
      path: filePath,
      index: index,
      date: date,
      // 이미지/비디오 정보
      width: width,
      height: height,
      duration: duration,
      isImage: isImage,
      isVideo: isVideo,
      frames: frames,
      colorspace: colorspace,
      log: colorTransfer,
      codec: codec,
      bitDepth: bitDepth,
      chromaSubsampling: chromaSubsampling,
      scanType: scanType,
      bitrate: bitrate,
      pixelFormat: pixelFormat,
      // 헬퍼 함수들
      padnum: (num, length) => num.toString().padStart(length, '0'),
      upper: (str) => str.toUpperCase(),
      lower: (str) => str.toLowerCase(),
      substr: (str, start, length) => str.substr(start, length),
      formatTime: formatTime,
      // if 대신 cond 함수 사용
      cond: (condition, trueValue, falseValue) => condition ? trueValue : falseValue
    };
    
    console.log('Expression context:', context);
    
    // 표현식 평가
    let result = evalWithContext(expressionToUse, context);
    
    // 파일 확장자가 결과에 없고 원본 파일에 확장자가 있었으면 추가
    if (fileExt && !result.includes(fileExt)) {
      result += fileExt;
    }
    
    console.log(`Final expression result: ${result}`);
    return result;
  } catch (error) {
    console.error('Expression error:', error);
    showToast(`Expression error: ${error.message}`, 'error');
    // 오류 발생 시 원본 파일명 반환
    return fileName;
  }
}

export { applyExpression, formatTime }; 