/*
 * kintone 運転日報 距離自動計算プログラム
 * Copyright (c) 2024 Your Name or Company
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
(function() {
  'use strict';

  // レコード作成画面と編集画面で、テーブル内の「D目的地」フィールドが変更されたときに実行
  const events = [
    'app.record.create.change.D目的地',
    'app.record.edit.change.D目的地',
    'app.record.create.submit', // 保存時にも念のためチェック
    'app.record.edit.submit'    // 保存時にも念のためチェック
  ];

  kintone.events.on(events, function(event) {
    const record = event.record;
    const tableRows = record['T運転記録'].value; // テーブルの全行データを取得

    // 各地点間の距離を定義
    const distances = {
      '自社': {
        '大同': 8,
        'DST吉岡': 11
      },
      '大同': {
        '自社': 8,
        'DST吉岡': 8
      },
      'DST吉岡': {
        '自社': 11,
        '大同': 8
      }
    };

    // テーブルの各行をループして距離を再計算
    tableRows.forEach(function(row, index) {
      let startPoint = '';
      const destination = row.value['D目的地'].value;

      // 1行目か2行目以降かで出発地を決定
      if (index === 0) {
        // 1行目は必ず「自社」スタート
        startPoint = '自社';
      } else {
        // 2行目以降は、1つ前の行の目的地を出発地とする
        const prevRow = tableRows[index - 1];
        if (prevRow.value['D目的地'].value) {
          startPoint = prevRow.value['D目的地'].value;
        }
      }

      let distance = ''; // デフォルトは空欄

      // 出発地と目的地が有効で、かつ「その他(備考欄)」でない場合に距離を計算
      if (startPoint && destination && startPoint !== 'その他(備考欄)' && destination !== 'その他(備考欄)') {
        // 同じ場所への移動は距離0
        if (startPoint === destination) {
          distance = 0;
        } else if (distances[startPoint] && distances[startPoint][destination]) {
          distance = distances[startPoint][destination];
        }
      }
      
      // 計算した距離を該当行の「距離」フィールドに設定
      row.value['距離'].value = distance;
    });

    return event;
  });

})();