/**
 * RENAMER 앱의 업데이트 관리 모듈
 * 이 모듈은 GitHub API를 직접 사용하여 앱의 최신 버전을 확인하고 업데이트를 관리합니다.
 */

const { app, dialog } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

// 기본 환경 설정
let mainWindow = null;
let autoUpdater = null; // 호환성을 위해 유지
let electronLog = null;

// 업데이트 알림 상태 관리
let isCheckingForUpdates = false; // 업데이트 확인 중 플래그
let isUpdateDialogOpen = false; // 업데이트 대화상자 표시 중 플래그
let lastUpdateCheckTime = 0; // 마지막 업데이트 확인 시간
const UPDATE_CHECK_THROTTLE = 5000; // 업데이트 확인 간격 제한 (5초)

// GitHub 저장소 정보
const GITHUB_INFO = {
    owner: 'HEIMLICH-STUDIO',
    repo: 'HMLH-RENAMER',
    apiUrl: 'https://api.github.com/repos/HEIMLICH-STUDIO/HMLH-RENAMER/releases'
};

// 업데이트 관리자 초기화
exports.initUpdater = (window, updater, logger) => {
    console.log('[UPDATER] Initializing custom updater');
    mainWindow = window;
    autoUpdater = updater; // 호환성을 위해 유지
    electronLog = logger;

    // electron-updater가 있는 경우 이벤트 연결 (호환성 유지)
    if (autoUpdater && autoUpdater.on) {
        console.log('[UPDATER] Connecting electron-updater events for compatibility');
        setupAutoUpdaterEvents();
    }
};

// 자동 업데이트 이벤트 설정 (호환성을 위해 유지)
function setupAutoUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
        console.log('[UPDATER] Electron updater checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[UPDATER] Electron updater found update:', info);
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('[UPDATER] Electron updater: no update available');
    });

    autoUpdater.on('error', (err) => {
        console.error('[UPDATER] Electron updater error:', err);
        // 오류는 무시 - 기본 구현으로 대체
    });

    autoUpdater.on('download-progress', (progressObj) => {
        console.log('[UPDATER] Download progress:', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[UPDATER] Update downloaded:', info);
    });
}

// 창으로 업데이트 상태 전송
function sendStatusToWindow(text) {
    console.log(`[UPDATER] Sending status to window: "${text}"`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', text);
    }
}

// 현재 및 최신 버전 정보 전송
function sendUpdateInfo(currentVersion, latestVersion) {
    console.log(`[UPDATER] Sending version info: current=${currentVersion}, latest=${latestVersion}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-versions', { currentVersion, latestVersion });
    }
}

// 다운로드 진행 상태 전송
function sendDownloadProgress(progressPercent) {
    console.log(`[UPDATER] Download progress: ${progressPercent.toFixed(2)}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progressPercent);
    }
}

// 업데이트 확인 처리
exports.handleUpdateCheck = (event) => {
    console.log('[UPDATER] Received check-for-updates request');

    try {
        // 너무 빈번한 업데이트 체크 방지
        const now = Date.now();
        if (now - lastUpdateCheckTime < UPDATE_CHECK_THROTTLE) {
            console.log('[UPDATER] Update check throttled, too frequent');
            event.returnValue = { success: false, message: 'Too frequent update checks.' };
            sendStatusToWindow('Please wait before checking for updates again.');
            return;
        }

        // 이미 업데이트 확인 중인 경우 중복 실행 방지
        if (isCheckingForUpdates) {
            console.log('[UPDATER] Update check already in progress');
            event.returnValue = { success: false, message: 'Update check already in progress.' };
            sendStatusToWindow('Update check in progress. Please wait...');
            return;
        }

        // 이미 업데이트 대화상자가 열려있는 경우 중복 표시 방지
        if (isUpdateDialogOpen) {
            console.log('[UPDATER] Update dialog is already open');
            event.returnValue = { success: false, message: 'Update dialog already open.' };
            sendStatusToWindow('Update dialog is already open.');
            return;
        }

        // 업데이트 확인 상태 설정
        isCheckingForUpdates = true;
        lastUpdateCheckTime = now;

        // 먼저 결과 값을 설정하여 UI가 응답하도록 함
        event.returnValue = { success: true, message: 'Update check started.' };

        // 현재 앱 버전 확인
        const currentVersion = app.getVersion();
        console.log('[UPDATER] Current app version:', currentVersion);

        // 상태 메시지 업데이트
        sendStatusToWindow('Checking for update...');

        // GitHub API를 사용하여 최신 버전 확인
        checkLatestReleaseFromGitHub(currentVersion)
            .finally(() => {
                // 업데이트 체크 완료 후 상태 초기화
                isCheckingForUpdates = false;
            });
    } catch (error) {
        console.error('[UPDATER] Error in check-for-updates handler:', error);
        event.returnValue = { success: false, message: `Error: ${error.message}` };
        sendStatusToWindow(`Update check failed: ${error.message}`);
        isCheckingForUpdates = false;
    }
};

