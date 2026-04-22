/*
 * ラジオボタンの値に応じてフィールドスタイル等を変更する for kintone
 * Copyright (c) 2024 Your Name or Company
 * Released under the MIT License.
 *
 * Ver. 5: スペース要素のテキスト変更、中央揃え、フォントサイズ拡大
 */
(function() {
  'use strict';

  // --- 設定項目 ---
  // 各フィールドのフィールドコードを正確に入力してください
  const RADIO_BUTTON_FIELD_CODE = '時間面積選択';
  const F_KITEI_TANKA_FIELD_CODE = 'F既定単価設定';

  // メッセージを表示するスペース要素のID
  const MESSAGE_SPACE_ID = 'txt1';

  // '時間計算'が選択されたときにスタイルを変更する【ラベル】のクラス名
  const TIME_CALC_LABELS = ['label-8238613', 'label-8238614'];
  // '時間計算'が選択されたときにスタイルを変更する【値】のクラス名
  const TIME_CALC_VALUES = ['value-8238613', 'value-8238614'];

  // '面積・既定計算'が選択されたときにスタイルを変更する【ラベル】のクラス名
  const AREA_CALC_LABELS = ['label-8238639', 'label-8238642'];
  // '面積・既定計算'が選択されたときにスタイルを変更する【値】のクラス名
  const AREA_CALC_VALUES = ['value-8238639', 'value-8238642'];
  // --- 設定項目ここまで ---


  /**
   * フィールドのラベルと値のスタイルを更新する関数
   * @param {string} selectedValue - ラジオボタンで選択されている値
   */
  function updateFieldStyles(selectedValue) {
    const allLabels = TIME_CALC_LABELS.concat(AREA_CALC_LABELS);
    const allValues = TIME_CALC_VALUES.concat(AREA_CALC_VALUES);
    const allClasses = allLabels.concat(allValues);

    allClasses.forEach(cssClass => {
      const elements = document.getElementsByClassName(cssClass);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        el.style.fontWeight = 'normal';
        el.style.textDecoration = 'none';
        el.style.fontSize = '';
      }
    });

    let targetsToStyle = [];
    if (selectedValue === '時間計算') {
      targetsToStyle = TIME_CALC_LABELS.concat(TIME_CALC_VALUES);
    } else if (selectedValue === '面積・既定計算') {
      targetsToStyle = AREA_CALC_LABELS.concat(AREA_CALC_VALUES);
    }

    targetsToStyle.forEach(cssClass => {
      const elements = document.getElementsByClassName(cssClass);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        el.style.fontWeight = 'bold';
        el.style.textDecoration = 'underline';
        el.style.fontSize = '110%';
      }
    });
  }

  /**
   * スペース要素にメッセージを表示・非表示する関数
   * @param {object} record - kintoneのレコードオブジェクト
   */
  function updateSpaceMessage(record) {
    const spaceEl = kintone.app.record.getSpaceElement(MESSAGE_SPACE_ID);
    if (!spaceEl) { return; }

    if (record[F_KITEI_TANKA_FIELD_CODE] && record[F_KITEI_TANKA_FIELD_CODE].value === '1') {
      // --- ここから修正 ---
      // テキストとスタイルを設定
      spaceEl.innerText = '※既定価格適用設定';
      spaceEl.style.fontWeight = 'bold';
      spaceEl.style.textDecoration = 'none'; // デザインを考慮し下線は解除（必要であれば 'underline' に変更してください）
      spaceEl.style.fontSize = '120%'; // フォントサイズを拡大

      // 中央揃えのためのスタイルを設定
      spaceEl.style.display = 'flex';
      spaceEl.style.justifyContent = 'center'; // 水平方向の中央揃え
      spaceEl.style.alignItems = 'center';     // 垂直方向の中央揃え
      spaceEl.style.height = '100%';           // 親要素の高さ全体を使う
      // --- ここまで修正 ---
    } else {
      // 値が1以外ならメッセージとスタイルをリセット
      spaceEl.innerText = '';
      spaceEl.style.display = '';
      spaceEl.style.justifyContent = '';
      spaceEl.style.alignItems = '';
      spaceEl.style.height = '';
      spaceEl.style.fontWeight = '';
      spaceEl.style.textDecoration = '';
      spaceEl.style.fontSize = '';
    }
  }

  const events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show',
    'app.record.create.change.' + RADIO_BUTTON_FIELD_CODE,
    'app.record.edit.change.' + RADIO_BUTTON_FIELD_CODE,
    'app.record.create.change.' + F_KITEI_TANKA_FIELD_CODE,
    'app.record.edit.change.' + F_KITEI_TANKA_FIELD_CODE
  ];

  kintone.events.on(events, function(event) {
    let record = event.record;

    if (event.type === 'app.record.create.show') {
      if (record[F_KITEI_TANKA_FIELD_CODE].value === '1') {
        record[RADIO_BUTTON_FIELD_CODE].value = '面積・既定計算';
      }
    }

    if (event.type === 'app.record.detail.show') {
      setTimeout(function() {
        const detailRecord = kintone.app.record.get().record;
        updateFieldStyles(detailRecord[RADIO_BUTTON_FIELD_CODE].value);
        updateSpaceMessage(detailRecord);
      }, 0);
    } else {
      updateFieldStyles(record[RADIO_BUTTON_FIELD_CODE].value);
      updateSpaceMessage(record);
    }
    
    return event;
  });
})();