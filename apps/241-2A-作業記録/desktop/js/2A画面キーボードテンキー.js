(function () {
    'use strict';

    /***************************************************
     * ★ 設定項目 ★
     ***************************************************/
    const C_TARGET_FIELD_CODES = new Set([
        '6448245',
        '8245627',
        '8245628',
        '8245629',
        '8245630',
        '8244088'
    ]);

    const C_INC_DEC_FIELD_CODES = new Set([
        '6448245',
        '8245630',
        '8244088'
    ]);
    /***************************************************/

    // --- テンキーHTMLを一度だけ<body>に追加 ---
    if (!document.getElementById('numpad-complete-multi')) {
        const numpadHTML = `
          <div id="numpad-complete-multi" 
               style="position:absolute;visibility:hidden;opacity:0;
                      border:1px solid #ccc;background-color:#f9f9f9;
                      padding:10px;border-radius:5px;box-shadow:0 2px 5px rgba(0,0,0,0.2);
                      z-index:1000;display:flex;gap:5px;transition:opacity 0.15s ease;">
            <style>
                #numpad-complete-multi button {
                    height: 35px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    background-color: #fff;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    color: #333;
                    box-sizing: border-box;
                }
                #numpad-complete-multi button:hover { background-color: #f0f0f0; }
                #numpad-complete-multi button:active { background-color: #e0e0e0; border-color: #bbb; }
            </style>
            <!-- 数字ボタンとクリアボタン -->
            <div style="display:grid;grid-template-columns:repeat(3,50px);gap:5px;">
              <button type="button" class="num-btn-multi" aria-label="7">7</button>
              <button type="button" class="num-btn-multi" aria-label="8">8</button>
              <button type="button" class="num-btn-multi" aria-label="9">9</button>
              <button type="button" class="num-btn-multi" aria-label="4">4</button>
              <button type="button" class="num-btn-multi" aria-label="5">5</button>
              <button type="button" class="num-btn-multi" aria-label="6">6</button>
              <button type="button" class="num-btn-multi" aria-label="1">1</button>
              <button type="button" class="num-btn-multi" aria-label="2">2</button>
              <button type="button" class="num-btn-multi" aria-label="3">3</button>
              <button type="button" class="num-btn-multi" aria-label="0">0</button>
              <button type="button" id="num-clear-multi" style="grid-column: span 2;" aria-label="Clear">C</button>
            </div>
            <!-- 増減ボタン -->
            <div id="inc-dec-buttons-multi" style="display:none;flex-direction:column;gap:5px;width:50px;">
                <button type="button" id="num-up-multi" aria-label="Increment" style="flex:1;">△</button>
                <button type="button" id="num-down-multi" aria-label="Decrement" style="flex:1;">▽</button>
            </div>
          </div>`;
        document.body.insertAdjacentHTML('beforeend', numpadHTML);
    }

    const numpad = document.getElementById('numpad-complete-multi');
    const incDecButtons = document.getElementById('inc-dec-buttons-multi');
    let activeInputElement = null;

    const sanitizeValue = (value) => value.replace(/[^\d]/g, '');

    const showNumpad = () => {
        numpad.style.visibility = 'visible';
        numpad.style.opacity = '1';
    };

    const hideNumpad = () => {
        numpad.style.opacity = '0';
        setTimeout(() => { numpad.style.visibility = 'hidden'; }, 150);
    };

    const handleFocusIn = (e) => {
        const parentControl = e.target.closest('[class*="control-value-gaia"]');
        if (!parentControl) return;

        const matchedId = Array.from(C_TARGET_FIELD_CODES).find(id => parentControl.classList.contains(`value-${id}`));
        if (!matchedId || e.target.tagName !== 'INPUT') return;

        activeInputElement = e.target;
        showNumpad();

        if (C_INC_DEC_FIELD_CODES.has(matchedId)) {
            incDecButtons.style.display = 'flex';
        } else {
            incDecButtons.style.display = 'none';
        }

        const rect = activeInputElement.getBoundingClientRect();
        const numpadHeight = numpad.offsetHeight;
        const windowHeight = window.innerHeight;
        const topPosition = (rect.bottom + numpadHeight + 2 > windowHeight && rect.top > numpadHeight + 2)
            ? rect.top + window.scrollY - numpadHeight - 2
            : rect.bottom + window.scrollY + 2;

        numpad.style.top = `${topPosition}px`;
        numpad.style.left = `${rect.left + window.scrollX}px`;

        if (activeInputElement.value) activeInputElement.select();
    };

    const handleDocClick = (e) => {
        if (numpad.style.visibility === 'visible' && !numpad.contains(e.target) && e.target !== activeInputElement) {
            hideNumpad();
            activeInputElement = null;
        }
    };

    const handleNumpadClick = (e) => {
        if (!activeInputElement || !e.target.closest('button')) return;
        let currentValue = sanitizeValue(activeInputElement.value || '');
        const button = e.target.closest('button');

        if (button.classList.contains('num-btn-multi')) {
            if (activeInputElement.selectionStart === 0 &&
                activeInputElement.selectionEnd === currentValue.length &&
                currentValue !== '') currentValue = '';
            currentValue += button.innerText;
        } else if (button.id === 'num-clear-multi') {
            currentValue = '';
        } else if (button.id === 'num-up-multi') {
            currentValue = (parseInt(currentValue || '0', 10) + 1).toString();
        } else if (button.id === 'num-down-multi') {
            const num = parseInt(currentValue || '0', 10);
            currentValue = num > 0 ? (num - 1).toString() : '0';
        }

        activeInputElement.value = currentValue;
        activeInputElement.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const handleNumpadMouseDown = (e) => e.preventDefault();

    if (!window.customNumpadBaseListenersAttached) {
        numpad.addEventListener('mousedown', handleNumpadMouseDown);
        numpad.addEventListener('click', handleNumpadClick);
        window.customNumpadBaseListenersAttached = true;
    }

    const attachNumpadListeners = (event) => {
        if (window.customNumpadDocumentListenersAttached) return event;
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('click', handleDocClick, true);
        window.customNumpadDocumentListenersAttached = true;
        return event;
    };

    const detachNumpadListeners = (event) => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('click', handleDocClick, true);
        window.customNumpadDocumentListenersAttached = false;
        hideNumpad();
        activeInputElement = null;
        return event;
    };

    kintone.events.on(['app.record.create.show', 'app.record.edit.show', 'app.record.index.edit.show'], attachNumpadListeners);
    kintone.events.on(['app.record.index.show', 'app.record.detail.show'], detachNumpadListeners);
})();