// GitHub API를 사용하여 최신 릴리스 확인
async function checkLatestReleaseFromGitHub(currentVersion) {
    console.log('[UPDATER] Checking latest release from GitHub API');

    try {
        // 최신 릴리스 정보 가져오기
        const releaseInfo = await getLatestRelease();

        if (!releaseInfo) {
            console.log('[UPDATER] No release information found');
            sendStatusToWindow('No release information found. You may be using the latest version.');
            sendUpdateInfo(currentVersion, null);
            return;
        }

        console.log('[UPDATER] Latest release:', releaseInfo);

        // 버전 정보 추출
        const latestVersion = releaseInfo.tag_name.startsWith('v') ?
            releaseInfo.tag_name.substring(1) :
            releaseInfo.tag_name;

        console.log(`[UPDATER] Current: ${currentVersion}, Latest: ${latestVersion}`);

        // 버전 비교
        const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

        if (updateAvailable) {
            console.log('[UPDATER] Update available!');
            sendStatusToWindow(`Update available: ${latestVersion}`);
            sendUpdateInfo(currentVersion, latestVersion);

            // 새로운 코드: 메인 윈도우에 업데이트 가능 알림 전송
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-available', {
                    currentVersion,
                    latestVersion,
                    releaseInfo
                });
            }

            // 업데이트 확인 및 대화상자 표시 간격 설정
            if (!isUpdateDialogOpen) {
                // 사용자에게 업데이트 안내
                showUpdateAvailableDialog(releaseInfo, latestVersion, currentVersion);
            }
        } else {
            console.log('[UPDATER] No update available');
            sendStatusToWindow('You are using the latest version!');
            sendUpdateInfo(currentVersion, latestVersion);
        }
    } catch (error) {
        console.error('[UPDATER] Error checking for updates:', error);
        sendStatusToWindow(`Update check failed: ${error.message}`);
        sendUpdateInfo(currentVersion, null);
    }
}

