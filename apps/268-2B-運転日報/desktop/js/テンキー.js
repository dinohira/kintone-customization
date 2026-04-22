(function () {
    'use strict';

    /***************************************************
     * ★ 設定項目 ★
     ***************************************************/
    // テンキーを適用したい「テーブル内の数値フィールド」のフィールドコードを、
    // [] の中にカンマ区切りで追加してください。
    const C_TARGET_FIELD_CODES = [
        '8244940'  // T分納記録テーブルのフィールドを追加
    ];
    /***************************************************/

    // スクリプトが重複して実行されるのを防ぐ
    if (window.customNumpadCompleteMulti) {
        return;
    }
    window.customNumpadCompleteMulti = true;

    // テンキーのHTMLレイアウト
    const numpadHTML = `
      <div id="numpad-complete-multi" style="display: none; position: absolute; border: 1px solid #ccc; background-color: #f9f9f9; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 150px;">
          <button type="button" class="num-btn-multi">7</button> <button type="button" class="num-btn-multi">8</button> <button type="button" class="num-btn-multi">9</button>
          <button type="button" class="num-btn-multi">4</button> <button type="button" class="num-btn-multi">5</button> <button type="button" class="num-btn-multi">6</button>
          <button type="button" class="num-btn-multi">1</button> <button type="button" class="num-btn-multi">2</button> <button type="button" class="num-btn-multi">3</button>
          <button type="button" class="num-btn-multi">0</button>
          <button type="button" id="num-clear-multi" style="grid-column: span 2;">C</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', numpadHTML);

    const numpad = document.getElementById('numpad-complete-multi');
    let activeInputElement = null;

    // --- イベント処理の本体 ---
    const handleFocusIn = (e) => {
        // 設定されたフィールドコードのいずれかに一致するかをチェック
        const isTargetField = C_TARGET_FIELD_CODES.some(code => e.target.closest(`.control-value-gaia.value-${code}`));

        if (e.target.tagName === 'INPUT' && isTargetField) {
            activeInputElement = e.target;
            const rect = activeInputElement.getBoundingClientRect();
            numpad.style.top = (rect.bottom + window.scrollY + 2) + 'px';
            numpad.style.left = rect.left + window.scrollX + 'px';
            numpad.style.display = 'block';

            if (activeInputElement.value) {
                activeInputElement.select();
            }
        }
    };

    const handleDocClick = (e) => {
        if (numpad.style.display === 'block' && !numpad.contains(e.target) && e.target !== activeInputElement) {
            numpad.style.display = 'none';
        }
    };

    const handleNumpadClick = (e) => {
        if (!activeInputElement) return;

        let currentValue = activeInputElement.value || '';

        if (activeInputElement.selectionStart === 0 && activeInputElement.selectionEnd === currentValue.length && currentValue !== '') {
            currentValue = '';
        }

        if (e.target.classList.contains('num-btn-multi')) {
            currentValue += e.target.innerText;
        } else if (e.target.id === 'num-clear-multi') {
            currentValue = '';
        }

        activeInputElement.value = currentValue;
        activeInputElement.dispatchEvent(new Event('change', { bubbles: true }));
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('click', handleDocClick, true);
    numpad.addEventListener('click', handleNumpadClick);

})();
