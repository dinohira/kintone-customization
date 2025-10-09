(function() {
  'use strict';

  // --- 設定項目 ---
  // ご自身のアプリのフィールドコードと「ラベル名」に合わせて書き換えてください
  const TABLE_FIELD_CODE = 'T運転記録';       // テーブルのフィールドコード
  const DEPARTURE_FIELD_CODE = '出発';         // ★時刻を入力したい「時刻」フィールド
  const ARRIVAL_FIELD_CODE = '到着';         // ★時刻を入力したい「時刻」フィールド
  
  // ▼ ボタンを配置する列のヘッダー名（kintoneのフォーム設定画面の「フィールド名」）を正確に入力してください
  const DEPARTURE_COLUMN_LABEL = '出発入力';
  const ARRIVAL_COLUMN_LABEL = '到着入力';

  // ▼ 時刻フィールドのヘッダー名（フィールド名）を正確に入力してください
  const DEPARTURE_TIME_LABEL = '出発';
  const ARRIVAL_TIME_LABEL = '到着';
  // --- 設定はここまで ---

  const BUTTON_CLASS_NAME = 'clock'; // ボタンに適用するクラス名

  /**
   * ヘッダーのテキスト（ラベル）を頼りにテーブル要素そのものを探し出す関数
   */
  const findTableByHeaderLabel = () => {
    const allTh = document.querySelectorAll('th');
    for (const th of allTh) {
      const labelText = th.textContent.trim();
      if (labelText === DEPARTURE_COLUMN_LABEL || labelText === ARRIVAL_COLUMN_LABEL) {
        const table = th.closest('table.subtable-gaia');
        if (table) return table;
      }
    }
    return null;
  };

  /**
   * ヘッダーのテキストを元に、対象の列が何番目か（0から始まるインデックス）を返す
   */
  const findColumnIndexByLabel = (tableElement, label) => {
    const headers = tableElement.querySelectorAll('thead th');
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].textContent.trim() === label) {
        return i;
      }
    }
    return -1;
  };

  /**
   * ボタンの配置と、フィールドの有効/無効状態を更新するメインの関数
   */
  const updateTableUI = () => {
    const tableElement = findTableByHeaderLabel();
    if (!tableElement) { return; }

    const departureColIndex = findColumnIndexByLabel(tableElement, DEPARTURE_COLUMN_LABEL);
    const arrivalColIndex = findColumnIndexByLabel(tableElement, ARRIVAL_COLUMN_LABEL);
    const departureTimeColIndex = findColumnIndexByLabel(tableElement, DEPARTURE_TIME_LABEL);
    const arrivalTimeColIndex = findColumnIndexByLabel(tableElement, ARRIVAL_TIME_LABEL);

    // ▼▼▼ 修正点：ヘッダーの幅を50pxに調整する ▼▼▼
    const allTh = tableElement.querySelectorAll('thead th');
    if (departureColIndex !== -1 && allTh[departureColIndex]) {
      allTh[departureColIndex].style.width = '50px';
      const innerSpan = allTh[departureColIndex].querySelector('.subtable-label-inner-gaia');
      if (innerSpan) innerSpan.style.minWidth = '50px';
    }
    if (arrivalColIndex !== -1 && allTh[arrivalColIndex]) {
      allTh[arrivalColIndex].style.width = '50px';
      const innerSpan = allTh[arrivalColIndex].querySelector('.subtable-label-inner-gaia');
      if (innerSpan) innerSpan.style.minWidth = '50px';
    }
    // ▲▲▲ 修正点ここまで ▲▲▲

    const record = kintone.app.record.get().record;
    if (!record[TABLE_FIELD_CODE] || !record[TABLE_FIELD_CODE].value) return;
    
    const tableRows = record[TABLE_FIELD_CODE].value;
    const dataRowElements = tableElement.querySelectorAll('tbody tr');

    tableRows.forEach((row, index) => {
      const currentRowElement = dataRowElements[index];
      if (!currentRowElement) return;

      const setupButtonCell = (colIndex, targetFieldCode) => {
        if (colIndex !== -1) {
          const targetTd = currentRowElement.children[colIndex];
          if (targetTd && !targetTd.querySelector(`.${BUTTON_CLASS_NAME}`)) {
            targetTd.innerHTML = '';
            const button = createTimeButton(index, targetFieldCode);
            targetTd.appendChild(button);
            targetTd.style.display = 'flex';
            targetTd.style.justifyContent = 'center';
            targetTd.style.alignItems = 'center';
            targetTd.style.height = '50px'; 
          }
          return targetTd;
        }
        return null;
      };

      const departureTd = setupButtonCell(departureColIndex, DEPARTURE_FIELD_CODE);
      const arrivalTd = setupButtonCell(arrivalColIndex, ARRIVAL_FIELD_CODE);

      // --- ボタンとフィールドの状態を更新 ---
      const prevArrivalValue = (index > 0) ? tableRows[index - 1].value[ARRIVAL_FIELD_CODE].value : 'filled';
      const isDepartureDisabled = index > 0 && !prevArrivalValue;
      
      if (departureTd) departureTd.querySelector('button').disabled = isDepartureDisabled;
      const departureTimeInput = currentRowElement.children[departureTimeColIndex]?.querySelector('.input-time-text-cybozu');
      if (departureTimeInput) departureTimeInput.disabled = isDepartureDisabled;
      
      const departureValue = row.value[DEPARTURE_FIELD_CODE].value;
      const isArrivalDisabled = !departureValue;

      if (arrivalTd) arrivalTd.querySelector('button').disabled = isArrivalDisabled;
      const arrivalTimeInput = currentRowElement.children[arrivalTimeColIndex]?.querySelector('.input-time-text-cybozu');
      if (arrivalTimeInput) arrivalTimeInput.disabled = isArrivalDisabled;
    });
  };

  /**
   * 時刻入力ボタンのHTML要素を生成するヘルパー関数
   */
  const createTimeButton = (rowIndex, targetTimeFieldCode) => {
    const button = document.createElement('button');
    button.className = BUTTON_CLASS_NAME; // CSSでデザインを適用するためのクラス
    button.type = 'button';
    
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    `;
    button.innerHTML = svgIcon;

    button.onclick = (e) => {
      e.preventDefault();
      const date = new Date();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const now = `${hours}:${minutes}`;

      const currentRecord = kintone.app.record.get();
      currentRecord.record[TABLE_FIELD_CODE].value[rowIndex].value[targetTimeFieldCode].value = now;
      kintone.app.record.set(currentRecord);
    };
    
    return button;
  };

  /**
   * 到着時刻が妥当かチェックし、必要であればアラートを表示する関数
   */
  const validateArrivalTime = (event) => {
    if (!event.changes || !event.changes.row) return;
    const changedRow = event.changes.row.value;
    const departureTime = changedRow[DEPARTURE_FIELD_CODE].value;
    const arrivalTime = changedRow[ARRIVAL_FIELD_CODE].value;
    if (departureTime && arrivalTime && arrivalTime < departureTime) {
      alert('到着時刻が出発時刻より前にセットされました。到着時刻の確認をしてください');
    }
  };

  /**
   * 対象要素が表示されるまで待ってから処理を実行する関数
   */
  const runWhenReady = (callback, maxRetries = 15, interval = 200) => {
    let attempt = 0;
    const intervalId = setInterval(() => {
      attempt++;
      const tableElement = findTableByHeaderLabel();
      if (tableElement) {
        clearInterval(intervalId);
        callback();
      } else if (attempt >= maxRetries) {
        clearInterval(intervalId);
      }
    }, interval);
  };

  const events = [
    'app.record.create.show', 'app.record.edit.show',
    `app.record.create.change.${TABLE_FIELD_CODE}`, `app.record.edit.change.${TABLE_FIELD_CODE}`,
    `app.record.create.change.${DEPARTURE_FIELD_CODE}`, `app.record.edit.change.${DEPARTURE_FIELD_CODE}`,
    `app.record.create.change.${ARRIVAL_FIELD_CODE}`, `app.record.edit.change.${ARRIVAL_FIELD_CODE}`,
  ];

  kintone.events.on(events, (event) => {
    if (event.type.includes(`change.${ARRIVAL_FIELD_CODE}`)) {
      validateArrivalTime(event);
    }
    runWhenReady(updateTableUI);
    return event;
  });

})();

