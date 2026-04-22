(function () {
    'use strict';

    const events = [
        'app.record.create.show',
        'app.record.edit.show',
        'app.record.create.change.C終日',
        'app.record.edit.change.C終日',
        'app.record.create.change.R種別',
        'app.record.edit.change.R種別'
    ];

    kintone.events.on(events, function (event) {
        const record = event.record;

        // 1. トリガーによる値の自動変更 (値の変更はchangeイベント時のみ実行する)
        // ※ レコードを開いた時(show)に自動変更すると、過去に保存した内容を上書きしてしまうため
        if (event.type === 'app.record.create.change.R種別' || event.type === 'app.record.edit.change.R種別') {
            const typeValue = record['R種別'].value;

            if (typeValue === '休日(申請中)' || typeValue === '休日(承認済)' || typeValue === '公休日') {
                // 終日をオンにする
                record['C終日'].value = ['終日'];
                record['出張先'].value = ''; 
            } else if (typeValue === '出張' || typeValue === '会議') {
                // 終日をオフにする
                record['C終日'].value = [];
            }
        }

        // C終日の変更があった場合、時刻をクリアする（親切設計）
        if (event.type === 'app.record.create.change.C終日' || event.type === 'app.record.edit.change.C終日' || event.type.indexOf('change.R種別') !== -1) {
            const isAllDay = record['C終日'].value && record['C終日'].value.indexOf('終日') !== -1;
            if (isAllDay) {
                record['開始時刻'].value = '';
                record['終了時刻'].value = '';
            }
        }

        // 2. フィールドの表示状態（グレーアウト/入力可能）の制御 (すべてのイベントで実行)
        const currentTypeValue = record['R種別'].value;
        const currentAllDay = record['C終日'].value && record['C終日'].value.indexOf('終日') !== -1;

        // [終了/開始時刻]の制御 (C終日に依存)
        if (currentAllDay) {
            record['開始時刻'].disabled = true;
            record['終了時刻'].disabled = true;
        } else {
            record['開始時刻'].disabled = false;
            record['終了時刻'].disabled = false;
        }

        // [出張先]の制御 (R種別に依存)
        if (currentTypeValue === '休日(申請中)' || currentTypeValue === '休日(承認済)' || currentTypeValue === '公休日') {
            record['出張先'].disabled = true;
        } else if (currentTypeValue === '出張' || currentTypeValue === '会議') {
            record['出張先'].disabled = false;
        } else {
            // 特に指定がない場合は入力可能にする
            record['出張先'].disabled = false;
        }

        return event;
    });
})();
