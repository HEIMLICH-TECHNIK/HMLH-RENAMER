// DOM Elements
const mainContent = document.getElementById('dropArea');
const emptyDropArea = document.getElementById('emptyDropArea');
const filesPreview = document.getElementById('filesPreview');
const fileSelectBtn = document.getElementById('fileSelectBtn');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const patternInput = document.getElementById('patternInput');
const findText = document.getElementById('findText');
const replaceText = document.getElementById('replaceText');
const caseSensitive = document.getElementById('caseSensitive');
const regexPattern = document.getElementById('regexPattern');
const regexReplacement = document.getElementById('regexReplacement');
const previewArea = document.getElementById('previewArea');
const applyBtn = document.getElementById('applyBtn');
const clearBtn = document.getElementById('clearBtn');
const resultArea = document.getElementById('resultArea');
const resultList = document.getElementById('resultList');
const closeResultsBtn = document.getElementById('closeResultsBtn');
const doneBtn = document.getElementById('doneBtn');
const tabs = document.querySelectorAll('.tab');
const wordRulesContainer = document.getElementById('wordRulesContainer');
const addWordRuleBtn = document.getElementById('addWordRuleBtn');
const applyToAllFiles = document.getElementById('applyToAllFiles');
const saveRuleBtn = document.getElementById('saveRuleBtn');
const viewRulesBtn = document.getElementById('viewRulesBtn');
const rulesModal = document.getElementById('rulesModal');
const modalRulesList = document.getElementById('modalRulesList');
const closeRulesModalBtn = document.getElementById('closeRulesModalBtn');
const swapReplaceBtn = document.getElementById('swapReplaceBtn'); // 순서 바꾸기 버튼
const undoBtn = document.getElementById('undoBtn'); // 되돌리기 버튼
const redoBtn = document.getElementById('redoBtn'); // 재실행 버튼

// 입력 모달 요소
const inputModal = document.getElementById('inputModal');
const inputModalTitle = document.getElementById('inputModalTitle');
const inputModalField = document.getElementById('inputModalField');
const closeInputModalBtn = document.getElementById('closeInputModalBtn');
const inputModalCancelBtn = document.getElementById('inputModalCancelBtn');
const inputModalConfirmBtn = document.getElementById('inputModalConfirmBtn');

// 새로운 탭 DOM 요소
const numberingPattern = document.getElementById('numberingPattern');
const startNumber = document.getElementById('startNumber');
const numberPadding = document.getElementById('numberPadding');
const numberStep = document.getElementById('numberStep');
const sortingMethod = document.getElementById('sortingMethod');
const reverseOrder = document.getElementById('reverseOrder');
const expressionInput = document.getElementById('expressionInput');

// 날짜 포맷 관련 DOM 요소
const dateFormatContainer = document.getElementById('dateFormatContainer');
const toggleDateOptions = document.getElementById('toggleDateOptions');
const dateFormatOptions = document.getElementById('dateFormatOptions');
const dateFormatPreset = document.getElementById('dateFormatPreset');
const customDateFormat = document.getElementById('customDateFormat');
const dateFormatCustom = document.getElementById('dateFormatCustom');

// 익스프레션 도움말 토글 버튼
const toggleExpressionHelpBtn = document.getElementById('toggleExpressionHelpBtn');
const expressionHelp = document.getElementById('expressionHelp');

// 익스프레션 예제 버튼과 모달
const expressionExamplesBtn = document.getElementById('expressionExamplesBtn');
const expressionExamplesModal = document.getElementById('expressionExamplesModal');
const closeExpressionExamplesBtn = document.getElementById('closeExpressionExamplesBtn');
const copyStatus = document.getElementById('copyStatus');

// Variables
let selectedFiles = [];
let currentMethod = 'pattern'; // Default method
let wordRules = []; // For word selection method
let selectedWordTokens = []; // Store selections for word method
let wordPatterns = []; // Store patterns for batch apply
let toastTimeout = null; // For toast notifications
let pendingSaveCallback = null; // 모달 콜백 저장용
let lastRenameResults = null; // 마지막 리네이밍 결과 저장

// 히스토리 관리를 위한 변수들
let fileHistory = []; // 파일 목록 변경 히스토리 - {files: [], operations: []}
let historyIndex = -1; // 현재 히스토리 인덱스
const MAX_HISTORY = 50; // 최대 히스토리 저장 개수
let isUndoRedoAction = false; // undo/redo 작업 중인지 여부를 추적
let initialState = null; // 초기 상태 저장 (첫 번째 변경점을 위한 기준점)

// Event Listeners for Tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Update active tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Show/hide corresponding panel
    const method = tab.getAttribute('data-method');
    currentMethod = method;
    
    // Update active panel
    document.querySelectorAll('.method-content').forEach(panel => {
      panel.classList.remove('active');
    });
    
    document.getElementById(`${method}-panel`).classList.add('active');
    
    // Update preview with new method
    updatePreview();
  });
});

// Drag and drop events for the entire main content area
mainContent.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  mainContent.classList.add('drop-active');
});

mainContent.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Check if the leave event is actually leaving the main content
  const rect = mainContent.getBoundingClientRect();
  if (
    e.clientX <= rect.left ||
    e.clientX >= rect.right ||
    e.clientY <= rect.top ||
    e.clientY >= rect.bottom
  ) {
    mainContent.classList.remove('drop-active');
  }
});

mainContent.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  mainContent.classList.remove('drop-active');
  
  handleFiles(e.dataTransfer.files);
});

// File select button
fileSelectBtn.addEventListener('click', async () => {
  const filePaths = await window.api.getFilePaths();
  if (filePaths && filePaths.length > 0) {
    selectedFiles = filePaths;
    updateUI();
  }
});

// Input events for preview updates
patternInput.addEventListener('input', async (e) => {
  // 패턴에 {date} 변수가 포함되었는지 확인
  checkDateVariableInPattern();
  await updatePreview();
});

findText.addEventListener('input', async () => await updatePreview());
replaceText.addEventListener('input', async () => await updatePreview());
caseSensitive.addEventListener('change', async () => await updatePreview());
regexPattern.addEventListener('input', async () => await updatePreview());
regexReplacement.addEventListener('input', async () => await updatePreview());

