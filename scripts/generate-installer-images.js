const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateInstallerImages() {
  try {
    const inputSvg = path.join(__dirname, '..', 'assets', 'icons', 'app-icon.svg');
    const outputDir = path.join(__dirname, '..', 'assets', 'icons');

    // 사이드바 이미지 생성 (164x314 픽셀)
    await sharp({
      create: {
        width: 164,
        height: 314,
        channels: 4,
        background: { r: 18, g: 18, b: 18, alpha: 1 }
      }
    })
    .composite([
      {
        input: await sharp(inputSvg)
          .resize(120, 120)
          .toBuffer(),
        top: 30,
        left: 22
      },
      {
        input: Buffer.from(`
          <svg width="164" height="50" viewBox="0 0 164 50" xmlns="http://www.w3.org/2000/svg">
            <text x="82" y="190" font-family="Segoe UI" font-size="14" fill="white" text-anchor="middle">HEIMLICH®</text>
            <text x="82" y="210" font-family="Segoe UI" font-size="16" fill="white" text-anchor="middle">RENAMER</text>
          </svg>
        `),
        top: 160,
        left: 0
      }
    ])
    .png()
    .toFile(path.join(outputDir, 'installer-sidebar.png'));

    // 헤더 이미지 생성 (150x57 픽셀)
    await sharp({
      create: {
        width: 150,
        height: 57,
        channels: 4,
        background: { r: 18, g: 18, b: 18, alpha: 1 }
      }
    })
    .composite([
      {
        input: Buffer.from(`
          <svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#121212" />
              <stop offset="100%" stop-color="#333333" />
            </linearGradient>
            <rect width="150" height="57" fill="url(#gradient)" />
          </svg>
        `),
        top: 0,
        left: 0
      },
      {
        input: await sharp(inputSvg)
          .resize(40, 40)
          .toBuffer(),
        top: 8,
        left: 10
      },
      {
        input: Buffer.from(`
          <svg width="100" height="57" viewBox="0 0 100 57" xmlns="http://www.w3.org/2000/svg">
            <text x="5" y="22" font-family="Segoe UI" font-size="12" font-weight="bold" fill="white">RENAMER</text>
            <text x="5" y="40" font-family="Segoe UI" font-size="9" fill="#cccccc">by HEIMLICH®</text>
          </svg>
        `),
        top: 0,
        left: 50
      }
    ])
    .png()
    .toFile(path.join(outputDir, 'installer-header.png'));

    console.log('Generated installer images');
  } catch (error) {
    console.error('Error generating installer images:', error);
  }
}

generateInstallerImages(); 