#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// === 사용자 설정 ===
const APP_PATH = path.join(__dirname, '..', 'dist', 'mac-arm64', 'RENAMER by HEIMLICH®.app');
const CERT_ID = '402600FA8B2EDE2E913E7382942BFCD60653A021'; // 인증서 SHA-1 해시 (이름 대신 사용)
const ENTITLEMENTS = path.join(__dirname, '..', 'entitlements.mac.plist');

// === 바이너리/실행파일 확장자 ===
const BIN_EXTS = ['.app', '', '.dylib', '.so', '.node'];

// === 재귀적으로 모든 바이너리/실행파일 경로 찾기 ===
function findBinaries(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.lstatSync(filePath);
        if (stat.isDirectory()) {
            // .app 번들 내부의 MacOS 실행파일
            if (file.endsWith('.app')) {
                const macosPath = path.join(filePath, 'Contents', 'MacOS');
                if (fs.existsSync(macosPath)) {
                    fs.readdirSync(macosPath).forEach(bin => {
                        results.push(path.join(macosPath, bin));
                    });
                }
            }
            results = results.concat(findBinaries(filePath));
        } else {
            // 실행 권한이 있거나, 확장자가 바이너리인 경우
            if (
                (stat.mode & 0o111) ||
                BIN_EXTS.some(ext => file.endsWith(ext))
            ) {
                results.push(filePath);
            }
        }
    });
    return results;
}

function signFile(file) {
    try {
        console.log(`서명 중: ${file}`);
        execSync(`codesign --sign ${CERT_ID} --force --deep --options runtime --timestamp --entitlements "${ENTITLEMENTS}" "${file}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ 서명 실패: ${file}`);
        if (e.stdout) console.error(e.stdout.toString());
        if (e.stderr) console.error(e.stderr.toString());
    }
}

function verifyApp(appPath) {
    try {
        execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });
        console.log('✅ codesign 검증 성공!');
    } catch (e) {
        console.error('❌ codesign 검증 실패!');
    }
}

function main() {
    if (!fs.existsSync(APP_PATH)) {
        console.error('앱 경로를 찾을 수 없습니다:', APP_PATH);
        process.exit(1);
    }
    console.log('앱 내부 바이너리/실행파일 탐색 중...');
    const binaries = findBinaries(APP_PATH);
    // 중복 제거
    const uniqueBinaries = [...new Set(binaries)];
    console.log(`총 ${uniqueBinaries.length}개 파일 서명 시도`);
    uniqueBinaries.forEach(signFile);
    // 앱 번들 자체도 서명
    signFile(APP_PATH);
    // 검증
    verifyApp(APP_PATH);
    console.log('\n모든 서명 작업이 완료되었습니다! 이제 공증을 다시 시도하세요.');
}

main();