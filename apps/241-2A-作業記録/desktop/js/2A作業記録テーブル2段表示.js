(function() {
  'use strict';

  // --------------------------------------------------------------------------------
  // ★★★ 設定項目 ★★★
  // ご自身のアプリのフィールドコードに合わせて書き換えてください。
  // --------------------------------------------------------------------------------
  const TABLE_FIELD_CODE = 'T作業記録';       // テーブルのフィールドコード
  const SHAPE_FIELD_CODE = 'R切断形状3';      // 「切断形状」ラジオボタン
  const DIAMETER_FIELD_CODE = '径3';        // 「径」数値フィールド
  const VERTICAL_FIELD_CODE = '縦3';        // 「縦」数値フィールド
  const HORIZONTAL_FIELD_CODE = '横3';      // 「横」数値フィールド
  const STATUS_FIELD_CODE = 'R現況';          // 「現況」ラジオボタン
  // --------------------------------------------------------------------------------

  // ★新規：フィールドコードとフィールドID（DOMのclass名で使われる）のマッピングを保持するオブジェクト
  const fieldCodeToIdMap = {};
  let mapInitialized = false;

  /**
   * ★新規：レコードデータからフィールドコードとIDのマッピングを初回に作成する関数
   * @param {object} record - kintoneのレコードオブジェクト
   */
  function initializeFieldMap(record) {
    if (mapInitialized || !record[TABLE_FIELD_CODE] || !record[TABLE_FIELD_CODE].value[0]) return;
    
    const firstRowFields = record[TABLE_FIELD_CODE].value[0].value;
    for (const fieldCode in firstRowFields) {
      // レコードオブジェクトから `lookup.id` を取得してマップに保存
      if (firstRowFields[fieldCode].lookup && firstRowFields[fieldCode].lookup.id) {
        fieldCodeToIdMap[fieldCode] = firstRowFields[fieldCode].lookup.id;
      }
    }
    mapInitialized = true;
  }

  /**
   * 「切断形状」の値に応じて"レコードデータ"を更新する関数
   * @param {object} record - kintoneのレコードオブジェクト
   */
  function updateRecordState(record) {
    if (!record[TABLE_FIELD_CODE] || !record[TABLE_FIELD_CODE].value) {
      return;
    }
    const tableRows = record[TABLE_FIELD_CODE].value;

    tableRows.forEach(function(row) {
      if (!row.value[SHAPE_FIELD_CODE]) return;
      const shape = row.value[SHAPE_FIELD_CODE].value;
      const d = row.value[DIAMETER_FIELD_CODE];
      const v = row.value[VERTICAL_FIELD_CODE];
      const h = row.value[HORIZONTAL_FIELD_CODE];
      
      d.disabled = (shape === '□' || shape === '-');
      v.disabled = (shape === '◯' || shape === '-');
      h.disabled = (shape === '◯' || shape === '-');

      if(d.disabled) d.value = null;
      if(v.disabled) v.value = null;
      if(h.disabled) h.value = null;
    });
  }
  
  /**
   * ★修正：レコードデータに基づいて"画面のフィールド"の有効/無効を更新する関数
   */
  function updateDomDisabledState() {
    const record = kintone.app.record.get().record;
    if (!record[TABLE_FIELD_CODE] || !record[TABLE_FIELD_CODE].value) return;

    const tableRowsData = record[TABLE_FIELD_CODE].value;
    const tableElement = kintone.app.record.getFieldElement(TABLE_FIELD_CODE);
    if (!tableElement) return;

    const rowElements = tableElement.querySelectorAll('tbody > tr');
    tableRowsData.forEach(function(rowData, index) {
      const rowElement = rowElements[index];
      if(!rowElement) return;

      // ★修正：フィールドコードとIDのマップを使って、より安定したDOMクエリを実行
      const getInputElement = (fieldCode, rowEl) => {
          const fieldId = fieldCodeToIdMap[fieldCode];
          if (!fieldId) return null; // マップにIDがなければ何もしない
          // '.field-xxxx' というクラス名で要素を特定
          const fieldWrapper = rowEl.querySelector('.field-' + fieldId);
          return fieldWrapper ? fieldWrapper.querySelector('input') : null;
      };

      const diameterInput = getInputElement(DIAMETER_FIELD_CODE, rowElement);
      const verticalInput = getInputElement(VERTICAL_FIELD_CODE, rowElement);
      const horizontalInput = getInputElement(HORIZONTAL_FIELD_CODE, rowElement);

      if(diameterInput) diameterInput.disabled = rowData.value[DIAMETER_FIELD_CODE].disabled;
      if(verticalInput) verticalInput.disabled = rowData.value[VERTICAL_FIELD_CODE].disabled;
      if(horizontalInput) horizontalInput.disabled = rowData.value[HORIZONTAL_FIELD_CODE].disabled;
    });
  }

  /**
   * テーブルのヘッダーラベルを各セルのdata-label属性に設定する関数
   */
  function setTableLabels(tableSelector) {
    const headers = document.querySelectorAll(tableSelector + ' .subtable-header-gaia th');
    if (headers.length === 0) return;
    const headerLabels = {};
    headers.forEach(function(th) {
      const labelClass = th.className.match(/label-\d+/);
      if (labelClass) {
        headerLabels[labelClass[0].split('-')[1]] = th.innerText.trim().replace('*', '').replace(/\n/g, ' ');
      }
    });
    document.querySelectorAll(tableSelector + ' tbody tr').forEach(function(row) {
      row.querySelectorAll('td').forEach(function(cell) {
        const fieldDiv = cell.querySelector('[class*="field-"]');
        if (fieldDiv) {
          const fieldClass = fieldDiv.className.match(/field-\d+/);
          if (fieldClass) {
            const fieldId = fieldClass[0].split('-')[1];
            if (headerLabels[fieldId]) fieldDiv.setAttribute('data-label', headerLabels[fieldId]);
          }
        }
      });
    });
  }

  /**
   * 時刻入力ボタンを追加する関数
   */
  function addTimeEntryButtons(tableSelector) {
    document.querySelectorAll(tableSelector + ' .field-8245623, ' + tableSelector + ' .field-8245624').forEach(function(field) {
      if (field.querySelector('.time-stamp-button')) return;
      const button = document.createElement('button');
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20px" height="20px"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M13 7h-2v6h6v-2h-4z"/></svg>';
      button.className = 'time-stamp-button';
      button.type = 'button';
      button.addEventListener('click', function() {
        const now = new Date();
        const timeString = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
        const input = field.querySelector('input[type="text"]');
        if (input) {
            input.value = timeString;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      field.appendChild(button);
    });
  }

  /**
   * 「R現況」の値に応じて時刻入力ボタンの表示を管理する関数
   */
  function manageTimeButtons() {
    document.querySelectorAll('.time-stamp-button').forEach(btn => btn.remove());
    const record = kintone.app.record.get().record;
    const status = record[STATUS_FIELD_CODE] ? record[STATUS_FIELD_CODE].value : null;
    const allowedStatuses = ['作業中 →', '作業完了/チェック待ち →', 'チェック完了/出荷待ち →'];

    if (allowedStatuses.includes(status)) {
      addTimeEntryButtons('.subtable-8245632');
    }
  }

  // kintoneイベントリスナー
  const events = [
    'app.record.create.show', 'app.record.edit.show', 'app.record.detail.show',
    'app.record.create.change.' + TABLE_FIELD_CODE, 'app.record.edit.change.' + TABLE_FIELD_CODE,
    'app.record.create.change.' + SHAPE_FIELD_CODE, 'app.record.edit.change.' + SHAPE_FIELD_CODE,
    'app.record.create.change.' + STATUS_FIELD_CODE, 'app.record.edit.change.' + STATUS_FIELD_CODE
  ];

  kintone.events.on(events, function(event) {
    // ★修正：最初に必ずフィールドマップを初期化
    initializeFieldMap(event.record);
    
    if (event.type !== 'app.record.detail.show') {
      updateRecordState(event.record);
    }

    setTimeout(function() {
      setTableLabels('.subtable-8245632');
      manageTimeButtons();
      if (event.type !== 'app.record.detail.show') {
        updateDomDisabledState();
      }
    }, 100);

    return event;
  });

})();

