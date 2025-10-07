(function() {
  'use strict';

  // ラベルを設定する処理を関数化
  function setTableLabels(tableFieldCode, tableSelector) {
    // ヘッダー情報を取得
    var headers = document.querySelectorAll(tableSelector + ' .subtable-header-gaia th');
    if (headers.length === 0) {
      return; // ヘッダーが見つからなければ何もしない
    }

    var headerLabels = {};
    headers.forEach(function(th) {
      var labelClass = th.className.match(/label-\d+/);
      if (labelClass) {
        var fieldId = labelClass[0].split('-')[1];
        var labelText = th.innerText.trim().replace(/\n/g, ' '); // 複数行のラベルを1行に
        headerLabels[fieldId] = labelText;
      }
    });

    // 各行の各セルにラベルを設定
    var rows = document.querySelectorAll(tableSelector + ' tbody tr');
    rows.forEach(function(row) {
      var cells = row.querySelectorAll('td');
      cells.forEach(function(cell) {
        var fieldDiv = cell.querySelector('[class*="field-"]');
        if (fieldDiv) {
          var fieldClass = fieldDiv.className.match(/field-\d+/);
          if (fieldClass) {
            var fieldId = fieldClass[0].split('-')[1];
            if (headerLabels[fieldId]) {
              // data-label属性にフィールド名を設定
              fieldDiv.setAttribute('data-label', headerLabels[fieldId]);
            }
          }
        }
      });
    });
  }

  // 実行するイベントの種類
  var events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show',
    'app.record.create.change.T時間計算', // T時間計算テーブルの変更イベント
    'app.record.edit.change.T時間計算',
    'app.record.create.change.T面積計算', // T面積計算テーブルの変更イベント
    'app.record.edit.change.T面積計算'
  ];

  // イベントが発火したときの処理
  kintone.events.on(events, function(event) {
    // T時間計算テーブルのラベルを設定
    setTableLabels('T時間計算', '.subtable-8242560');

    // T面積計算テーブルのラベルを設定
    setTableLabels('T面積計算', '.subtable-8242561');

    return event;
  });

})();

