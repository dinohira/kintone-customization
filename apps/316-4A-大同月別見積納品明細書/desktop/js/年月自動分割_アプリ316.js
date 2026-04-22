(function() {
    'use strict';

    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show',
        'app.record.create.change.処理年月',
        'app.record.edit.change.処理年月'
    ], function(event) {
        var record = event.record;
        
        // 処理年月が存在し、かつ値が入っている場合
        if (record['処理年月'] && record['処理年月'].value) {
            var yyyyMm = String(record['処理年月'].value);
            
            // 6桁の場合のみ分割（202603 など）
            if (yyyyMm.length === 6) {
                var year = yyyyMm.substring(0, 4);
                var month = yyyyMm.substring(4, 6);
                
                // それぞれ数値として代入
                record['年'].value = Number(year);
                record['月'].value = Number(month);
            }
        }
        
        return event;
    });
})();
