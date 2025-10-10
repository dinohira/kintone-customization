(function() {
    'use strict';

    // レコード詳細画面や編集画面で動作するイベントを設定
    kintone.events.on(['app.record.create.change.作業係数', 'app.record.edit.change.作業係数', 'app.record.create.show', 'app.record.edit.show'], function(event) {
        // チェックボックスの値を取得
        var record = event.record;
        var checkboxValues = record['作業係数'].value;

        // チェックが入っている値をスラッシュで結合して文字列にする
        var concatenatedValues = checkboxValues.join('/ ');

        // 文字列フィールド「DST作業係数」に設定
        record['DST作業係数'].value = concatenatedValues;

        // テーブル「T面積記録」の「項目_DST」の値を取得し、カンマで結合して「DST明細項目」に設定
        var tableRecords = record['T面積記録'].value;
        var dstItems = tableRecords.map(function(row) {
            return row.value['項目_DST'].value;
        }).join(', ');
        record['DST明細項目'].value = dstItems;

        return event;
    });

})();