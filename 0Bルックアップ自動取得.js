/*
 * kintone ルックアップ自動取得スクリプト
 * Copyright (c) 2024 Your Name or Company
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

(function() {
  'use strict';

  // --- 設定箇所 ---
  // 自動取得したいルックアップフィールドの「フィールドコード」を指定してください。
  const LOOKUP_FIELD_CODE = '作業ID';
  // ----------------

  // レコード編集画面と詳細画面が表示された際のイベントを対象にします。
  const events = [
    'app.record.edit.show',
    'app.record.detail.show'
  ];

  kintone.events.on(events, function(event) {
    const record = event.record;

    // ルックアップフィールド、またはその値が存在しない（空の）場合は何もしない
    if (!record[LOOKUP_FIELD_CODE] || !record[LOOKUP_FIELD_CODE].value) {
      return event;
    }

    // 編集画面の場合のみ、ルックアップの自動取得設定を有効にする
    // kintoneの仕様上、閲覧画面でこの機能を安全に実現するのは難しいため、
    // 編集画面でのみ動作するようにしています。（詳細は後述）
    if (event.type === 'app.record.edit.show') {
      // lookupプロパティをtrueに設定すると、画面表示時に自動で値の取得が実行されます。
      record[LOOKUP_FIELD_CODE].lookup = true;
    }

    return event;
  });
})();