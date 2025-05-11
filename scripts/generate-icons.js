const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const inputSvg = path.join(__dirname, '..', 'assets', 'icons', 'app-icon.svg');
const outputDir = path.join(__dirname, '..', 'assets', 'icons');

async function generateIcons() {
  try {
    const inputSvg = path.join(__dirname, '..', 'assets', 'icons', 'app-icon.svg');
    
    // Windows ICO 파일 생성 (16x16, 32x32, 48x48, 256x256)
    const icoSizes = [16, 32, 48, 256];
    const icoBuffers = await Promise.all(
      icoSizes.map(size =>
        sharp(inputSvg)
          .resize(size, size)
          .png()
          .toBuffer()
      )
    );

    // ICO 파일 헤더 생성
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // Image type (1 = ICO)
    icoHeader.writeUInt16LE(icoSizes.length, 4); // Number of images

    // ICO 파일 디렉토리 엔트리 생성
    const icoDirectory = Buffer.alloc(16 * icoSizes.length);
    let offset = 6 + (16 * icoSizes.length);

    for (let i = 0; i < icoSizes.length; i++) {
      const size = icoSizes[i];
      const buffer = icoBuffers[i];
      
      // 256x256 이미지는 특별 처리
      const width = size === 256 ? 0 : size;
      const height = size === 256 ? 0 : size;
      
      icoDirectory.writeUInt8(width, i * 16); // Width (0 for 256)
      icoDirectory.writeUInt8(height, i * 16 + 1); // Height (0 for 256)
      icoDirectory.writeUInt8(0, i * 16 + 2); // Color palette
      icoDirectory.writeUInt8(0, i * 16 + 3); // Reserved
      icoDirectory.writeUInt16LE(1, i * 16 + 4); // Color planes
      icoDirectory.writeUInt16LE(32, i * 16 + 6); // Bits per pixel
      icoDirectory.writeUInt32LE(buffer.length, i * 16 + 8); // Image size
      icoDirectory.writeUInt32LE(offset, i * 16 + 12); // Image offset
      
      offset += buffer.length;
    }

    // ICO 파일 작성
    const icoPath = path.join(__dirname, '..', 'assets', 'icons', 'app-icon.ico');
    const icoFile = fs.createWriteStream(icoPath);
    icoFile.write(icoHeader);
    icoFile.write(icoDirectory);
    for (const buffer of icoBuffers) {
      icoFile.write(buffer);
    }
    icoFile.end();
    console.log('Generated ICO file with sizes:', icoSizes.join('x, ') + 'x');

  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons(); 