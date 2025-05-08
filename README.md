# RENAMER by HEIMLICH®

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
- Media: `{width}`, `{height}`, `{duration}`, `{frames}`
- Conditional: `{if_image:text}`, `{if_video:text}`, `{if_landscape:text}`, `{if_portrait:text}`
- Format: `{upper_name}`, `{lower_name}`, `{padnum3}`

### Expression Mode
Use JavaScript-like expressions with specialized functions:
```javascript
name + '_' + padnum(index + 1, 3) + '.' + fileext
cond(isImage, cond(width > height, 'landscape_', 'portrait_'), '') + name + '.' + fileext
'shot_' + padnum(index + 1, 4) + '_v' + padnum(1, 3) + '.' + fileext
```

## License

ISC License © 2025 HEIMLICH®

## Contact

- Website: [heimlich.studio](https://heimlich.studio)
- Repository: [GitHub](https://github.com/HEIMLICH-STUDIO/HMLH-RENAMER) 