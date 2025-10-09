(function() {
    'use strict';

    // ▼ 設定（必要に応じてフィールドコードを調整してください）
    const TABLE_CODE = 'T分納記録';
    const SUB_DATE_CODE = '分納品出荷日_2';
    const OUT_DATE_CODE = '分納品出荷日';

    // 編集・作成画面での動作
    kintone.events.on([
        'app.record.edit.change.' + TABLE_CODE,
        'app.record.create.change.' + TABLE_CODE
    ], function(event) {
        updateLatestDate(event);
        return event;
    });

    // テーブル内のセル更新にも対応
    kintone.events.on([
        'app.record.edit.change.' + SUB_DATE_CODE,
        'app.record.create.change.' + SUB_DATE_CODE
    ], function(event) {
        updateLatestDate(event);
        return event;
    });

    function updateLatestDate(event) {
        const record = event.record;
        let maxDate = null;

        const tableRows = record[TABLE_CODE].value;
        tableRows.forEach(function(row) {
            const dateStr = row.value[SUB_DATE_CODE].value;
            if (dateStr) {
                if (!maxDate || dateStr > maxDate) {
                    maxDate = dateStr;
                }
            }
        });

        record[OUT_DATE_CODE].value = maxDate || '';
    }
})();