// Apply button click
applyBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;
  
  try {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Processing...';
    
    // 초기 상태가 저장되지 않았다면 저장
    if (initialState === null) {
      saveToHistory('initial');
    }
    
    let config = {};
    
    switch (currentMethod) {
      case 'pattern':
        config = {
          method: 'pattern',
          pattern: patternInput.value || '{name}'
        };
        break;
      case 'replace':
        config = {
          method: 'replace',
          find: findText.value,
          replace: replaceText.value,
          caseSensitive: caseSensitive.checked,
          matchAll: true
        };
        break;
      case 'regex':
        config = {
          method: 'regex',
          pattern: regexPattern.value,
          replacement: regexReplacement.value
        };
        break;
      case 'word':
        // For word selection, we need to pass the new filenames
        config = {
          method: 'word',
          applyToAll: applyToAllFiles && applyToAllFiles.checked
        };
        
        // Generate new names for all files and include them in the config
        const wordResults = selectedFiles.map((file, index) => {
          const fileName = getFileName(file);
          const newName = applyWordRules(fileName, '', index);
          return {
            filePath: file,
            wordResult: newName
          };
        });
        
        // Send the individual file results
        const results = [];
        
        for (const result of wordResults) {
          const fileConfig = { 
            ...config, 
            wordResult: result.wordResult 
          };
          
          // Send single file to rename
          const singleResult = await window.api.renameFiles([result.filePath], fileConfig);
          results.push(...singleResult);
        }
        
        // 결과 처리 및 토스트 표시
        handleRenameResults(results);
        applyBtn.textContent = 'Rename Files';
        applyBtn.disabled = selectedFiles.length === 0;
        
        // 이름 변경 후 히스토리 저장 (현재 상태)
        saveToHistory('rename-word');
        return; // Skip the normal flow for word method
        
      case 'numbering':
        config = {
          method: 'numbering',
          pattern: numberingPattern ? numberingPattern.value : '{name}_{num}',
          startNumber: startNumber ? parseInt(startNumber.value) || 1 : 1,
          padding: numberPadding ? parseInt(numberPadding.value) || 0 : 0,
          step: numberStep ? parseInt(numberStep.value) || 1 : 1,
          sort: sortingMethod ? sortingMethod.value : 'name',
          reverse: reverseOrder ? reverseOrder.checked : false
        };
        break;
        
      case 'expression':
        // Expression method also needs to generate new names for each file
        const expressionResults = [];
        
        // 각 파일에 대해 개별적으로 표현식 적용 및 이름 변경
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const fileName = getFileName(file);
          const lastDotIndex = fileName.lastIndexOf('.');
          const fileExt = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
          const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
          
          // 해당 파일의 새 이름 생성
          const newName = await applyExpression(baseName, fileExt, fileName, file, i);
          
          console.log(`Expression rename: ${fileName} -> ${newName}`);
          
          if (newName !== fileName) {
            // 단일 파일에 대한 이름 변경 요청
            const fileConfig = {
              method: 'pattern',
              pattern: newName
            };
            
            try {
              // 파일 이름 변경 실행
              const singleResult = await window.api.renameFiles([file], fileConfig);
              expressionResults.push(...singleResult);
            } catch (error) {
              console.error(`Error renaming file ${file}:`, error);
              expressionResults.push({
                oldPath: file,
                success: false,
                error: error.message
              });
            }
          } else {
            // 이름이 변경되지 않은 경우 (성공으로 처리)
            expressionResults.push({
              oldPath: file,
              newPath: file,
              success: true
            });
          }
        }
        
        // 결과 처리 및 토스트 표시
        handleRenameResults(expressionResults);
        applyBtn.textContent = 'Rename Files';
        applyBtn.disabled = selectedFiles.length === 0;
        
        // 이름 변경 후 히스토리 저장 (현재 상태)
        saveToHistory('rename-expression');
        return; // Skip the normal flow
    }
    
    const results = await window.api.renameFiles(selectedFiles, config);
    
    // 결과 처리 및 토스트 표시
    handleRenameResults(results);
    
    // 이름 변경 후 히스토리 저장 (현재 상태)
    saveToHistory('rename-' + currentMethod);
    
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    applyBtn.textContent = 'Rename Files';
    applyBtn.disabled = selectedFiles.length === 0;
  }
});

// Result area controls
closeResultsBtn.addEventListener('click', () => {
  resultArea.classList.add('hidden');
});

doneBtn.addEventListener('click', () => {
  resultArea.classList.add('hidden');
});

// Clear button
clearBtn.addEventListener('click', () => {
  if (selectedFiles.length > 0) {
    // 히스토리 저장 (변경 전 상태)
    saveToHistory();
    
  selectedFiles = [];
  updateUI();
  resultArea.classList.add('hidden');
    console.log('All files cleared');
  }
});

// Add word rule event listener
if (addWordRuleBtn) {
  addWordRuleBtn.addEventListener('click', () => {
    addWordRule();
    updatePreview();
  });
}

// Add event listener for applyToAllFiles checkbox
if (applyToAllFiles) {
  applyToAllFiles.addEventListener('change', () => {
    // Clear word patterns when unchecked
    if (!applyToAllFiles.checked) {
      wordPatterns = [];
    }
    updatePreview();
  });
}

// Save Rule button click event
saveRuleBtn.addEventListener('click', () => {
  saveCurrentRule();
});

// View Rules button click event
viewRulesBtn.addEventListener('click', () => {
  openRulesModal();
});

// Close Rules Modal
if (closeRulesModalBtn) {
  closeRulesModalBtn.addEventListener('click', () => {
    console.log('Close modal button clicked');
    rulesModal.classList.add('hidden');
  });
} else {
  console.error('closeRulesModalBtn is not found in the DOM');
}

// Close modal when clicking outside of it
if (rulesModal) {
  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
      console.log('Modal background clicked');
      rulesModal.classList.add('hidden');
    }
  });
} else {
  console.error('rulesModal is not found in the DOM');
}

// 입력 모달 관련 이벤트 리스너 추가
if (closeInputModalBtn) {
  closeInputModalBtn.addEventListener('click', () => {
    closeInputModal();
  });
}

if (inputModalCancelBtn) {
  inputModalCancelBtn.addEventListener('click', () => {
    closeInputModal();
  });
}

if (inputModalConfirmBtn) {
  inputModalConfirmBtn.addEventListener('click', () => {
    const inputValue = inputModalField.value.trim();
    if (inputValue && pendingSaveCallback) {
      pendingSaveCallback(inputValue);
    }
    closeInputModal();
  });
}

// 입력 모달에서 Enter 키 처리
if (inputModalField) {
  inputModalField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const inputValue = inputModalField.value.trim();
      if (inputValue && pendingSaveCallback) {
        pendingSaveCallback(inputValue);
      }
      closeInputModal();
    }
  });
}

// 입력 모달 외부 클릭 시 닫기
if (inputModal) {
  inputModal.addEventListener('click', (e) => {
    if (e.target === inputModal) {
      closeInputModal();
    }
  });
}

// 입력 모달 닫기 함수
function closeInputModal() {
  inputModal.classList.add('hidden');
  inputModalField.value = '';
  pendingSaveCallback = null;
}

// 입력 모달 열기 함수
function showInputModal(title, placeholder, callback) {
  inputModalTitle.textContent = title || 'Enter Value';
  inputModalField.placeholder = placeholder || '';
  inputModalField.value = '';
  pendingSaveCallback = callback;
  inputModal.classList.remove('hidden');
  inputModalField.focus();
}

// Rule Management Functions
async function saveCurrentRule() {
  try {
    // prompt() 대신 커스텀 입력 모달 사용
    showInputModal('Enter Rule Name', 'My Rule', async (ruleName) => {
      if (!ruleName || ruleName.trim() === '') {
        console.log('Rule name not provided or empty, canceling save');
        return;
      }
      
      console.log('Saving rule with name:', ruleName);
      
      // Gather current rule data based on the active method
      const ruleData = {
        method: currentMethod,
        settings: {}
      };
      
      switch (currentMethod) {
        case 'pattern':
          ruleData.settings = {
            pattern: patternInput.value || '{name}',
            dateFormat: getCurrentDateFormat() // 날짜 포맷 저장
          };
          break;
        case 'replace':
          ruleData.settings = {
            find: findText.value,
            replace: replaceText.value,
            caseSensitive: caseSensitive.checked
          };
          break;
        case 'regex':
          ruleData.settings = {
            pattern: regexPattern.value,
            replacement: regexReplacement.value
          };
          break;
        case 'word':
          // For word method, we need to capture all the word rules
          const wordRuleData = wordRules.map(rule => ({
            action: rule.getAction ? rule.getAction() : rule.action,
            value: rule.getValue ? rule.getValue() : rule.value
          }));
          
          ruleData.settings = {
            applyToAll: applyToAllFiles && applyToAllFiles.checked,
            wordRules: wordRuleData
          };
          break;
        case 'numbering':
          ruleData.settings = {
            pattern: numberingPattern.value,
            startNumber: startNumber.value,
            padding: numberPadding.value,
            step: numberStep.value,
            sort: sortingMethod.value,
            reverse: reverseOrder.checked
          };
          break;
        case 'expression':
          ruleData.settings = {
            expression: expressionInput && expressionInput.value ? expressionInput.value.trim() : 'name + "_" + padnum(index + 1, 3) + "." + fileext'
          };
          break;
      }
      
      console.log('Final rule data to save:', ruleData);
      
      const result = await window.api.saveRule(ruleName, ruleData);
      console.log('Save result:', result);
      
      if (result.success) {
        showToast(`Rule "${ruleName}" saved successfully!`, 'success');
      } else {
        console.error('Error saving rule:', result.error);
        showToast(`Error saving rule: ${result.error}`, 'error');
      }
    });
  } catch (error) {
    console.error('Exception during save:', error);
    showToast(`Error saving rule: ${error.message}`, 'error');
  }
}

