/**
 * 업데이트 컴포넌트
 * 애플리케이션 업데이트 기능을 관리합니다.
 */

import { showToast } from '../utils/toast.js';

/**
 * 업데이트 기능 초기화
 */
export function initializeUpdater() {
    console.log('Initializing updater...');
    
    // 앱 버전을 동기적으로 가져와서 바로 표시
    window.api.getAppVersion().then(version => {
        console.log(`Current app version: ${version}`);
        
        // 모든 버전 표시 엘리먼트에 버전 설정
        const versionElements = [
            document.getElementById('versionInfoBtn'),
            document.getElementById('appVersionDisplay'),
            document.getElementById('currentVersionDisplay'),
            document.getElementById('aboutAppVersionDisplay')
        ];
        
        versionElements.forEach(element => {
            if (element) {
                if (element.id === 'versionInfoBtn') {
                    element.textContent = `v${version}`;
                    
                    // 버전 정보 버튼에 클릭 이벤트 추가
                    element.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log('Version button clicked, opening About modal');
                        // About 모달 열기
                        document.getElementById('aboutModal').classList.remove('hidden');
                        // 업데이트 확인도 함께 실행
                        checkForUpdates();
                    });
                    
                    // 버튼 스타일 업데이트 - 항상 클릭 가능하도록
                    element.style.cursor = 'pointer';
                    element.classList.add('clickable');
                } else {
                    element.textContent = version;
                }
            }
        });
        
        // about 모달 버전 정보 업데이트
        const aboutVersionElement = document.querySelector('.about-version');
        if (aboutVersionElement) {
            aboutVersionElement.textContent = `Version ${version}`;
        }
    }).catch(error => {
        console.error('Failed to get app version:', error);
    });

    // About 모달 열기 버튼 설정
    const openAboutModalBtn = document.getElementById('openAboutModalBtn');
    if (openAboutModalBtn) {
        openAboutModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('aboutModal').classList.remove('hidden');
        });
    }

    // 업데이트 버튼 이벤트 리스너 등록
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        console.log('Found update button:', checkUpdatesBtn);
        checkUpdatesBtn.addEventListener('click', () => {
            console.log('Update button clicked, opening About modal');
            // About 모달 열기
            document.getElementById('aboutModal').classList.remove('hidden');
            // 업데이트 확인도 함께 실행
            checkForUpdates();
        });
    }
    
    const checkUpdatesBtn2 = document.getElementById('checkUpdatesBtn2');
    if (checkUpdatesBtn2) {
        console.log('Found second update button:', checkUpdatesBtn2);
        checkUpdatesBtn2.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Second update button clicked');
            checkForUpdates();
        });
    }

    // 중복 메시지 방지를 위한 변수 추가
    let lastUpdateMessage = '';
    let lastMessageTime = 0;

    // 업데이트 상태 리스너 등록
    window.api.onUpdateStatus((message) => {
        // 중복 메시지 방지 (동일한 메시지가 짧은 시간 내에 반복해서 오는 경우)
        const now = Date.now();
        const timeSinceLastMessage = now - lastMessageTime;
        
        if (message === lastUpdateMessage && timeSinceLastMessage < 1000) {
            console.log('Duplicate update message ignored:', message);
            return;
        }
        
        // 메시지 및 시간 업데이트
        lastUpdateMessage = message;
        lastMessageTime = now;
        
        console.log('Update status received:', message);
        updateStatusDisplay(message);
    });
    
    // 업데이트 버전 정보 리스너 등록
    window.api.onUpdateVersions((data) => {
        console.log('Update versions received:', data);
        updateVersionsDisplay(data.currentVersion, data.latestVersion);
    });
    
    // 업데이트 가능 알림 리스너 등록
    window.api.onUpdateAvailable((data) => {
        console.log('Update available notification received:', data);
        
        // 토스트 알림 표시
        import('../utils/toast.js').then(module => {
            // showUpdateToast 함수 호출
            module.showUpdateToast(data.currentVersion, data.latestVersion);
        }).catch(error => {
            console.error('Failed to import toast module:', error);
            // 모듈 로드 실패 시 기본 토스트 표시
            showToast(`New version ${data.latestVersion} is available!`, 'info');
        });
    });
    
    // 앱 시작 시 자동으로 업데이트 확인 트리거
    setTimeout(() => {
        console.log('Automatic startup update check...');
        checkForUpdates();
    }, 2000); // 앱 UI가 완전히 로딩된 후 2초 후에 업데이트 확인
}

