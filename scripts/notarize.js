const { notarize } = require('@electron/notarize');
const { build } = require('../package.json');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== 'darwin') {
        return;
    }

    console.log('애플 공증 과정을 시작합니다...');

    const appName = context.packager.appInfo.productFilename;
    const appBundleId = build.appId;

    // 계정 정보 직접 설정 (환경 변수 불필요)
    const appleId = "zeonjiho@gmail.com";
    const appleIdPassword = "axxl-zeeq-rubx-cmme";
    const teamId = "L2FYLRHC4Z";

    try {
        // 애플 공증 과정 실행
        await notarize({
            appBundleId,
            appPath: `${appOutDir}/${appName}.app`,
            appleId,
            appleIdPassword,
            teamId,
        });
        console.log('✅ 애플 공증이 성공적으로 완료되었습니다!');
    } catch (error) {
        console.error('❌ 애플 공증 중 오류가 발생했습니다:', error);
        throw error;
    }
};