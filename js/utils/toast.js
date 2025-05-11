/**
 * 토스트 알림 모듈
 * 시각적 알림 기능을 제공합니다.
 */

import State from '../core/state.js';

// 토스트 타임아웃 관리
let toastTimeout = null;

/**
 * 애니메이션과 함께 토스트 닫기
 * @param {HTMLElement} toast - 토스트 요소
 */
function closeToastWithAnimation(toast) {
  toast.classList.add('toast-hiding');
  
  // 애니메이션 완료 후 제거
  toast.addEventListener('animationend', () => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  });
}

/**
 * 토스트 타이머 시작
 * @param {HTMLElement} toast - 토스트 요소
 */
function startToastTimer(toast) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  toastTimeout = setTimeout(() => {
    closeToastWithAnimation(toast);
  }, 5000);
}

/**
 * 업데이트 알림 토스트 표시
 * @param {string} currentVersion - 현재 버전
 * @param {string} latestVersion - 최신 버전
 */
function showUpdateToast(currentVersion, latestVersion) {
  // 기존 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }

  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.innerHTML = `
    <div class="toast-content">
      <span>New version ${latestVersion} is available! (you have ${currentVersion})</span>
      <button class="toast-details">Update</button>
      <button class="toast-close">&times;</button>
    </div>
  `;
  
  // 토스트 마우스 이벤트 - 호버 시 자동 닫힘 방지
  let isToastHovered = false;
  
  toast.addEventListener('mouseenter', () => {
    isToastHovered = true;
    // 기존 타임아웃 제거
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  });
  
  toast.addEventListener('mouseleave', () => {
    isToastHovered = false;
    // 마우스가 떠나면 새 타이머 설정
    // 업데이트 알림은 더 오래 표시
    toastTimeout = setTimeout(() => {
      closeToastWithAnimation(toast);
    }, 10000); // 10초 동안 표시
  });
  
  // 닫기 버튼 이벤트
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    closeToastWithAnimation(toast);
  });
  
  // 자세히 보기 버튼 이벤트
  const detailsBtn = toast.querySelector('.toast-details');
  detailsBtn.addEventListener('click', () => {
    closeToastWithAnimation(toast);
    
    // About 모달 열기
    const aboutModal = document.getElementById('aboutModal');
    if (aboutModal) {
      aboutModal.classList.remove('hidden');
      
      // 업데이트 확인 트리거 (timeout으로 약간 지연시켜 모달이 먼저 표시되도록 함)
      setTimeout(() => {
        if (window && window.api && window.api.checkForUpdates) {
          window.api.checkForUpdates();
        }
      }, 500);
    }
  });
  
  // 문서에 추가
  document.body.appendChild(toast);
  
  // 자동 닫기 타이머 시작 (업데이트 알림은 더 오래 표시)
  toastTimeout = setTimeout(() => {
    closeToastWithAnimation(toast);
  }, 10000);
}

/**
 * 자세히 보기 버튼이 있는 토스트 표시
 * @param {string} message - 표시할 메시지
 * @param {string} type - 토스트 타입 ('info', 'success', 'error')
 * @param {boolean} showViewDetailsButton - View Details 버튼을 표시할지 여부
 * @param {string} detailsButtonText - 자세히 보기 버튼 텍스트 (기본: 'Details')
 */
function showToastWithDetails(message, type = 'info', showViewDetailsButton = false, detailsButtonText = 'Details') {
  // 기존 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }

  // 버튼 텍스트 설정
  const buttonText = showViewDetailsButton ? 'View Details' : detailsButtonText;

  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
      <button class="toast-details">${buttonText}</button>
      <button class="toast-close">&times;</button>
    </div>
  `;
  
  // 토스트 마우스 이벤트 - 호버 시 자동 닫힘 방지
  let isToastHovered = false;
  
  toast.addEventListener('mouseenter', () => {
    isToastHovered = true;
    // 기존 타임아웃 제거
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  });
  
  toast.addEventListener('mouseleave', () => {
    isToastHovered = false;
    // 마우스가 떠나면 새 타이머 설정
    startToastTimer(toast);
  });
  
  // 닫기 버튼 이벤트
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    closeToastWithAnimation(toast);
  });
  
  // 자세히 보기 버튼 이벤트
  const detailsBtn = toast.querySelector('.toast-details');
  detailsBtn.addEventListener('click', () => {
    if (State.lastRenameResults) {
      // 결과 표시 기능은 외부에서 이벤트로 처리
      const event = new CustomEvent('show-rename-results', {
        detail: State.lastRenameResults
      });
      document.dispatchEvent(event);
    }
    closeToastWithAnimation(toast);
  });
  
  // 문서에 추가
  document.body.appendChild(toast);
  
  // 자동 닫기 타이머 시작
  startToastTimer(toast);
}

/**
 * 간단한 토스트 메시지 표시
 * @param {string} message - 표시할 메시지
 * @param {string} type - 토스트 타입 ('info', 'success', 'error')
 */
function showToast(message, type = 'info') {
  // 기존 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }
  
  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
      <button class="toast-close">&times;</button>
    </div>
  `;
  
  // 토스트 마우스 이벤트 - 호버 시 자동 닫힘 방지
  let isToastHovered = false;
  
  toast.addEventListener('mouseenter', () => {
    isToastHovered = true;
    // 기존 타임아웃 제거
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  });
  
  toast.addEventListener('mouseleave', () => {
    isToastHovered = false;
    // 마우스가 떠나면 새 타이머 설정
    startToastTimer(toast);
  });
  
  // 닫기 버튼 이벤트
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    closeToastWithAnimation(toast);
  });
  
  // 문서에 추가
  document.body.appendChild(toast);
  
  // 자동 닫기 타이머 시작
  startToastTimer(toast);
}

export { showToast, showToastWithDetails, showUpdateToast }; 