async function openRulesModal() {
  try {
    // Show modal
    rulesModal.classList.remove('hidden');
    console.log('Opening rules modal, hidden class removed');
    
    // Add explicit close button event for the modal
    const closeButton = document.getElementById('closeRulesModalBtn');
    if (closeButton) {
      closeButton.onclick = function() {
        console.log('Close button clicked (inline handler)');
        rulesModal.classList.add('hidden');
      };
    }
    
    // Load rules
    const rules = await window.api.getSavedRules();
    
    // Update the UI
    modalRulesList.innerHTML = '';
    
    if (rules.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-rules-message';
      emptyMessage.textContent = 'No saved rules';
      modalRulesList.appendChild(emptyMessage);
      
      // Add a close button at the bottom for empty state
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn-primary';
      closeBtn.textContent = 'Close';
      closeBtn.style.marginTop = '20px';
      closeBtn.addEventListener('click', () => {
        rulesModal.classList.add('hidden');
      });
      
      modalRulesList.appendChild(closeBtn);
      return;
    }
    
    rules.forEach(rule => {
      const ruleItem = document.createElement('div');
      ruleItem.className = 'rule-item';
      
      const ruleName = document.createElement('div');
      ruleName.className = 'rule-name';
      ruleName.textContent = rule.name;
      
      const ruleActions = document.createElement('div');
      ruleActions.className = 'rule-actions';
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'rule-btn rule-load';
      loadBtn.innerHTML = '↓';
      loadBtn.title = 'Load rule';
      loadBtn.addEventListener('click', () => {
        loadRule(rule.name);
        rulesModal.classList.add('hidden');
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rule-btn rule-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Delete rule';
      deleteBtn.addEventListener('click', () => deleteRule(rule.name));
      
      ruleActions.appendChild(loadBtn);
      ruleActions.appendChild(deleteBtn);
      
      ruleItem.appendChild(ruleName);
      ruleItem.appendChild(ruleActions);
      
      modalRulesList.appendChild(ruleItem);
    });
  } catch (error) {
    console.error('Error loading saved rules:', error);
    alert('Error loading saved rules');
    rulesModal.classList.add('hidden');
  }
}

async function loadRule(ruleName) {
  try {
    const result = await window.api.loadRule(ruleName);
    
    if (!result.success) {
      alert(`Error loading rule: ${result.error}`);
      return;
    }
    
    const ruleData = result.data;
    console.log(`Loading rule data:`, ruleData);
    
    // Update UI based on rule data
    const method = ruleData.method;
    const settings = ruleData.settings;
    
    // Switch to the correct tab
    const tabToActivate = document.querySelector(`.tab[data-method="${method}"]`);
    if (tabToActivate) {
      tabs.forEach(t => t.classList.remove('active'));
      tabToActivate.classList.add('active');
      
      // Update active panel
      document.querySelectorAll('.method-content').forEach(panel => {
        panel.classList.remove('active');
      });
      
      document.getElementById(`${method}-panel`).classList.add('active');
      currentMethod = method;
    }
    
    // Apply settings
    switch (method) {
      case 'pattern':
        patternInput.value = settings.pattern || '{name}';
        
        // 날짜 포맷 설정 로드
        if (settings.dateFormat && dateFormatPreset) {
          if (Object.values(dateFormatPreset.options).some(option => option.value === settings.dateFormat)) {
            dateFormatPreset.value = settings.dateFormat;
            customDateFormat.classList.remove('active');
          } else {
            dateFormatPreset.value = 'custom';
            customDateFormat.classList.add('active');
            if (dateFormatCustom) dateFormatCustom.value = settings.dateFormat;
          }
        }
        
        // 날짜 변수 확인하여 UI 표시
        checkDateVariableInPattern();
        break;
      case 'replace':
        findText.value = settings.find || '';
        replaceText.value = settings.replace || '';
        caseSensitive.checked = settings.caseSensitive || false;
        break;
      case 'regex':
        regexPattern.value = settings.pattern || '';
        regexReplacement.value = settings.replacement || '';
        break;
      case 'word':
        if (applyToAllFiles) {
          applyToAllFiles.checked = settings.applyToAll || false;
        }
        
        // Clear existing word rules
        wordRules = [];
        wordRulesContainer.innerHTML = '';
        
        // Add loaded word rules
        if (settings.wordRules && settings.wordRules.length > 0) {
          settings.wordRules.forEach(wordRule => {
            const newRule = addWordRule();
            
            // Set the action and value
            const ruleElem = document.querySelector(`.word-rule[data-rule-id="${newRule.id}"]`);
            if (ruleElem) {
              const actionSelect = ruleElem.querySelector('select');
              const valueInput = ruleElem.querySelector('input');
              
              if (actionSelect) actionSelect.value = wordRule.action;
              if (valueInput) valueInput.value = wordRule.value;
            }
          });
        }
        break;
      case 'numbering':
        if (numberingPattern) numberingPattern.value = settings.pattern || '{name}_{num}';
        if (startNumber) startNumber.value = settings.startNumber || '1';
        if (numberPadding) numberPadding.value = settings.padding || '2';
        if (numberStep) numberStep.value = settings.step || '1';
        if (sortingMethod) sortingMethod.value = settings.sort || 'name';
        if (reverseOrder) reverseOrder.checked = settings.reverse || false;
        break;
      case 'expression':
        if (expressionInput) {
          const defaultExpr = 'name + "_" + padnum(index + 1, 3) + "." + fileext';
          const expr = settings.expression || defaultExpr;
          console.log(`Loading expression: ${expr}`);
          expressionInput.value = expr;
        }
        break;
    }
    
    updatePreview();
    showToast(`Rule "${ruleName}" loaded successfully!`, 'success');
  } catch (error) {
    showToast(`Error loading rule: ${error.message}`, 'error');
  }
}

async function deleteRule(ruleName) {
  if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
    return;
  }
  
  try {
    const result = await window.api.deleteRule(ruleName);
    
    if (result.success) {
      // Refresh the rules list
      openRulesModal();
      alert(`Rule "${ruleName}" deleted successfully!`);
    } else {
      alert(`Error deleting rule: ${result.error}`);
    }
  } catch (error) {
    alert(`Error deleting rule: ${error.message}`);
  }
}

// Utility Functions
function handleFiles(fileList) {
  // Convert FileList object to array
  const files = Array.from(fileList).map(file => file.path);
  
  if (files.length > 0) {
    // 첫 파일 추가 시 히스토리 초기화
    if (selectedFiles.length === 0) {
      console.log('First files added, initializing history');
      fileHistory = [];
      historyIndex = -1;
      initialState = null; // 초기 상태 초기화
    }
    
    // 히스토리 저장 (변경 전 상태)
    saveToHistory('add-files');
    
    // 파일 추가
    selectedFiles = [...selectedFiles, ...files];
    
    updateUI();
    console.log(`Added ${files.length} files, total: ${selectedFiles.length}`);
  }
}

function updateUI() {
  if (selectedFiles.length === 0) {
    mainContent.classList.add('empty');
    emptyDropArea.style.display = 'flex';
    filesPreview.classList.add('hidden');
    applyBtn.disabled = true;
  } else {
    mainContent.classList.remove('empty');
    emptyDropArea.style.display = 'none';
    filesPreview.classList.remove('hidden');
    
    applyBtn.disabled = false;
    
    // Update the file count
    fileCount.textContent = selectedFiles.length === 1 
      ? '1 file selected' 
      : `${selectedFiles.length} files selected`;
    
    // Update the preview
    updatePreview();
  }
  
  // 히스토리 버튼 상태 업데이트
  updateHistoryButtons();
}

function updateFileList() {
  fileList.innerHTML = '';
  
  if (selectedFiles.length === 0) {
    return;
  }
  
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    // Add file icon (can be customized based on file type)
    const fileIcon = document.createElement('div');
    fileIcon.className = 'file-icon';
    fileIcon.innerHTML = '📄';
    
    // Create details container
    const fileDetails = document.createElement('div');
    fileDetails.className = 'file-details';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = getFileName(file);
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = file;
    
    // Add details to container
    fileDetails.appendChild(fileName);
    fileDetails.appendChild(fileInfo);
    
    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      updateUI();
    });
    
    // Add elements to the file item
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileDetails);
    fileItem.appendChild(removeBtn);
    fileList.appendChild(fileItem);
  });
}