/**
 * 수동으로 업데이트 확인
 */
export function checkForUpdates() {
    try {
        console.log('[DEBUG RENDERER] checkForUpdates called');
        
        // 업데이트 상태 메시지 표시
        updateStatusDisplay('Checking for updates...', 'info');
        
        // 업데이트 확인 API 호출 (동기적)
        const result = window.api.checkForUpdates();
        console.log('[DEBUG RENDERER] Update check initial result:', result);
        
        if (!result.success) {
            updateStatusDisplay(result.message, 'warning');
        }
        
        // 5초 후에도 여전히 "Update check started" 메시지가 표시되어 있다면 타임아웃으로 처리
        setTimeout(() => {
            const statusElement = document.getElementById('updateStatus');
            if (statusElement && statusElement.textContent === 'Update check started.') {
                console.log('[DEBUG RENDERER] Update check timed out');
                updateStatusDisplay('Update check timed out. Please try again.', 'error');
            }
        }, 5000);
    } catch (error) {
        console.error('[DEBUG RENDERER] Failed to check for updates:', error);
        updateStatusDisplay(`Update check failed: ${error.message}`, 'error');
    }
}

/**
 * 업데이트 상태 표시 업데이트
 * @param {string} message - 표시할 메시지
 * @param {string} type - 메시지 타입 (info, success, warning, error)
 */
export function updateStatusDisplay(message, type = '') {
    console.log('[DEBUG RENDERER] updateStatusDisplay called with message:', message, 'type:', type);
    
    // 모든 업데이트 상태 엘리먼트에 메시지 표시
    const statusElements = [
        document.getElementById('updateStatus'),
        document.getElementById('aboutUpdateStatus')
    ];
    
    console.log('[DEBUG RENDERER] Status elements found:', statusElements.map(el => el ? el.id : 'null').join(', '));
    
    statusElements.forEach(element => {
        if (element) {
            console.log(`[DEBUG RENDERER] Updating element ${element.id} with message: ${message}`);
            element.textContent = message;
            
            // 기존 클래스 제거
            element.classList.remove('info', 'success', 'warning', 'error');
            
            // 타입이 지정된 경우 클래스 추가
            if (type) {
                element.classList.add(type);
            }
            
            // 메시지가 없으면 감추기
            element.style.display = message ? 'block' : 'none';
            console.log(`[DEBUG RENDERER] Element ${element.id} updated, display: ${element.style.display}`);
        } else {
            console.log('[DEBUG RENDERER] Element is null or undefined');
        }
    });
}

/**
 * 버전 정보 표시 업데이트
 * @param {string} currentVersion - 현재 버전
 * @param {string} latestVersion - 최신 버전
 */
export function updateVersionsDisplay(currentVersion, latestVersion) {
    const latestVersionElements = [
        document.getElementById('latestVersionDisplay'),
        document.getElementById('aboutLatestVersionDisplay')
    ];
    
    latestVersionElements.forEach(element => {
        if (element) {
            element.textContent = latestVersion || 'Unknown';
        }
    });
    
    // 현재 버전과 최신 버전이 다를 경우 시각적으로 표시
    if (currentVersion && latestVersion && currentVersion !== latestVersion) {
        latestVersionElements.forEach(element => {
            if (element) {
                element.classList.add('update-available');
                element.title = 'New version available!';
            }
        });
    } else {
        latestVersionElements.forEach(element => {
            if (element) {
                element.classList.remove('update-available');
                element.title = '';
            }
        });
    }
} 