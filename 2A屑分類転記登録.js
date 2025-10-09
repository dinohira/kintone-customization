/*
 * kintone-lookup-auto.js
 * Copyright (c) 2024 Your Name or Company
 * Released under the MIT License.
 *
 * Description:
 * レコードの新規作成画面または編集画面を開いた際に、
 * 文字列フィールド「屑分類」の値をルックアップフィールド「L屑分類」に自動でセットし、
 * ルックアップの取得を実行します。
 */
(function() {
  'use strict';

  // 新規作成画面と編集画面の表示イベントを対象にします
  const events = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(events, function(event) {
    const record = event.record;

    // ----------------------------------------------------------------
    // ご自身の環境に合わせてフィールドコードを変更してください
    // ----------------------------------------------------------------
    const sourceFieldCode = '屑分類';      // コピー元の文字列フィールドのフィールドコード
    const lookupFieldCode = 'L屑分類';    // ルックアップフィールドのフィールドコード

    // コピー元の文字列フィールドの値を取得します
    const sourceValue = record[sourceFieldCode].value;

    // 文字列フィールドに値が入っている場合のみ処理を実行します
    if (sourceValue) {
      // ルックアップフィールドに値をセットします
      record[lookupFieldCode].value = sourceValue;
      
      // この一行が、ルックアップの「取得」ボタンを自動で押す役割をします
      record[lookupFieldCode].lookup = true;
    }
    
    // 変更したレコード情報をkintoneに返します
    return event;
  });

})();