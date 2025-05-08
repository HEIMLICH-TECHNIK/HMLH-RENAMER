/**
 * DOM 요소 참조 모음
 * 애플리케이션에서 사용하는 모든 DOM 요소의 참조를 관리합니다.
 */

// 메인 영역 요소
export const mainContent = document.getElementById('dropArea');
export const emptyDropArea = document.getElementById('emptyDropArea');
export const filesPreview = document.getElementById('filesPreview');
export const fileSelectBtn = document.getElementById('fileSelectBtn');
export const fileList = document.getElementById('fileList');
export const fileCount = document.getElementById('fileCount');
export const previewArea = document.getElementById('previewArea');
export const applyBtn = document.getElementById('applyBtn');
export const clearBtn = document.getElementById('clearBtn');

// 탭 요소
export const tabs = document.querySelectorAll('.tab');

// 히스토리 관련 요소
export const undoBtn = document.getElementById('undoBtn');
export const redoBtn = document.getElementById('redoBtn');

// 패턴 방식 요소
export const patternInput = document.getElementById('patternInput');
export const dateFormatContainer = document.getElementById('dateFormatContainer');
export const toggleDateOptions = document.getElementById('toggleDateOptions');
export const dateFormatOptions = document.getElementById('dateFormatOptions');
export const dateFormatPreset = document.getElementById('dateFormatPreset');
export const customDateFormat = document.getElementById('customDateFormat');
export const dateFormatCustom = document.getElementById('dateFormatCustom');

// Replace 방식 요소
export const findText = document.getElementById('findText');
export const replaceText = document.getElementById('replaceText');
export const caseSensitive = document.getElementById('caseSensitive');
export const swapReplaceBtn = document.getElementById('swapReplaceBtn');

// Regex 방식 요소
export const regexPattern = document.getElementById('regexPattern');
export const regexReplacement = document.getElementById('regexReplacement');

// Word 방식 요소
export const wordRulesContainer = document.getElementById('wordRulesContainer');
export const addWordRuleBtn = document.getElementById('addWordRuleBtn');
export const applyToAllFiles = document.getElementById('applyToAllFiles');

// Numbering 방식 요소
export const numberingPattern = document.getElementById('numberingPattern');
export const startNumber = document.getElementById('startNumber');
export const numberPadding = document.getElementById('numberPadding');
export const numberStep = document.getElementById('numberStep');
export const sortingMethod = document.getElementById('sortingMethod');
export const reverseOrder = document.getElementById('reverseOrder');

// Expression 방식 요소
export const expressionInput = document.getElementById('expressionInput');
export const toggleExpressionHelpBtn = document.getElementById('toggleExpressionHelpBtn');
export const expressionHelp = document.getElementById('expressionHelp');
export const expressionExamplesBtn = document.getElementById('expressionExamplesBtn');

// 모달 요소
export const rulesModal = document.getElementById('rulesModal');
export const modalRulesList = document.getElementById('modalRulesList');
export const closeRulesModalBtn = document.getElementById('closeRulesModalBtn');
export const inputModal = document.getElementById('inputModal');
export const inputModalTitle = document.getElementById('inputModalTitle');
export const inputModalField = document.getElementById('inputModalField');
export const closeInputModalBtn = document.getElementById('closeInputModalBtn');
export const inputModalCancelBtn = document.getElementById('inputModalCancelBtn');
export const inputModalConfirmBtn = document.getElementById('inputModalConfirmBtn');
export const expressionExamplesModal = document.getElementById('expressionExamplesModal');
export const closeExpressionExamplesBtn = document.getElementById('closeExpressionExamplesBtn');
export const copyStatus = document.getElementById('copyStatus');

// 결과 관련 요소
export const resultArea = document.getElementById('resultArea');
export const resultList = document.getElementById('resultList');
export const closeResultsBtn = document.getElementById('closeResultsBtn');
export const doneBtn = document.getElementById('doneBtn');

// 규칙 관련 요소
export const saveRuleBtn = document.getElementById('saveRuleBtn');
export const viewRulesBtn = document.getElementById('viewRulesBtn'); 