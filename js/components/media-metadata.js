/**
 * 미디어 메타데이터 처리 컴포넌트
 * 이미지, 비디오 파일의 메타데이터를 로드하고 관리합니다.
 */

import State from '../core/state.js';

/**
 * 미디어 파일 메타데이터 로드
 * @param {Array} files - 파일 경로 배열
 */
export async function loadMediaMetadata(files) {
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
    document.dispatchEvent(new CustomEvent('preview-update'));
} 