// GitHub API에서 최신 릴리스 정보 가져오기
function getLatestRelease() {
    return new Promise((resolve, reject) => {
        const apiUrl = `${GITHUB_INFO.apiUrl}/latest`;
        console.log('[UPDATER] Fetching latest release info from:', apiUrl);

        const options = {
            headers: {
                'User-Agent': 'HMLH-RENAMER-Updater',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout: 10000
        };

        const req = https.get(apiUrl, options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const releaseInfo = JSON.parse(data);
                        console.log('[UPDATER] Successfully fetched release info');
                        resolve(releaseInfo);
                    } else if (res.statusCode === 404) {
                        console.log('[UPDATER] No releases found, checking all releases');
                        // 특정 릴리스가 없을 경우 모든 릴리스 확인
                        getAllReleases().then(resolve).catch(reject);
                    } else {
                        console.error(`[UPDATER] GitHub API error: ${res.statusCode}`, data);
                        reject(new Error(`GitHub API error: ${res.statusCode}`));
                    }
                } catch (error) {
                    console.error('[UPDATER] Error parsing release data:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('[UPDATER] Network error:', error);
            reject(error);
        });

        req.on('timeout', () => {
            console.error('[UPDATER] Request timeout');
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// 모든 릴리스 가져오기 (최신 릴리스가 없는 경우 대체)
function getAllReleases() {
    return new Promise((resolve, reject) => {
        const apiUrl = GITHUB_INFO.apiUrl;
        console.log('[UPDATER] Fetching all releases from:', apiUrl);

        const options = {
            headers: {
                'User-Agent': 'HMLH-RENAMER-Updater',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout: 10000
        };

        const req = https.get(apiUrl, options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const releases = JSON.parse(data);

                        if (releases && releases.length > 0) {
                            console.log('[UPDATER] Found releases:', releases.length);
                            // 가장 최신 릴리스 반환
                            resolve(releases[0]);
                        } else {
                            console.log('[UPDATER] No releases found');
                            resolve(null);
                        }
                    } else {
                        console.error(`[UPDATER] GitHub API error: ${res.statusCode}`, data);
                        reject(new Error(`GitHub API error: ${res.statusCode}`));
                    }
                } catch (error) {
                    console.error('[UPDATER] Error parsing releases data:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('[UPDATER] Network error:', error);
            reject(error);
        });

        req.on('timeout', () => {
            console.error('[UPDATER] Request timeout');
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// 업데이트 가능 대화상자 표시
function showUpdateAvailableDialog(releaseInfo, latestVersion, currentVersion) {
    // 대화상자 표시 중 플래그 설정
    isUpdateDialogOpen = true;

    // 플랫폼에 맞는 다운로드 URL 찾기
    const platform = process.platform;
    const arch = process.arch;
    const assets = releaseInfo.assets || [];

    console.log('[UPDATER] Looking for assets matching platform:', platform, arch);
    console.log('[UPDATER] Available assets:', assets.map(a => a.name).join(', '));

    // 플랫폼에 맞는 자산 찾기
    let matchingAsset = null;

    if (platform === 'win32') {
        // Windows 인스톨러 찾기
        matchingAsset = assets.find(asset =>
            asset.name.endsWith('.exe') ||
            asset.name.includes('Setup') ||
            asset.name.includes('setup') ||
            asset.name.includes('windows') ||
            asset.name.includes('win')
        );
    } else if (platform === 'darwin') {
        // macOS 인스톨러 찾기
        const archSuffix = arch === 'arm64' ? 'arm64' : 'x64';
        matchingAsset = assets.find(asset =>
            asset.name.endsWith('.dmg') ||
            asset.name.includes('mac') ||
            asset.name.includes('darwin') ||
            asset.name.includes(archSuffix)
        );
    } else if (platform === 'linux') {
        // Linux 인스톨러 찾기
        matchingAsset = assets.find(asset =>
            asset.name.endsWith('.AppImage') ||
            asset.name.endsWith('.deb') ||
            asset.name.includes('linux')
        );
    }

    let releaseNotes = '';
    if (releaseInfo.body) {
        // 릴리스 노트에서 처음 500자만 표시 (너무 길지 않게)
        releaseNotes = releaseInfo.body.substring(0, 500);
        if (releaseInfo.body.length > 500) {
            releaseNotes += '... (more)';
        }
    }

    // 대화상자 옵션 준비
    const dialogOptions = {
        type: 'info',
        title: 'Update Available',
        message: `New version ${latestVersion} is available (you have ${currentVersion})`,
        buttons: ['Download & Install', 'Later', 'Skip This Update'],
        defaultId: 0,
        cancelId: 1
    };

    if (matchingAsset) {
        console.log('[UPDATER] Found matching asset:', matchingAsset.name);

        // 다운로드 링크가 있는 대화상자 표시
        dialogOptions.detail = `Changes:\n${releaseNotes}\n\nWould you like to download and install this update?`;

        dialog.showMessageBox(dialogOptions).then(({ response }) => {
            // 대화상자 종료 플래그 설정
            isUpdateDialogOpen = false;

            if (response === 0) {
                // 앱 내에서 업데이트 다운로드 및 설치 시작
                downloadAndInstallUpdate(matchingAsset);
            } else if (response === 2) {
                // 업데이트 건너뛰기 선택
                console.log('[UPDATER] User opted to skip the update');
                sendStatusToWindow('Update skipped. Continuing with current version.');
            }
        }).catch(err => {
            console.error('[UPDATER] Dialog error:', err);
            isUpdateDialogOpen = false;
        });
    } else {
        console.log('[UPDATER] No matching asset found, showing generic update dialog');

        // 직접 다운로드 링크가 없는 경우 릴리스 페이지로 이동
        dialogOptions.detail = `Changes:\n${releaseNotes}\n\nNo automatic installer found. Would you like to visit the download page?`;
        dialogOptions.buttons = ['Open Download Page', 'Later', 'Skip This Update'];

        dialog.showMessageBox(dialogOptions).then(({ response }) => {
            // 대화상자 종료 플래그 설정
            isUpdateDialogOpen = false;

            if (response === 0) {
                require('electron').shell.openExternal(releaseInfo.html_url);
            } else if (response === 2) {
                // 업데이트 건너뛰기 선택
                console.log('[UPDATER] User opted to skip the update');
                sendStatusToWindow('Update skipped. Continuing with current version.');
            }
        }).catch(err => {
            console.error('[UPDATER] Dialog error:', err);
            isUpdateDialogOpen = false;
        });
    }
}

// 업데이트 다운로드 및 설치 함수
function downloadAndInstallUpdate(asset) {
    try {
        console.log('[UPDATER] Starting download of update:', asset.name);
        sendStatusToWindow('Downloading update...');

        // 앱 데이터 디렉토리에 다운로드 폴더 생성
        const downloadDir = path.join(app.getPath('userData'), 'updates');
        if (!fs.existsSync(downloadDir)) {
            try {
                fs.mkdirSync(downloadDir, { recursive: true });
            } catch (err) {
                console.error('[UPDATER] Error creating download directory:', err);
                sendStatusToWindow('Unable to create download directory. Update skipped.');
                isUpdateDialogOpen = false; // 대화상자 상태 초기화
                return; // 오류 발생 시 업데이트 건너뛰기
            }
        }

        // 다운로드할 파일 경로
        const installerPath = path.join(downloadDir, asset.name);

        // 이전 다운로드 파일이 있으면 삭제
        if (fs.existsSync(installerPath)) {
            try {
                fs.unlinkSync(installerPath);
            } catch (err) {
                console.error('[UPDATER] Error removing previous installer:', err);
                // 파일 삭제 실패해도 계속 진행 - 새 파일로 덮어쓸 시도
            }
        }

        // 파일 다운로드
        let file;
        try {
            file = fs.createWriteStream(installerPath);
        } catch (err) {
            console.error('[UPDATER] Error creating write stream:', err);
            sendStatusToWindow(`Could not prepare for download: ${err.message}. Update skipped.`);
            isUpdateDialogOpen = false;
            return; // 오류 발생 시 업데이트 건너뛰기
        }

        console.log('[UPDATER] Downloading from URL:', asset.browser_download_url);

        // 리다이렉션을 처리하는 함수
        const downloadWithRedirects = (url) => {
            console.log('[UPDATER] Requesting:', url);

            // URL 파싱하여 요청 옵션 생성
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                headers: {
                    'User-Agent': 'HMLH-RENAMER-Updater',
                    'Accept': 'application/octet-stream'
                },
                timeout: 30000
            };

            https.get(options, (response) => {
                // 리다이렉션 응답 처리 (301, 302, 303, 307, 308)
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.log(`[UPDATER] Redirect to: ${response.headers.location}`);

                    // 응답 정리
                    response.resume();

                    // 리다이렉션 URL로 다시 요청
                    return downloadWithRedirects(response.headers.location);
                }

                if (response.statusCode !== 200) {
                    file.close();
                    try {
                        fs.unlinkSync(installerPath);
                    } catch (err) {
                        console.error('[UPDATER] Error removing failed download:', err);
                    }
                    sendStatusToWindow(`Download failed: Server returned ${response.statusCode}. Update skipped.`);
                    console.error(`[UPDATER] Download failed: Server returned ${response.statusCode}`);
                    isUpdateDialogOpen = false;
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    try {
                        file.write(chunk);
                        downloadedSize += chunk.length;

                        // 진행률 계산 및 표시
                        if (totalSize) {
                            const percent = (downloadedSize / totalSize) * 100;
                            sendDownloadProgress(percent);
                        }
                    } catch (err) {
                        console.error('[UPDATER] Error writing download chunk:', err);
                        // 에러가 발생해도 다운로드 계속 시도
                    }
                });

                response.on('end', () => {
                    try {
                        file.end();
                        sendStatusToWindow('Download complete. Preparing to install...');
                        console.log('[UPDATER] Download complete:', installerPath);

                        // 다운로드 완료 후 확인 대화상자 표시
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Ready to Install',
                            message: 'Update downloaded successfully',
                            detail: 'The application will close and the update will be installed.',
                            buttons: ['Install Now', 'Later', 'Skip Update'],
                            defaultId: 0,
                            cancelId: 2
                        }).then(({ response }) => {
                            if (response === 0) {
                                // 업데이트 설치 시도
                                try {
                                    installUpdate(installerPath);
                                } catch (err) {
                                    console.error('[UPDATER] Install error:', err);
                                    dialog.showMessageBox({
                                        type: 'error',
                                        title: 'Installation Failed',
                                        message: 'Failed to install update',
                                        detail: `Error: ${err.message}\n\nYou can continue using the current version.`,
                                        buttons: ['OK'],
                                        defaultId: 0
                                    });
                                    isUpdateDialogOpen = false;
                                }
                            } else if (response === 1) {
                                sendStatusToWindow('Update installation postponed. Will install on next restart.');
                                isUpdateDialogOpen = false;
                            } else {
                                sendStatusToWindow('Update skipped. Continuing with current version.');
                                isUpdateDialogOpen = false;
                                try {
                                    fs.unlinkSync(installerPath); // 다운로드한 파일 삭제
                                } catch (err) {
                                    console.error('[UPDATER] Error removing skipped update:', err);
                                }
                            }
                        }).catch(err => {
                            console.error('[UPDATER] Dialog error:', err);
                            isUpdateDialogOpen = false;
                        });
                    } catch (err) {
                        console.error('[UPDATER] Error finishing download:', err);
                        sendStatusToWindow(`Download could not be completed. Update skipped.`);
                        isUpdateDialogOpen = false;
                    }
                });
            }).on('error', (err) => {
                console.error('[UPDATER] Download error:', err);
                try {
                    file.close();
                } catch (closeErr) {
                    console.error('[UPDATER] Error closing file:', closeErr);
                }

                try {
                    if (fs.existsSync(installerPath)) {
                        fs.unlinkSync(installerPath);
                    }
                } catch (unlinkErr) {
                    console.error('[UPDATER] Error removing file after download error:', unlinkErr);
                }

                sendStatusToWindow(`Download failed: ${err.message}. Update skipped.`);
                isUpdateDialogOpen = false;
            });
        };

        // 다운로드 시작
        downloadWithRedirects(asset.browser_download_url);
    } catch (error) {
        console.error('[UPDATER] Error in download process:', error);
        sendStatusToWindow(`Update download failed: ${error.message}. Continuing with current version.`);
        isUpdateDialogOpen = false;
    }
}

// 플랫폼별 업데이트 설치 구현
function installUpdate(installerPath) {
    try {
        console.log('[UPDATER] Installing update from:', installerPath);
        sendStatusToWindow('Installing update...');

        const platform = process.platform;

        if (platform === 'win32') {
            // Windows: 설치 프로그램 실행 후 앱 종료
            console.log('[UPDATER] Running Windows installer');

            // 별도의 프로세스로 인스톨러 실행
            spawn(installerPath, ['--updated'], {
                detached: true,
                stdio: 'ignore'
            }).unref();

            // 앱 종료
            app.quit();
        } else if (platform === 'darwin') {
            // macOS: DMG 마운트 또는 pkg 실행
            console.log('[UPDATER] Running macOS installer');

            if (installerPath.endsWith('.dmg')) {
                // DMG 파일 마운트 및 앱 복사 명령
                const mountProcess = spawn('open', [installerPath], {
                    detached: true,
                    stdio: 'ignore'
                });
                mountProcess.unref();

                // 사용자에게 안내 메시지 표시
                dialog.showMessageBox({
                    type: 'info',
                    title: 'DMG Mounted',
                    message: 'Please complete the installation manually',
                    detail: 'The DMG file has been opened. Please drag the application to the Applications folder to complete the installation.',
                    buttons: ['OK'],
                    defaultId: 0
                }).then(() => {
                    app.quit();
                });
            } else if (installerPath.endsWith('.pkg')) {
                // PKG 설치 프로그램 실행
                spawn('open', [installerPath], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
                app.quit();
            }
        } else if (platform === 'linux') {
            // Linux: .deb 또는 AppImage 처리
            console.log('[UPDATER] Running Linux installer');

            if (installerPath.endsWith('.deb')) {
                // Debian 패키지 설치
                spawn('gdebi', [installerPath], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            } else if (installerPath.endsWith('.AppImage')) {
                // AppImage에 실행 권한 부여 후 실행
                fs.chmodSync(installerPath, '755');
                spawn(installerPath, [], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            }

            app.quit();
        }
    } catch (error) {
        console.error('[UPDATER] Error installing update:', error);
        sendStatusToWindow(`Installation failed: ${error.message}`);

        // 오류 발생 시 사용자에게 알림
        dialog.showMessageBox({
            type: 'error',
            title: 'Installation Failed',
            message: 'Failed to install update',
            detail: `Error: ${error.message}\n\nPlease try downloading and installing manually.`,
            buttons: ['OK'],
            defaultId: 0
        });
    }
}

// 버전 비교 함수
function compareVersions(v1, v2) {
    try {
        // undefined/null 체크
        if (!v1) return -1;
        if (!v2) return 1;

        // v 접두사 제거
        if (v1.startsWith('v')) v1 = v1.substring(1);
        if (v2.startsWith('v')) v2 = v2.substring(1);

        // 버전 세그먼트로 분리
        const parts1 = v1.split('.').map(p => {
            const num = parseInt(p, 10);
            return isNaN(num) ? 0 : num;
        });

        const parts2 = v2.split('.').map(p => {
            const num = parseInt(p, 10);
            return isNaN(num) ? 0 : num;
        });

        // 세그먼트 수 맞추기
        while (parts1.length < parts2.length) parts1.push(0);
        while (parts2.length < parts1.length) parts2.push(0);

        // 세그먼트별 비교
        for (let i = 0; i < parts1.length; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }

        return 0; // 버전이 같음
    } catch (error) {
        console.error('[UPDATER] Error comparing versions:', error);
        return 0; // 오류 시 같은 버전으로 처리
    }
}

// 자동 업데이트 확인 실행
exports.checkForUpdatesOnStartup = () => {
    if (app.isPackaged) {
        console.log('[UPDATER] Checking for updates on app start (production mode)');
        setTimeout(() => {
            try {
                // 이미 업데이트 확인 중인 경우 방지
                if (isCheckingForUpdates || isUpdateDialogOpen) {
                    console.log('[UPDATER] Startup update check skipped - already checking or dialog open');
                    return;
                }

                // 상태 업데이트
                isCheckingForUpdates = true;
                lastUpdateCheckTime = Date.now();

                // 현재 앱 버전 확인
                const currentVersion = app.getVersion();

                // GitHub API를 통해 직접 확인 시도
                checkLatestReleaseFromGitHub(currentVersion)
                    .catch(error => {
                        // 오류 발생 시 로그 기록 후 계속 진행
                        console.error('[UPDATER] Error during startup update check:', error);
                    })
                    .finally(() => {
                        isCheckingForUpdates = false;
                    });
            } catch (error) {
                console.error('[UPDATER] Error checking for updates on startup:', error);
                isCheckingForUpdates = false;
            }
        }, 3000); // 앱 시작 후 3초 후에 확인
    } else {
        console.log('[UPDATER] Update checks disabled in development mode');

        // 개발 모드에서는 버전 정보만 로깅
        console.log('[UPDATER-DEV] Current version:', app.getVersion());
    }
};

// 앱 버전 가져오기
exports.getAppVersion = () => {
    return app.getVersion();
};