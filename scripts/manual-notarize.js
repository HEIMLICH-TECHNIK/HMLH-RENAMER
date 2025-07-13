#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔐 RENAMER 앱 수동 공증 도구 🔐');
    console.log('--------------------------------');

    // 앱 경로 확인
    const distPath = path.join(__dirname, '..', 'dist');
    const macArmPath = path.join(distPath, 'mac-arm64');
    const appPath = path.join(macArmPath, 'RENAMER by HEIMLICH®.app');
    const zipPath = path.join(macArmPath, 'RENAMER.zip');

    if (!fs.existsSync(appPath)) {
        console.error('❌ 앱 파일을 찾을 수 없습니다. 먼저 빌드를 실행하세요.');
        process.exit(1);
    }

    console.log('✅ 앱 파일을 찾았습니다:', appPath);

    // 계정 정보 직접 설정
    const appleId = "zeonjiho@gmail.com"; // 애플 ID
    const password = "axxl-zeeq-rubx-cmme"; // 새로운 앱 특정 비밀번호
    const teamId = "L2FYLRHC4Z"; // 팀 ID
    const certId = "402600FA8B2EDE2E913E7382942BFCD60653A021"; // 인증서 SHA-1 해시

    try {
        // 코드 서명 시도 (앱 번들 및 내부 바이너리)
        console.log('\n추가 단계: 코드 서명 시도...');
        try {
            // 앱 내부 바이너리도 서명하기 위해 sign-all.js 실행
            console.log('모든 바이너리 서명 중 (sign-all.js)...');
            execSync(`node "${path.join(__dirname, 'sign-all.js')}"`, { stdio: 'inherit' });

            // 앱 번들 자체 서명 (최종 확인)
            console.log('앱 번들 최종 서명 중...');
            execSync(`codesign --sign ${certId} --force --deep --options runtime --timestamp --entitlements "${path.join(__dirname, '..', 'entitlements.mac.plist')}" "${appPath}"`, { stdio: 'inherit' });
            console.log('✅ 코드 서명 완료');

            // 코드 서명 검증
            console.log('코드 서명 검증 중...');
            execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });
            console.log('✅ 코드 서명 검증 완료');
        } catch (signError) {
            console.warn('⚠️ 코드 서명 문제 발생:', signError.message);
            console.warn('계속 진행합니다... 공증 과정에서 문제가 발생할 수 있습니다.');
        }

        // 1단계: 앱 압축
        console.log('\n1단계: 앱 파일 압축 중...');
        execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: 'inherit' });
        console.log('✅ 앱 압축 완료');

        // 2단계: 공증 제출
        console.log('\n2단계: 애플 공증 서비스에 앱 제출 중...');
        console.log(`애플 ID: ${appleId}`);
        console.log(`팀 ID: ${teamId}`);

        const submitResult = execSync(
            `xcrun notarytool submit "${zipPath}" --apple-id "${appleId}" --password "${password}" --team-id "${teamId}" --wait`, { encoding: 'utf8' }
        );

        console.log('✅ 공증 제출 결과:');
        console.log(submitResult);

        // 공증 결과에서 성공 여부 확인
        if (submitResult.includes('status: Accepted')) {
            // 3단계: 공증 결과 적용
            console.log('\n3단계: 공증 결과를 앱에 적용 중...');
            execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
            console.log('✅ 공증 결과 적용 완료');

            // 4단계: DMG 다시 생성
            console.log('\n4단계: DMG 파일 다시 생성 중...');
            execSync('cd .. && npm run build -- --mac', { stdio: 'inherit', cwd: macArmPath });
            console.log('✅ DMG 파일 생성 완료');

            console.log('\n🎉 모든 과정이 성공적으로 완료되었습니다!');
            console.log(`📦 최종 DMG 파일: ${path.join(distPath, 'RENAMER by HEIMLICH®-0.0.6-arm64.dmg')}`);
        } else {
            console.error('❌ 공증이 실패했습니다. 위의 결과를 확인하세요.');
        }
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        if (error.stdout) console.error(error.stdout.toString());
        if (error.stderr) console.error(error.stderr.toString());
    }
}

main().catch(err => {
    console.error('❌ 예상치 못한 오류 발생:', err);
    process.exit(1);
});