async function updatePreview() {
  if (selectedFiles.length === 0) {
    previewArea.innerHTML = '<p>Select files to see preview</p>';
    return;
  }
  
  previewArea.innerHTML = '';
  
  const previewList = document.createElement('div');
  previewList.className = 'preview-list';
  
  for (let index = 0; index < selectedFiles.length; index++) {
    const file = selectedFiles[index];
    const oldName = getFileName(file);
    const newName = await generateNewName(file, index);
    
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    
    const oldNameEl = document.createElement('div');
    oldNameEl.className = 'old-name';
    
    // If word selection method, make words selectable
    if (currentMethod === 'word') {
      const words = oldName.split(/(\W+)/); // Split into words and non-words
      words.forEach((word, wordIndex) => {
        if (word.trim() === '') return; // Skip empty strings
        
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word-token';
        wordSpan.textContent = word;
        wordSpan.dataset.fileIndex = index;
        wordSpan.dataset.wordIndex = wordIndex;
        wordSpan.dataset.word = word;
        
        // Check if this word is selected
        const isSelected = selectedWordTokens.some(token => 
          token.fileIndex == index && token.wordIndex == wordIndex
        );
        
        if (isSelected) {
          wordSpan.classList.add('selected');
        }
        
        wordSpan.addEventListener('click', () => {
          // Toggle selection
          if (wordSpan.classList.contains('selected')) {
            wordSpan.classList.remove('selected');
            // Remove from selected tokens
            const tokenIndex = selectedWordTokens.findIndex(token => 
              token.fileIndex == index && token.wordIndex == wordIndex
            );
            if (tokenIndex !== -1) {
              selectedWordTokens.splice(tokenIndex, 1);
            }
          } else {
            wordSpan.classList.add('selected');
            // Add to selected tokens
            selectedWordTokens.push({
              fileIndex: index,
              wordIndex: wordIndex,
              word: word
            });
            
            // Store the word pattern for batch apply
            if (applyToAllFiles && applyToAllFiles.checked) {
              // Check if this word pattern is already stored
              if (!wordPatterns.some(pattern => pattern.word === word)) {
                wordPatterns.push({
                  word: word,
                  pattern: new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g')
                });
              }
            }
          }
          updatePreview();
        });
        
        oldNameEl.appendChild(wordSpan);
      });
    } else {
      oldNameEl.textContent = oldName;
    }
    
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    
    const newNameEl = document.createElement('div');
    newNameEl.className = 'new-name';
    newNameEl.textContent = newName;
    
    // Add remove button to preview items
    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', () => {
      // 히스토리 저장 (변경 전 상태)
      saveToHistory();
      
      // 파일 제거
      selectedFiles = [
        ...selectedFiles.slice(0, index),
        ...selectedFiles.slice(index + 1)
      ];
      
      updateUI();
      console.log(`Removed file at index ${index}, remaining: ${selectedFiles.length}`);
    });
    
    previewItem.appendChild(oldNameEl);
    previewItem.appendChild(arrow);
    previewItem.appendChild(newNameEl);
    previewItem.appendChild(removeBtn);
    previewList.appendChild(previewItem);
  }
  
  previewArea.appendChild(previewList);
}

async function generateNewName(filePath, index) {
  // Extract filename from path
  const fileName = getFileName(filePath);
  const lastDotIndex = fileName.lastIndexOf('.');
  const fileExt = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  
  let newName = '';
  
  switch (currentMethod) {
    case 'pattern':
      newName = applyPattern(baseName, fileExt, index);
      break;
    case 'replace':
      newName = applyFindReplace(fileName, fileExt);
      break;
    case 'regex':
      newName = applyRegex(fileName, fileExt);
      break;
    case 'word':
      newName = applyWordRules(fileName, fileExt, index);
      break;
    case 'numbering':
      newName = applyNumbering(baseName, fileExt, index);
      break;
    case 'expression':
      newName = await applyExpression(baseName, fileExt, fileName, filePath, index);
      break;
  }
  
  return newName;
}

function applyPattern(baseName, fileExt, index) {
  let pattern = patternInput.value || '{name}';
  
  // Format sequential number (using 1-based indexing)
  const numValue = index + 1;
  let formattedNumber = numValue.toString();
  
  // Get today's date in specified format
  const today = new Date();
  const dateFormat = getCurrentDateFormat();
  const dateString = formatDate(today, dateFormat);
  
  // Replace variables in pattern
  let newName = pattern
    .replace(/{name}/g, baseName)
    .replace(/{ext}/g, fileExt.replace('.', ''))
    .replace(/{num}/g, formattedNumber)
    .replace(/{date}/g, dateString);
  
  // Add extension if not included in pattern
  if (fileExt && !newName.includes(fileExt)) {
    newName += fileExt;
  }
  
  return newName;
}

function applyFindReplace(fileName, fileExt) {
  const find = findText.value;
  const replace = replaceText.value;
  
  if (!find) return fileName; // No change if find is empty
  
  let result = fileName;
  const flags = caseSensitive.checked ? '' : 'i';
  
  const regex = new RegExp(escapeRegExp(find), flags + 'g');
  result = fileName.replace(regex, replace);
  
  return result;
}

