![RENAMER by HEIMLICH®](assets/HEIMLICH_TYPOLOGO.svg)

A modern, powerful file renaming utility with an intuitive interface designed for efficiency and flexibility.

## Features

### Multiple Renaming Methods
- **Pattern-based**: Use variables like `{name}`, `{ext}`, `{num}`, `{date}`
- **Find & Replace**: Simple text substitution with case sensitivity options
- **Regular Expressions**: Advanced pattern matching and capturing groups
- **Word Selection**: Target specific parts of filenames
- **Sequential Numbering**: Add customizable numbering with sorting options
- **Expression-based**: Use Houdini-like expressions for complex renaming logic

### Media Intelligence
- Automatically extract and use image dimensions, video duration, and frame counts
- Conditional renaming based on media type (image vs video)
- Special format support for EXR, DPX, TIF and professional video formats
- Detailed video metadata extraction including bit depth, chroma subsampling, scan type, and bitrate

### Professional Camera Format Support
- **Camera Formats**: Support for MXF, R3D (RED), BRAW (Blackmagic), ARI (ARRI), ARW/SRAW/RAW (Camera raw)
- **Color Science**: Extract and use colorspace and log information for professional naming workflows
- **Log Formats**: ARRI LogC/LogC3/LogC4, RED Log/Log3G10/Log3G12, Sony S-Log/S-Log2/S-Log3, Canon Log/Log2/Log3, etc.
- **Color Spaces**: ARRI Wide Gamut, RED Wide Gamut, Sony S-Gamut, BT.709, BT.2020, P3, ACES, etc.
- **Technical Metadata**: Access to bit depth (8/10/12-bit), chroma subsampling (4:4:4, 4:2:2, 4:2:0), scan type (progressive/interlaced) and bitrate
- **ACES Workflow**: Fully compatible with ACES colorspace and naming conventions

### Professional Workflow
- Real-time preview before applying changes
- Save and load custom renaming rules
- Full undo/redo history
- Batch operations for multiple files
- Drag-and-drop interface with visual feedback

## Installation

### Download the installer
- Windows: `RENAMER by HEIMLICH® Setup x.x.x.exe`
- macOS: `RENAMER by HEIMLICH®-x.x.x.dmg`
- Linux: `RENAMER by HEIMLICH®-x.x.x.AppImage`

### For developers
1. Clone the repository: `git clone https://github.com/HEIMLICH-STUDIO/HMLH-RENAMER.git`
2. Install dependencies: `npm install`
3. Run in development mode: `npm start`
4. Build for distribution: `npm run build`

## Usage

1. Drag and drop files or click "Select Files"
2. Choose a renaming method from the tabs
3. Configure renaming options
4. Preview changes in real-time
5. Click "Rename Files" to apply changes
6. Review results and use undo if needed

## Advanced Usage Examples

### Pattern Variables
- Basic: `{name}`, `{ext}`, `{num}`, `{date}`
- Media: `{width}`, `{height}`, `{duration}`, `{frames}`, `{colorspace}`, `{log}`, `{codec}`
- Video Technical: `{bit_depth}`, `{chroma_subsampling}`, `{scan_type}`, `{bitrate}`, `{pixel_format}`
- Conditional: `{if_image:text}`, `{if_video:text}`, `{if_landscape:text}`, `{if_portrait:text}`
- Format: `{upper_name}`, `{lower_name}`, `{padnum3}`

### Expression Mode
Use JavaScript-like expressions with specialized functions:
```javascript
name + '_' + padnum(index + 1, 3) + '.' + fileext
cond(isImage, cond(width > height, 'landscape_', 'portrait_'), '') + name + '.' + fileext
'shot_' + padnum(index + 1, 4) + '_v' + padnum(1, 3) + '.' + fileext
```

### Professional Naming Examples
```javascript
// Color science naming convention
name + '_' + colorspace + '_' + log + '.' + fileext  // "footage_ARRI Wide Gamut_ARRI LogC3.ari"

// Studio delivery format
'PROJECT_' + name + '_' + codec + '_' + log + '_v' + padnum(index + 1, 3) + '.' + fileext  // "PROJECT_shot_REDCODE_RED Log3G10_v001.r3d"

// Technical specs in filename 
name + '_' + codec + '_' + bitDepth + '_' + chromaSubsampling + '.' + fileext  // "clip_PRORES_10-bit_4:2:2.mov"

// Camera type categorization
cond(log.includes('LogC'), 'ARRI_', cond(log.includes('RED Log'), 'RED_', cond(log.includes('S-Log'), 'SONY_', ''))) + name + '.' + fileext
```

## License

ISC License © 2025 HEIMLICH®

## Contact

- Website: [heimlich.haus](https://heimlich.haus)
- Repository: [GitHub](https://github.com/HEIMLICH-TECHNIK/HMLH-RENAMER)

## 개발 환경 설정

```
npm install
npm start
```

## 빌드 및 배포

### macOS 앱 빌드, 코드 서명 및 공증

macOS에서 앱을 빌드하고 Apple 공증(Notarization)을 받기 위한 절차:

1. **한 번에 빌드 및 공증**:
   ```
   npm run sign-and-notarize
   ```
   이 명령어는 앱을 빌드하고, 코드 서명 후 Apple 공증 서비스에 제출합니다.

2. **수동으로 단계별 진행**:
   ```
   # 1. 앱 빌드
   npm run build -- --mac
   
   # 2. 모든 바이너리 서명
   node scripts/sign-all.js
   
   # 3. 공증 진행
   node scripts/manual-notarize.js
   ```

3. **주의사항**:
   - 유효한 Apple Developer ID 인증서가 필요합니다.
   - 코드 서명 인증서는 시스템에 올바르게 설치되어 있어야 합니다.
   - 루트 및 중간 인증서가 신뢰되어 있어야 합니다.

### Windows 및 Linux 빌드

```
# Windows
npm run build -- --win

# Linux
npm run build -- --linux
```