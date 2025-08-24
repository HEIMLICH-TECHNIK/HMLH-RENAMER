/**
 * DOM 요소 참조 모듈
 * 모든 DOM 엘리먼트에 대한 참조를 이 파일에서 관리합니다.
 */

const DOM = {
  // 메인 UI 요소
  mainContent: document.getElementById('dropArea'),
  emptyDropArea: document.getElementById('emptyDropArea'),
  filesPreview: document.getElementById('filesPreview'),
  fileSelectBtn: document.getElementById('fileSelectBtn'),

  fileCount: document.getElementById('fileCount'),
  previewArea: document.getElementById('previewArea'),
  applyBtn: document.getElementById('applyBtn'),
  clearBtn: document.getElementById('clearBtn'),
  resultArea: document.getElementById('resultArea'),
  resultList: document.getElementById('resultList'),
  closeResultsBtn: document.getElementById('closeResultsBtn'),
  doneBtn: document.getElementById('doneBtn'),
  tabs: document.querySelectorAll('.tab'),
  saveRuleBtn: document.getElementById('saveRuleBtn'),
  viewRulesBtn: document.getElementById('viewRulesBtn'),
  swapReplaceBtn: document.getElementById('swapReplaceBtn'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),

  // 패턴 방식 요소
  patternInput: document.getElementById('patternInput'),
  dateFormatContainer: document.getElementById('dateFormatContainer'),
  toggleDateOptions: document.getElementById('toggleDateOptions'),
  dateFormatOptions: document.getElementById('dateFormatOptions'),
  dateFormatPreset: document.getElementById('dateFormatPreset'),
  customDateFormat: document.getElementById('customDateFormat'),
  dateFormatCustom: document.getElementById('dateFormatCustom'),
  togglePatternVarsBtn: document.getElementById('togglePatternVarsBtn'),
  patternExtendedVars: document.getElementById('patternExtendedVars'),

  // 바꾸기 방식 요소
  findText: document.getElementById('findText'),
  replaceText: document.getElementById('replaceText'),
  caseSensitive: document.getElementById('caseSensitive'),

  // 정규식 방식 요소
  regexPattern: document.getElementById('regexPattern'),
  regexReplacement: document.getElementById('regexReplacement'),

  // 단어 방식 요소
  wordRulesContainer: document.getElementById('wordRulesContainer'),
  addWordRuleBtn: document.getElementById('addWordRuleBtn'),
  applyToAllFiles: document.getElementById('applyToAllFiles'),

  // 넘버링 방식 요소
  numberingPattern: document.getElementById('numberingPattern'),
  startNumber: document.getElementById('startNumber'),
  numberPadding: document.getElementById('numberPadding'),
  numberStep: document.getElementById('numberStep'),
  sortingMethod: document.getElementById('sortingMethod'),
  reverseOrder: document.getElementById('reverseOrder'),

  // 표현식 방식 요소
  expressionInput: document.getElementById('expressionInput'),
  toggleExpressionHelpBtn: document.getElementById('toggleExpressionHelpBtn'),
  expressionHelp: document.getElementById('expressionHelp'),
  expressionExamplesBtn: document.getElementById('expressionExamplesBtn'),
  expressionExamplesModal: document.getElementById('expressionExamplesModal'),
  closeExpressionExamplesBtn: document.getElementById('closeExpressionExamplesBtn'),
  copyStatus: document.getElementById('copyStatus'),

  // 모달 요소
  rulesModal: document.getElementById('rulesModal'),
  modalRulesList: document.getElementById('modalRulesList'),
  closeRulesModalBtn: document.getElementById('closeRulesModalBtn'),
  inputModal: document.getElementById('inputModal'),
  inputModalTitle: document.getElementById('inputModalTitle'),
  inputModalField: document.getElementById('inputModalField'),
  closeInputModalBtn: document.getElementById('closeInputModalBtn'),
  inputModalCancelBtn: document.getElementById('inputModalCancelBtn'),
  inputModalConfirmBtn: document.getElementById('inputModalConfirmBtn')
};

export default DOM; 