(function() {
  'use strict';

  // レコード作成画面の表示、編集画面の表示、テーブルの値が変更された時にイベントを発火
  const events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.T時間記録',
    'app.record.edit.change.T時間記録'
  ];

  kintone.events.on(events, function(event) {
    const record = event.record;
    const table = record['T時間記録'].value; // テーブルのフィールドコード

    // テーブルの行から 'チャージ_大同' の値を取得し、数値の配列を作成
    const chargeValues = table
      .map(row => parseFloat(row.value['チャージ_大同'].value)) // 各行から値を取得して数値に変換
      .filter(value => !isNaN(value)); // 空欄などで数値に変換できなかったものを除外

    // 最大値を計算
    let maxValue;
    if (chargeValues.length > 0) {
      // スプレッド構文(...)で配列を引数として渡し、最大値を取得
      maxValue = Math.max(...chargeValues);
    } else {
      // 有効な数値が一つもない場合はフィールドを空にする
      maxValue = null;
    }

    // 'チャージ_大同2' フィールドに算出した最大値をセット
    record['チャージ_大同2'].value = maxValue;

    // 画面に値を反映させるために event オブジェクトを返す
    return event;
  });
})();