function applyRegex(fileName, fileExt) {
  const pattern = regexPattern.value;
  const replacement = regexReplacement.value;
  
  if (!pattern) return fileName; // No change if pattern is empty
  
  try {
    const regex = new RegExp(pattern, 'g');
    return fileName.replace(regex, replacement);
  } catch (error) {
    // Invalid regex pattern
    return fileName;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special characters
}

function getFileName(filePath) {
  // Split by path separators and get last element
  return filePath.split(/[\\/]/).pop();
}

function showResults(results) {
  resultList.innerHTML = '';
  
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${result.success ? 'success' : 'error'}`;
    
    const oldPathEl = document.createElement('div');
    oldPathEl.className = 'path';
    oldPathEl.textContent = `Original: ${result.oldPath}`;
    
    resultItem.appendChild(oldPathEl);
    
    if (result.success) {
      const newPathEl = document.createElement('div');
      newPathEl.className = 'path';
      newPathEl.textContent = `Renamed to: ${result.newPath}`;
      resultItem.appendChild(newPathEl);
    } else {
      const errorEl = document.createElement('div');
      errorEl.className = 'error-msg';
      errorEl.textContent = `Error: ${result.error}`;
      resultItem.appendChild(errorEl);
    }
    
    resultList.appendChild(resultItem);
  });
  
  resultArea.classList.remove('hidden');
}

// Word selection method functions
function addWordRule() {
  const ruleId = Date.now(); // Unique identifier for this rule
  const ruleElem = document.createElement('div');
  ruleElem.className = 'word-rule';
  ruleElem.dataset.ruleId = ruleId;
  
  const actionSelect = document.createElement('select');
  actionSelect.innerHTML = `
    <option value="replace">Replace</option>
    <option value="remove">Remove</option>
    <option value="prefix">Add Prefix</option>
    <option value="suffix">Add Suffix</option>
  `;
  actionSelect.addEventListener('change', updatePreview);
  
  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'New value';
  valueInput.addEventListener('input', updatePreview);
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'word-rule-remove';
  removeBtn.innerHTML = '&times;';
  removeBtn.addEventListener('click', () => {
    // Remove the rule
    ruleElem.remove();
    // Remove from wordRules array
    const ruleIndex = wordRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex !== -1) {
      wordRules.splice(ruleIndex, 1);
    }
    updatePreview();
  });
  
  ruleElem.appendChild(actionSelect);
  ruleElem.appendChild(valueInput);
  ruleElem.appendChild(removeBtn);
  
  wordRulesContainer.appendChild(ruleElem);
  
  // Create and add the rule object
  const newRule = {
    id: ruleId,
    action: 'replace',
    value: '',
    getAction: () => actionSelect.value,
    getValue: () => valueInput.value
  };
  
  // Add to rules array
  wordRules.push(newRule);
  
  // Return the new rule for reference
  return newRule;
}

function applyWordRules(fileName, fileExt, fileIndex) {
  if ((selectedWordTokens.length === 0 && wordPatterns.length === 0) || wordRules.length === 0) {
    return fileName; // No changes if no words selected or no rules
  }
  
  // Split the filename into words and non-words
  const words = fileName.split(/(\W+)/);
  
  // If "apply to all files" is checked, use patterns instead of specific tokens
  if (applyToAllFiles && applyToAllFiles.checked) {
    // Apply rules to all matching patterns
    for (const rule of wordRules) {
      const action = rule.getAction();
      const value = rule.getValue();
      
      for (const pattern of wordPatterns) {
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          
          // Skip non-word parts
          if (word.trim() === '') continue;
          
          // Check if this word matches the pattern
          if (pattern.pattern.test(word)) {
            pattern.pattern.lastIndex = 0; // Reset regex
            
            switch (action) {
              case 'replace':
                words[i] = value;
                break;
              case 'remove':
                words[i] = '';
                break;
              case 'prefix':
                words[i] = value + words[i];
                break;
              case 'suffix':
                words[i] = words[i] + value;
                break;
            }
          }
        }
      }
    }
  } else {
    // Get tokens for this file
    const fileTokens = selectedWordTokens.filter(token => token.fileIndex == fileIndex);
    
    if (fileTokens.length === 0) {
      return fileName; // No tokens for this file
    }
    
    // Apply rules to selected words
    for (const rule of wordRules) {
      const action = rule.getAction();
      const value = rule.getValue();
      
      for (const token of fileTokens) {
        const wordIndex = parseInt(token.wordIndex);
        
        switch (action) {
          case 'replace':
            words[wordIndex] = value;
            break;
          case 'remove':
            words[wordIndex] = '';
            break;
          case 'prefix':
            words[wordIndex] = value + words[wordIndex];
            break;
          case 'suffix':
            words[wordIndex] = words[wordIndex] + value;
            break;
        }
      }
    }
  }
  
  // Join all words back
  return words.join('');
}

// Apply numbering to filename
function applyNumbering(baseName, fileExt, index) {
  const pattern = numberingPattern.value || '{name}_{num}';
  const start = parseInt(startNumber.value) || 1;
  const padding = parseInt(numberPadding.value) || 0;
  const step = parseInt(numberStep.value) || 1;
  
  // Calculate the current number
  const num = start + (index * step);
  
  // Format sequential number with padding
  let formattedNumber = num.toString();
  if (padding > 0) {
    formattedNumber = formattedNumber.padStart(padding, '0');
  }
  
  // Replace variables in pattern
  let newName = pattern
    .replace(/{name}/g, baseName)
    .replace(/{num}/g, formattedNumber)
    .replace(/{ext}/g, fileExt.replace('.', ''));
  
  // Add extension if not included in pattern
  if (fileExt && !newName.includes(fileExt)) {
    newName += fileExt;
  }
  
  return newName;
}

// Apply expression to filename
async function applyExpression(baseName, fileExt, fileName, filePath, index) {
  try {
    // Get expression from input
    const expression = expressionInput.value || 'name + "_" + padnum(index + 1, 3) + "." + fileext';
    
    console.log(`Evaluating expression: ${expression}`);
    
    // Check for common errors: using if as keyword instead of function
    if (expression.includes(' if(') || expression.includes(' if (')) {
      throw new Error("'if' is a reserved keyword. Use cond(condition, trueValue, falseValue) instead.");
    }
    
    // 이미지 파일인지 확인
    const isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath);
    // 비디오 파일인지 확인
    const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i.test(filePath);
    
    // 이미지 크기 정보 (기본값 설정)
    let width = 0;
    let height = 0;
    let duration = 0; // 비디오 재생 시간(초)
    
    // 이미지나 비디오 파일인 경우 크기를 가져오는 함수
    if ((isImage || isVideo) && (expression.includes('width') || expression.includes('height') || expression.includes('duration'))) {
      console.log("Getting media dimensions for:", filePath);
      
      // 특수 이미지 포맷 확인
      const isSpecialImage = /\.(exr|dpx|tiff?|psd|hdr)$/i.test(filePath);
      
      if (isSpecialImage) {
        console.log(`Special image format detected: ${filePath}. Using enhanced resolution extraction.`);
        showToast(`${fileExt.replace('.', '')} 파일의 해상도를 가져오는 중...`, "info");
      }
      
      if (isVideo) {
        console.log(`Video file detected: ${filePath}. Extracting resolution and duration.`);
        showToast(`${fileExt.replace('.', '')} 비디오 파일의 정보를 가져오는 중...`, "info");
      }
      
      try {
        // API 사용 가능 여부 확인 (electron.ipcRenderer가 preload.js를 통해 노출되었을 경우)
        if (window.electron && window.electron.getImageSize) {
          console.log("Using IPC to get media size");
          // preload.js를 통해 노출된 API 사용 (비동기 처리)
          try {
            const dimensions = await window.electron.getImageSize(filePath);
            if (dimensions) {
              width = dimensions.width;
              height = dimensions.height;
              
              // 비디오 파일인 경우 duration 정보도 확인
              if (isVideo && dimensions.duration) {
                duration = parseFloat(dimensions.duration) || 0;
                console.log(`Video duration: ${duration}s`);
              }
              
              console.log(`Media dimensions: ${width}x${height}`);
            }
          } catch (err) {
            console.error("Error in await getImageSize:", err);
          }
        } else {
          // 브라우저 환경에서 이미지 로드 시도 (보안 정책으로 인해 작동하지 않을 수 있음)
          console.log("Warning: window.electron.getImageSize not available");
          console.log("Using fallback method (may not work due to security restrictions)");
          
          // 사용자에게 알림
          showToast("미디어 크기를 가져오려면 preload.js에 getImageSize API를 추가해야 합니다.", "warning");
          
          // width, height 변수는 사용할 수 있지만 0으로 설정됨
          console.log("Width and height will be set to 0");
        }
      } catch (error) {
        console.error("Error getting media dimensions:", error);
      }
    }
    
    // Create context for expression
    const context = {
      name: baseName,
      fileext: fileExt.replace('.', ''),
      fullname: fileName,
      path: filePath,
      index: index,
      date: new Date().toISOString().split('T')[0],
      // 이미지/비디오 정보 추가
      width: width,
      height: height,
      duration: duration, // 비디오 재생 시간(초)
      isImage: isImage,
      isVideo: isVideo, // 비디오 파일 여부
      // Helper functions
      padnum: (num, length) => num.toString().padStart(length, '0'),
      upper: (str) => str.toUpperCase(),
      lower: (str) => str.toLowerCase(),
      substr: (str, start, length) => str.substr(start, length),
      // 시간 포맷팅 함수 추가 (초를 "00:00:00" 형식으로 변환)
      formatTime: (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00:00";
        seconds = Math.floor(seconds);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      },
      // Renamed if to cond to avoid JavaScript keyword issues
      cond: (condition, trueValue, falseValue) => condition ? trueValue : falseValue
    };
    
    console.log('Expression context:', context);
    
    // Eval the expression with context
    // This is safe since we're using it internally (not with user input from outside the app)
    const evalWithContext = (expression, context) => {
      try {
        // Create a function with context variables as parameters
        const contextKeys = Object.keys(context);
        const contextValues = contextKeys.map(key => context[key]);
        
        // Create and call the function
        const func = new Function(...contextKeys, `return ${expression};`);
        const result = func(...contextValues);
        
        console.log('Expression result:', result);
        
        // 문자열이 아닌 경우 문자열로 변환
        return result !== null && result !== undefined ? String(result) : '';
      } catch (error) {
        console.error('Error evaluating expression:', error);
        
        // 사용자에게 더 유용한 에러 메시지 제공
        if (error.message.includes("Unexpected token 'if'")) {
          throw new Error("'if' is a reserved keyword. Use cond(condition, trueValue, falseValue) or try the ternary operator: condition ? trueValue : falseValue");
        }
        
        throw error;
      }
    };
    
    let result = evalWithContext(expression, context);
    
    // 파일 확장자가 결과에 없고 원본 파일에 확장자가 있었으면 추가
    if (fileExt && !result.includes(fileExt)) {
      result += fileExt;
    }
    
    console.log(`Final expression result: ${result}`);
    return result;
  } catch (error) {
    console.error('Expression error:', error);
    showToast(`Expression error: ${error.message}`, 'error');
    // Return original filename on error
    return fileName;
  }
}

// Add input event listeners for preview updates
if (numberingPattern) numberingPattern.addEventListener('input', async () => await updatePreview());
if (startNumber) startNumber.addEventListener('input', async () => await updatePreview());
if (numberPadding) numberPadding.addEventListener('input', async () => await updatePreview());
if (numberStep) numberStep.addEventListener('input', async () => await updatePreview());
if (sortingMethod) sortingMethod.addEventListener('change', async () => await updatePreview());
if (reverseOrder) reverseOrder.addEventListener('change', async () => await updatePreview());
if (expressionInput) expressionInput.addEventListener('input', async () => await updatePreview());

// 날짜 포맷 관련 토글 버튼
if (toggleDateOptions) {
  toggleDateOptions.addEventListener('click', () => {
    dateFormatOptions.classList.toggle('expanded');
    toggleDateOptions.textContent = dateFormatOptions.classList.contains('expanded') ? 'Options ▲' : 'Options ▼';
  });
}

// 날짜 포맷 프리셋 변경 이벤트
if (dateFormatPreset) {
  dateFormatPreset.addEventListener('change', async () => {
    const isCustom = dateFormatPreset.value === 'custom';
    
    if (isCustom) {
      customDateFormat.classList.add('active');
      dateFormatCustom.focus();
    } else {
      customDateFormat.classList.remove('active');
    }
    
    await updatePreview();
  });
}

// 커스텀 날짜 포맷 입력 이벤트
if (dateFormatCustom) {
  dateFormatCustom.addEventListener('input', async () => await updatePreview());
}

// 패턴에 {date} 변수가 있는지 확인하고 UI 표시/숨김 처리
function checkDateVariableInPattern() {
  const pattern = patternInput.value || '';
  
  if (pattern.includes('{date}') && dateFormatContainer) {
    dateFormatContainer.classList.add('active');
  } else if (dateFormatContainer) {
    dateFormatContainer.classList.remove('active');
    
    // 옵션 패널도 닫기
    dateFormatOptions.classList.remove('expanded');
    toggleDateOptions.textContent = 'Options ▼';
  }
}

// 현재 날짜 포맷 가져오기
function getCurrentDateFormat() {
  if (!dateFormatPreset) return 'YYYY-MM-DD'; // 기본 포맷
  
  const selectedFormat = dateFormatPreset.value;
  
  if (selectedFormat === 'custom' && dateFormatCustom) {
    return dateFormatCustom.value || 'YYYY-MM-DD';
  }
  
  return selectedFormat;
}

// 날짜를 지정된 포맷으로 포맷팅
function formatDate(date, format) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // 날짜 포맷 토큰 대체
  return format
    .replace(/YYYY/g, year.toString())
    .replace(/YY/g, year.toString().slice(-2))
    .replace(/MM/g, month.toString().padStart(2, '0'))
    .replace(/DD/g, day.toString().padStart(2, '0'))
    .replace(/HH/g, hours.toString().padStart(2, '0'))
    .replace(/mm/g, minutes.toString().padStart(2, '0'))
    .replace(/ss/g, seconds.toString().padStart(2, '0'));
}

// 리네이밍 결과 처리 함수
function handleRenameResults(results) {
  // 마지막 결과 저장
  lastRenameResults = results;
  
  // 성공 및 실패 개수 계산
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  
  // 토스트 메시지 생성 (영어로 변경)
  let message = '';
  if (successCount > 0 && errorCount === 0) {
    message = `${successCount} files renamed successfully`;
  } else if (successCount > 0 && errorCount > 0) {
    message = `${successCount} successful, ${errorCount} failed`;
  } else {
    message = `Rename failed: ${errorCount} files`;
  }
  
  // 토스트 표시 (자세히 보기 버튼 포함)
  showToastWithDetails(message, successCount > 0 ? 'success' : 'error');
  
  // 성공한 파일들 업데이트
  updateSuccessfulFiles(results);
}

// 성공한 파일 업데이트
function updateSuccessfulFiles(results) {
  // 성공한 파일 정보 추출
  const successfulResults = results.filter(r => r.success);
  
  // 파일 목록 업데이트
  successfulResults.forEach(result => {
    // 기존 파일 경로와 일치하는 항목 찾기
    const fileIndex = selectedFiles.findIndex(file => file === result.oldPath);
    if (fileIndex !== -1) {
      // 성공한 파일의 경로 업데이트
      selectedFiles[fileIndex] = result.newPath;
    }
  });
  
  // UI 업데이트
    updatePreview();
}

// 자세히 보기 버튼이 있는 토스트 알림 표시 함수
function showToastWithDetails(message, type = 'info') {
  // 기졸 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }
  
  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
      <button class="toast-details">Details</button>
      <button class="toast-close">&times;</button>
    </div>
  `;
  
  // 토스트 마우스 이벤트 - 호버 시 자동 닫힘 방지
  let isToastHovered = false;
  
  toast.addEventListener('mouseenter', () => {
    isToastHovered = true;
    // 기졸 타임아웃 제거
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  });
  
  toast.addEventListener('mouseleave', () => {
    isToastHovered = false;
    // 마우스가 떠나면 새 타이머 설정
    startToastTimer(toast);
  });
  
  // 닫기 버튼 이벤트
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    closeToastWithAnimation(toast);
  });
  
  // 자세히 보기 버튼 이벤트
  const detailsBtn = toast.querySelector('.toast-details');
  detailsBtn.addEventListener('click', () => {
    if (lastRenameResults) {
      showResults(lastRenameResults);
    }
    closeToastWithAnimation(toast);
  });
  
  // 문서에 추가
  document.body.appendChild(toast);
  
  // 자동 닫기 타이머 시작
  startToastTimer(toast);
}

