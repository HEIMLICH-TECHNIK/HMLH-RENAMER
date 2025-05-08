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

// Variables
let selectedFiles = [];
let currentMethod = 'pattern'; // Default method
let wordRules = []; // For word selection method
let selectedWordTokens = []; // Store selections for word method
let wordPatterns = []; // Store patterns for batch apply

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
patternInput.addEventListener('input', updatePreview);
findText.addEventListener('input', updatePreview);
replaceText.addEventListener('input', updatePreview);
caseSensitive.addEventListener('change', updatePreview);
regexPattern.addEventListener('input', updatePreview);
regexReplacement.addEventListener('input', updatePreview);

// Apply button click
applyBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;
  
  try {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Processing...';
    
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
        
        showResults(results);
        applyBtn.textContent = 'Rename Files';
        applyBtn.disabled = selectedFiles.length === 0;
        return; // Skip the normal flow for word method
    }
    
    const results = await window.api.renameFiles(selectedFiles, config);
    
    showResults(results);
  } catch (error) {
    alert(`Error: ${error.message}`);
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
  // Clear files that were successfully renamed
  const successItems = document.querySelectorAll('.result-item.success');
  if (successItems.length > 0) {
    selectedFiles = [];
    updateUI();
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  selectedFiles = [];
  updateUI();
  resultArea.classList.add('hidden');
});

// Add word rule event listener
if (addWordRuleBtn) {
  addWordRuleBtn.addEventListener('click', () => {
    addWordRule();
    updatePreview();
  });
}

// Utility Functions
function handleFiles(fileList) {
  // Convert FileList object to array
  const files = Array.from(fileList).map(file => file.path);
  
  if (files.length > 0) {
    selectedFiles = [...selectedFiles, ...files]; // Add to existing files
    updateUI();
  }
}

function updateUI() {
  if (selectedFiles.length === 0) {
    mainContent.classList.add('empty');
    emptyDropArea.style.display = 'flex';
    filesPreview.classList.add('hidden');
  } else {
    mainContent.classList.remove('empty');
    emptyDropArea.style.display = 'none';
    filesPreview.classList.remove('hidden');
    
    // Update the file count
    fileCount.textContent = selectedFiles.length === 1 
      ? '1 file selected' 
      : `${selectedFiles.length} files selected`;
    
    // Update the preview
    updatePreview();
  }
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

function updatePreview() {
  if (selectedFiles.length === 0) {
    previewArea.innerHTML = '<p>Select files to see preview</p>';
    return;
  }
  
  previewArea.innerHTML = '';
  
  const previewList = document.createElement('div');
  previewList.className = 'preview-list';
  
  selectedFiles.forEach((file, index) => {
    const oldName = getFileName(file);
    const newName = generateNewName(file, index);
    
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
      selectedFiles.splice(index, 1);
      updateUI();
    });
    
    previewItem.appendChild(oldNameEl);
    previewItem.appendChild(arrow);
    previewItem.appendChild(newNameEl);
    previewItem.appendChild(removeBtn);
    previewList.appendChild(previewItem);
  });
  
  previewArea.appendChild(previewList);
}

function generateNewName(filePath, index) {
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
  }
  
  return newName;
}

function applyPattern(baseName, fileExt, index) {
  let pattern = patternInput.value || '{name}';
  
  // Format sequential number (using 1-based indexing)
  const numValue = index + 1;
  let formattedNumber = numValue.toString();
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  
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
  
  // Add to rules array
  wordRules.push({
    id: ruleId,
    action: 'replace',
    value: '',
    getAction: () => actionSelect.value,
    getValue: () => valueInput.value
  });
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

// Initialize UI
updateUI();