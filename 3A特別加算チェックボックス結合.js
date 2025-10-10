/*
 * kintone Checkbox to Text Automation (Simple Version)
 *
 * Copyright (c) 2025 Your Name or Company
 * Released under the MIT License.
 * https://opensource.org/licenses/mit-license.php
 */
(function() {
  'use strict';

  // --- 設定 ---
  // 連携させたいチェックボックスと文字列フィールドのペアを登録します。
  const fieldMappings = [
    {
      checkbox: 'C特別加算',
      textbox: '特別加算額備考'
    },
    {
      checkbox: 'C特別加算2',
      textbox: '特別加算額備考2'
    }
  ];
  // --- 設定ここまで ---


  // 登録されたペアの数だけ、イベント処理を自動的に設定します。
  fieldMappings.forEach(mapping => {

    // レコード作成画面と編集画面の両方で、指定したチェックボックスが変更されたら起動
    const events = [
      `app.record.create.change.${mapping.checkbox}`,
      `app.record.edit.change.${mapping.checkbox}`
    ];

    kintone.events.on(events, (event) => {
      const record = event.record;

      // チェックボックスで選択されている値（配列）を取得
      const checkedValues = record[mapping.checkbox]['value'];

      // 選択された項目を "/" (半角スラッシュ) で結合
      const resultText = checkedValues.join('/');

      // 対応する文字列フィールドに値を設定
      record[mapping.textbox]['value'] = resultText;

      // 変更を画面に反映
      return event;
    });
  });

})();