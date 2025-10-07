(function() {
    'use strict';

    /***************************************************
     * ★ 設定項目 ★
     ***************************************************/
    // 【1】QWERTYキーボード + テンキー を適用したいフィールド
    const QWERTY_KEYBOARD_FIELDS = [
        '5676058' // テキストボックスなど
    ];

    // 【2】テンキーのみを適用したいフィールド
    const NUMPAD_ONLY_FIELDS = [
        '5676059',
        '5676075',
        '5676076',
        '5676089',
        '8243878',
        '8243879'
    ];
    /***************************************************/

    // スクリプトが重複して実行されるのを防ぐ
    if (window.customKeyboardManager) {
        return;
    }
    window.customKeyboardManager = true;

    // --- 1. QWERTY + テンキーのHTML ---
    const qwertyKeyboardHTML = `
      <div id="custom-keyboard-qwerty" style="display: none; position: absolute; border: 1px solid #ccc; background-color: #f9f9f9; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000; font-family: sans-serif;">
        <div style="display: flex; gap: 10px;">
          <div id="qwerty-part">
            <div class="keyboard-row">${'QWERTYUIOP'.split('').map(k => `<button type="button" class="key-btn">${k}</button>`).join('')}</div>
            <div class="keyboard-row" style="margin-left: 15px;">${'ASDFGHJKL'.split('').map(k => `<button type="button" class="key-btn">${k}</button>`).join('')}</div>
            <div class="keyboard-row" style="margin-left: 30px;">${'ZXCVBNM'.split('').map(k => `<button type="button" class="key-btn">${k}</button>`).join('')}</div>
            <div class="keyboard-row">
                <button type="button" class="special-key" data-key="backspace" style="width: 198px;">Backspace</button>
                <button type="button" class="special-key" data-key="space" style="width: 198px;">Space</button>
            </div>
          </div>
          <div id="numpad-part-for-qwerty">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 150px;">
              <button type="button" class="key-btn">7</button> <button type="button" class="key-btn">8</button> <button type="button" class="key-btn">9</button>
              <button type="button" class="key-btn">4</button> <button type="button" class="key-btn">5</button> <button type="button" class="key-btn">6</button>
              <button type="button" class="key-btn">1</button> <button type="button" class="key-btn">2</button> <button type="button" class="key-btn">3</button>
              <button type="button" class="key-btn" style="grid-column: span 2;">0</button>
              <button type="button" class="special-key" data-key="clear">C</button>
            </div>
          </div>
        </div>
        <style>
            #custom-keyboard-qwerty .keyboard-row { display: flex; gap: 5px; margin-bottom: 5px; }
            #custom-keyboard-qwerty button { height: 40px; min-width: 40px; padding: 0 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; cursor: pointer; font-size: 14px; font-weight: bold; }
            #custom-keyboard-qwerty button:hover { background-color: #e0e0e0; }
            #custom-keyboard-qwerty button:active { background-color: #ccc; transform: translateY(1px); }
        </style>
      </div>`;

    // --- 2. テンキーのみのHTML ---
    const numpadOnlyHTML = `
      <div id="custom-keyboard-numpad" style="display: none; position: absolute; border: 1px solid #ccc; background-color: #f9f9f9; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 150px;">
          <button type="button" class="num-btn">7</button> <button type="button" class="num-btn">8</button> <button type="button" class="num-btn">9</button>
          <button type="button" class="num-btn">4</button> <button type="button" class="num-btn">5</button> <button type="button" class="num-btn">6</button>
          <button type="button" class="num-btn">1</button> <button type="button" class="num-btn">2</button> <button type="button" class="num-btn">3</button>
          <button type="button" class="num-btn">0</button>
          <button type="button" data-key="clear" style="grid-column: span 2;">C</button>
        </div>
        <style>
            #custom-keyboard-numpad button { height: 40px; min-width: 40px; padding: 0 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; cursor: pointer; font-size: 14px; font-weight: bold; }
            #custom-keyboard-numpad button:hover { background-color: #e0e0e0; }
            #custom-keyboard-numpad button:active { background-color: #ccc; transform: translateY(1px); }
        </style>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', qwertyKeyboardHTML);
    document.body.insertAdjacentHTML('beforeend', numpadOnlyHTML);

    const qwertyKeyboard = document.getElementById('custom-keyboard-qwerty');
    const numpadOnly = document.getElementById('custom-keyboard-numpad');
    let activeInputElement = null;
    let activeKeyboard = null;

    // キーボードを表示する共通関数
    const showKeyboard = (keyboardEl, inputEl) => {
        const rect = inputEl.getBoundingClientRect();
        keyboardEl.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        keyboardEl.style.left = rect.left + window.scrollX + 'px';
        keyboardEl.style.display = 'block';
        if (inputEl.value) {
            inputEl.select();
        }
    };

    // --- イベント処理の本体 ---

    // フィールドにフォーカスした時の処理
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        // いったん両方のキーボードを隠す
        qwertyKeyboard.style.display = 'none';
        numpadOnly.style.display = 'none';
        activeKeyboard = null;

        // QWERTY対象フィールドか判定
        if (QWERTY_KEYBOARD_FIELDS.some(code => target.closest(`.value-${code}`))) {
            activeInputElement = target;
            activeKeyboard = qwertyKeyboard;
            showKeyboard(activeKeyboard, activeInputElement);
            return;
        }

        // テンキーのみ対象フィールドか判定
        if (NUMPAD_ONLY_FIELDS.some(code => target.closest(`.value-${code}`))) {
            activeInputElement = target;
            activeKeyboard = numpadOnly;
            showKeyboard(activeKeyboard, activeInputElement);
            return;
        }
    }, true);

    // キーボードの外側をクリックした時の処理
    document.addEventListener('click', (e) => {
        if (activeKeyboard && !activeKeyboard.contains(e.target) && e.target !== activeInputElement) {
            activeKeyboard.style.display = 'none';
            activeKeyboard = null;
            activeInputElement = null;
        }
    }, true);

    // キーボードのボタンをクリックした時の共通処理
    const handleKeyboardClick = (e) => {
        if (!activeInputElement) return;
        
        const target = e.target.closest('button');
        if (!target) return;

        let currentValue = activeInputElement.value || '';

        // 入力時にフィールドが全選択されていたら、リセット
        if (activeInputElement.selectionStart === 0 && activeInputElement.selectionEnd === currentValue.length && currentValue !== '') {
            currentValue = '';
        }

        // --- 入力処理 ---
        if (target.classList.contains('key-btn') || target.classList.contains('num-btn')) {
            currentValue += target.innerText;
        } else {
            const keyType = target.dataset.key;
            if (keyType === 'clear') {
                currentValue = '';
            } else if (keyType === 'backspace') {
                currentValue = currentValue.slice(0, -1);
            } else if (keyType === 'space') {
                currentValue += ' ';
            }
        }

        activeInputElement.value = currentValue;
        activeInputElement.dispatchEvent(new Event('change', { bubbles: true }));
        activeInputElement.focus();
    };
    
    // 各キーボードにイベントリスナーを登録
    [qwertyKeyboard, numpadOnly].forEach(keyboard => {
        // マウスダウンでフォーカスが外れるのを防ぐ
        keyboard.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        // クリックイベントで入力処理を呼び出す
        keyboard.addEventListener('click', handleKeyboardClick);
    });

})();