// 토스트 닫기 함수 (애니메이션 포함)
function closeToastWithAnimation(toast) {
  toast.classList.add('toast-hiding');
  
  // 애니메이션 완료 후 제거
  toast.addEventListener('animationend', () => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  });
}

// 토스트 타이머 시작 함수
function startToastTimer(toast) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  toastTimeout = setTimeout(() => {
    closeToastWithAnimation(toast);
  }, 5000);
}

// 토스트 알림 표시 함수
function showToast(message, type = 'info') {
  // 기졸 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }
  
  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
      <button class="toast-close">&times;</button>
    </div>
  `;
  
  // 토스트 마우스 이벤트 - 호버 시 자동 닫힘 방지
  let isToastHovered = false;
  
  toast.addEventListener('mouseenter', () => {
    isToastHovered = true;
    // 기졸 타임아웃 제거
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  });
  
  toast.addEventListener('mouseleave', () => {
    isToastHovered = false;
    // 마우스가 떠나면 새 타이머 설정
    startToastTimer(toast);
  });
  
  // 닫기 버튼 이벤트
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    closeToastWithAnimation(toast);
  });
  
  // 문서에 추가
  document.body.appendChild(toast);
  
  // 자동 닫기 타이머 시작
  startToastTimer(toast);
}

// Find & Replace 텍스트 상자 내용 스왑 기능
if (swapReplaceBtn) {
  swapReplaceBtn.addEventListener('click', () => {
    const findValue = findText.value;
    const replaceValue = replaceText.value;
    
    // 값 교체
    findText.value = replaceValue;
    replaceText.value = findValue;
    
    // 미리보기 업데이트
    updatePreview();
    
    // 간단한 애니메이션 효과
    swapReplaceBtn.classList.add('active');
    setTimeout(() => {
      swapReplaceBtn.classList.remove('active');
    }, 300);
  });
}

// 히스토리에 현재 상태 저장
function saveToHistory(operation = null) {
  // undo/redo 작업 중이면 히스토리에 저장하지 않음
  if (isUndoRedoAction) return;

  // 현재 파일 목록 복사 (깊은 복사)
  const currentState = {
    files: JSON.parse(JSON.stringify(selectedFiles)),
    operation: operation // 수행된 작업 정보
  };
  
  // 초기 상태 저장 (첫 번째 변경점 인식을 위함)
  if (initialState === null && selectedFiles.length > 0) {
    initialState = {
      files: JSON.parse(JSON.stringify(selectedFiles)),
      operation: null
    };
    console.log('Initial state saved');
    
    // 첫 번째 작업 전에 초기 상태를 히스토리에 저장
    fileHistory.push(initialState);
    historyIndex = 0;
  }
  
  // 이전 상태와 현재 상태가 같으면 저장하지 않음
  if (fileHistory.length > 0 && historyIndex >= 0) {
    const prevState = fileHistory[historyIndex];
    if (JSON.stringify(prevState.files) === JSON.stringify(currentState.files)) {
      return; // 변화가 없으면 히스토리에 추가하지 않음
    }
  }
  
  // 히스토리 인덱스 이후의 내용 제거 (undo 후 새 작업 시)
  if (historyIndex < fileHistory.length - 1) {
    fileHistory = fileHistory.slice(0, historyIndex + 1);
  }
  
  // 히스토리에 현재 상태 추가
  fileHistory.push(currentState);
  
  // 최대 히스토리 개수 제한
  if (fileHistory.length > MAX_HISTORY) {
    fileHistory.shift();
    historyIndex = Math.max(0, historyIndex - 1);
  } else {
    // 현재 인덱스 업데이트
    historyIndex = fileHistory.length - 1;
  }
  
  console.log(`History saved: index=${historyIndex}, total=${fileHistory.length}, operation=${operation}`);
  
  // 버튼 상태 업데이트
  updateHistoryButtons();
}

// 히스토리 버튼 상태 업데이트
function updateHistoryButtons() {
  if (undoBtn && redoBtn) {
    // 첫 번째 상태부터 undo 가능하도록 historyIndex > 0 조건 사용
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= fileHistory.length - 1 || fileHistory.length <= 1;
    
    // 비활성화된 버튼의 경우 추가 스타일 클래스 적용
    if (undoBtn.disabled) {
      undoBtn.classList.add('disabled');
    } else {
      undoBtn.classList.remove('disabled');
    }
    
    if (redoBtn.disabled) {
      redoBtn.classList.add('disabled');
    } else {
      redoBtn.classList.remove('disabled');
    }
    
    console.log(`Button states - Undo: ${!undoBtn.disabled}, Redo: ${!redoBtn.disabled}`);
  }
}

// Undo 기능 구현 - 실제 파일 시스템에 적용
async function undo() {
  console.log(`Undo requested: current index=${historyIndex}, history length=${fileHistory.length}`);
  
  if (historyIndex > 0) {
    isUndoRedoAction = true;
    
    // 현재 상태 및 이전 상태 가져오기
    const currentState = fileHistory[historyIndex];
    historyIndex--;
    const prevState = fileHistory[historyIndex];
    
    console.log(`Undo to index: ${historyIndex}`);
    
    try {
      // 파일 시스템에 변경 적용
      if (prevState.files.length > 0 && currentState.files.length > 0) {
        // 1. 현재 상태의 파일들을 이전 상태의 이름으로 되돌림
        const renameResults = await performFileSystemRevert(currentState.files, prevState.files);
        
        if (renameResults && renameResults.some(r => !r.success)) {
          console.error('Some files failed to rename during undo:', renameResults.filter(r => !r.success));
          showToast('Some files could not be reverted', 'error');
        }
      }
      
      // 상태 업데이트
      selectedFiles = JSON.parse(JSON.stringify(prevState.files));
updateUI();
      showToast('Undo completed', 'info');
      
    } catch (error) {
      console.error('Error during undo:', error);
      showToast(`Undo failed: ${error.message}`, 'error');
    } finally {
      isUndoRedoAction = false;
      updateHistoryButtons();
    }
  }
}

// Redo 기능 구현 - 실제 파일 시스템에 적용
async function redo() {
  console.log(`Redo requested: current index=${historyIndex}, history length=${fileHistory.length}`);
  
  if (historyIndex < fileHistory.length - 1) {
    isUndoRedoAction = true;
    
    // 현재 상태 및 다음 상태 가져오기
    const currentState = fileHistory[historyIndex];
    historyIndex++;
    const nextState = fileHistory[historyIndex];
    
    console.log(`Redo to index: ${historyIndex}`);
    
    try {
      // 파일 시스템에 변경 적용
      if (currentState.files.length > 0 && nextState.files.length > 0) {
        // 현재 상태의 파일들을 다음 상태의 이름으로 적용
        const renameResults = await performFileSystemRevert(currentState.files, nextState.files);
        
        if (renameResults && renameResults.some(r => !r.success)) {
          console.error('Some files failed to rename during redo:', renameResults.filter(r => !r.success));
          showToast('Some files could not be redone', 'error');
        }
      }
      
      // 상태 업데이트
      selectedFiles = JSON.parse(JSON.stringify(nextState.files));
      updateUI();
      showToast('Redo completed', 'info');
      
    } catch (error) {
      console.error('Error during redo:', error);
      showToast(`Redo failed: ${error.message}`, 'error');
    } finally {
      isUndoRedoAction = false;
      updateHistoryButtons();
    }
  }
}

// 파일 시스템에서 이름 되돌리기/다시 적용하기
async function performFileSystemRevert(sourceFiles, targetFiles) {
  // 원본 파일들과 대상 파일들 매핑
  const fileMappings = [];
  
  // 가장 간단한 매핑 방식: 인덱스 기반 (더 복잡한 상황에서는 향상 필요)
  for (let i = 0; i < Math.min(sourceFiles.length, targetFiles.length); i++) {
    if (sourceFiles[i] !== targetFiles[i]) {
      fileMappings.push({
        oldPath: sourceFiles[i],
        newPath: targetFiles[i]
      });
    }
  }
  
  console.log('File mappings for revert:', fileMappings);
  
  if (fileMappings.length === 0) {
    return []; // 변경할 파일이 없음
  }
  
  // 파일 이름 변경 수행
  const results = [];
  for (const mapping of fileMappings) {
    try {
      // 개별 파일 이름 변경 - pattern 방식 사용
      // 실제 파일 경로에서 파일명만 추출
      const oldFileName = mapping.oldPath.split(/[\\/]/).pop();
      const newFileName = mapping.newPath.split(/[\\/]/).pop();
      
      console.log(`Renaming: ${oldFileName} -> ${newFileName}`);
      
      // 파일이름만 변경하는 설정으로 변경
      const result = await window.api.renameFiles([mapping.oldPath], {
        method: 'pattern',
        // 정확한 새 파일명을 지정
        pattern: newFileName
      });
      
      results.push(...result);
    } catch (error) {
      console.error(`Error renaming file from ${mapping.oldPath} to ${mapping.newPath}:`, error);
      results.push({
        oldPath: mapping.oldPath,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// 초기화 함수에 히스토리 초기화 추가
function initializeApp() {
  // 날짜 포맷 UI 초기화
  if (dateFormatPreset) {
    dateFormatPreset.value = 'YYYY-MM-DD'; // 기본값 설정
  }
  
  // 패턴에 {date} 변수 확인
  checkDateVariableInPattern();
  
  // 히스토리 초기화
  fileHistory = [];
  historyIndex = -1;
  initialState = null; // 초기 상태 초기화
  updateHistoryButtons();
  
  // Undo 버튼 이벤트 리스너
  if (undoBtn) {
    undoBtn.addEventListener('click', undo);
  }
  
  // Redo 버튼 이벤트 리스너
  if (redoBtn) {
    redoBtn.addEventListener('click', redo);
  }
  
  // 기타 초기화 작업...
  updateUI();
}

// 앱 초기화 호출
initializeApp();

// 문서 클릭 이벤트를 통해 모달 닫기
document.addEventListener('click', function(event) {
  // 모달이 열려있고, 클릭 이벤트가 모달 바깥에서 발생했을 때
  if (!rulesModal.classList.contains('hidden') && 
      !event.target.closest('.modal-container') && 
      event.target !== viewRulesBtn) {
    console.log('Document click detected outside modal');
    rulesModal.classList.add('hidden');
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    // 규칙 목록 모달이 열려있으면 닫기
    if (!rulesModal.classList.contains('hidden')) {
      console.log('ESC key pressed, closing rules modal');
      rulesModal.classList.add('hidden');
    }
    
    // 입력 모달이 열려있으면 닫기
    if (!inputModal.classList.contains('hidden')) {
      console.log('ESC key pressed, closing input modal');
      closeInputModal();
    }
    
    // 익스프레션 예제 모달이 열려있으면 닫기
    if (expressionExamplesModal && !expressionExamplesModal.classList.contains('hidden')) {
      console.log('ESC key pressed, closing expression examples modal');
      expressionExamplesModal.classList.add('hidden');
    }
  }
});

// 익스프레션 도움말 토글 기능 
if (toggleExpressionHelpBtn && expressionHelp) {
  // 기본적으로 도움말 보이기
  let isHelpVisible = true;
  
  toggleExpressionHelpBtn.addEventListener('click', () => {
    isHelpVisible = !isHelpVisible;
    
    if (isHelpVisible) {
      expressionHelp.classList.remove('collapsed');
      toggleExpressionHelpBtn.textContent = 'Help ▼';
    } else {
      expressionHelp.classList.add('collapsed');
      toggleExpressionHelpBtn.textContent = 'Help ▲';
    }
  });
}

// 익스프레션 예제 모달 기능
if (expressionExamplesBtn && expressionExamplesModal) {
  // 예제 모달 열기
  expressionExamplesBtn.addEventListener('click', () => {
    expressionExamplesModal.classList.remove('hidden');
  });
  
  // 예제 모달 닫기
  if (closeExpressionExamplesBtn) {
    closeExpressionExamplesBtn.addEventListener('click', () => {
      expressionExamplesModal.classList.add('hidden');
    });
  }
  
  // 모달 바깥 클릭 시 닫기
  expressionExamplesModal.addEventListener('click', (e) => {
    if (e.target === expressionExamplesModal) {
      expressionExamplesModal.classList.add('hidden');
    }
  });
  
  // 예제 클릭 시 클립보드 복사
  const exampleItems = document.querySelectorAll('.example-item');
  exampleItems.forEach(item => {
    item.addEventListener('click', () => {
      const expression = item.getAttribute('data-expression');
      
      // 클립보드에 복사
      copyToClipboard(expression);
      
      // 복사 표시 애니메이션
      copyStatus.classList.remove('hidden');
      setTimeout(() => {
        copyStatus.classList.add('hidden');
      }, 2000);
      
      // 표현식 입력창에 표현식 설정
      if (expressionInput) {
        expressionInput.value = expression;
        
        // 모달 닫기
        expressionExamplesModal.classList.add('hidden');
        
        // 미리보기 업데이트
        updatePreview();
      }
    });
  });
}

// 클립보드 복사 함수
function copyToClipboard(text) {
  // 현대적인 브라우저 API 사용
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
        // 대체 방법 시도
        fallbackCopyToClipboard(text);
      });
  } else {
    // 구형 브라우저 지원
    fallbackCopyToClipboard(text);
  }
}

// 클립보드 복사 대체 방법
function fallbackCopyToClipboard(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 화면에서 안 보이게 설정
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (!successful) {
        console.error('복사 실패');
      }
    } catch (err) {
      console.error('복사 중 오류 발생:', err);
    }
    
    document.body.removeChild(textArea);
  } catch (err) {
    console.error('대체 복사 방법 실패:', err);
  }
}

// 비디오 시간을 HH:MM:SS 형식으로 변환
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00:00";
  
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}