(function() {
    'use strict';

    const events = [
        'app.record.create.change.C引用',
        'app.record.edit.change.C引用'
    ];

    const tableEvents = [
        'app.record.create.change.T発注内容',
        'app.record.edit.change.T発注内容'
    ];

    // T発注内容の行追加・削除時にT見積内容の行数を同期する
    kintone.events.on(tableEvents, function(event) {
        const record = event.record;
        const orderTable = record['T発注内容'].value;
        const estTable = record['T見積内容'].value;

        if (orderTable.length > estTable.length) {
            // 行を増やす
            const numToAdd = orderTable.length - estTable.length;
            for (let i = 0; i < numToAdd; i++) {
                let newRow = { value: {} };
                if (estTable.length > 0) {
                    const templateRow = estTable[0];
                    for (let key in templateRow.value) {
                        const field = templateRow.value[key];
                        const newField = { type: field.type };
                        switch (field.type) {
                            case 'CHECK_BOX':
                            case 'MULTI_SELECT':
                            case 'CATEGORY':
                            case 'USER_SELECT':
                            case 'ORGANIZATION_SELECT':
                            case 'GROUP_SELECT':
                            case 'FILE':
                                newField.value = [];
                                break;
                            case 'RADIO_BUTTON':
                            case 'DROP_DOWN':
                                newField.value = field.value; // 初期値をコピー
                                break;
                            default:
                                newField.value = '';
                                break;
                        }
                        newRow.value[key] = newField;
                    }
                } else {
                    // T見積内容が空の場合のフォールバック
                    newRow.value['C引用'] = { type: 'CHECK_BOX', value: [] };
                    newRow.value['品名'] = { type: 'SINGLE_LINE_TEXT', value: '' };
                }
                estTable.push(newRow);
            }
        } else if (orderTable.length < estTable.length) {
            // 行を減らす (末尾から削除し行数を一致させる)
            // Kintoneの標準イベントでは「どの行が削除されたか」を特定できないため、
            // 行数を合わせるために末尾から削除します。
            estTable.splice(orderTable.length);
        }

        return event;
    });

    // C引用のチェック時の動作
    kintone.events.on(events, function(event) {
        const record = event.record;
        const orderTable = record['T発注内容'].value;
        const estTable = record['T見積内容'].value;
        const changedRow = event.changes.row;

        if (!changedRow) return event;

        const cInyo = changedRow.value['C引用'].value;
        
        // 「入力から引用」がチェックされた場合
        if (cInyo.indexOf('入力から引用') !== -1) {
            // 変更された行のインデックスを取得
            const rowIndex = estTable.findIndex(function(r) {
                return r === changedRow;
            });

            if (rowIndex !== -1 && orderTable[rowIndex]) {
                const orderRow = orderTable[rowIndex].value;
                
                const maker = orderRow['メーカー'] && orderRow['メーカー'].value ? orderRow['メーカー'].value : '';
                const product = orderRow['商品名'] && orderRow['商品名'].value ? orderRow['商品名'].value : '';
                const machine = orderRow['L機械名'] && orderRow['L機械名'].value ? orderRow['L機械名'].value : '';
                const model = orderRow['型番・形式等'] && orderRow['型番・形式等'].value ? orderRow['型番・形式等'].value : '';

                // 空の値をフィルタリングしてアンダーバーで結合
                const combined = [maker, product, machine, model]
                    .filter(function(v) { return v !== ''; }) // 空白を除外
                    .join('_'); // アンダーバーで結合

                // 結合した値を指定
                changedRow.value['品名'].value = combined;

                // 数量と単価をコピー (空でない場合のみ)
                let num = 0;
                let price = 0;

                if (orderRow['数量'] && orderRow['数量'].value !== '') {
                    // T見積内容に「数量_見積」フィールドが存在する場合のみセット
                    if (changedRow.value['数量_見積']) {
                        changedRow.value['数量_見積'].value = orderRow['数量'].value;
                        num = Number(orderRow['数量'].value);
                    }
                } else if (changedRow.value['数量_見積'] && changedRow.value['数量_見積'].value !== '') {
                    num = Number(changedRow.value['数量_見積'].value);
                }

                if (orderRow['単価'] && orderRow['単価'].value !== '') {
                    // T見積内容に「単価_見積」フィールドが存在する場合のみセット
                    if (changedRow.value['単価_見積']) {
                        changedRow.value['単価_見積'].value = orderRow['単価'].value;
                        price = Number(orderRow['単価'].value);
                    }
                } else if (changedRow.value['単価_見積'] && changedRow.value['単価_見積'].value !== '') {
                    price = Number(changedRow.value['単価_見積'].value);
                }

                // 「小計_見積」が計算フィールドの場合、JavaScriptでの値代入で強制的に結果を表示させる
                if (changedRow.value['小計_見積']) {
                    changedRow.value['小計_見積'].value = num * price;
                }
            }
        }

        return event;
    });

})();
