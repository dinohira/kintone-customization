(function() {
    'use strict';

    const events = [
        'app.record.create.show',
        'app.record.edit.show'
    ];

    const fieldsToCopy = [
        'C文字列のみ',
        '文字列',
        'R計算方式',
        '径',
        '縦',
        '横',
        '作業倍率',
        'カット数'
    ];

    // ラジオボタンの値をマッピングする関数
    function mapRadioValue(value, targetTableName) {
        if (value === '面積指定' && targetTableName === 'T時間計算') return '時間指定';
        if (value === '時間指定' && targetTableName === 'T面積計算') return '面積指定';
        return value;
    }

    // 行データをコピーして作成する関数
    function createCopiedRow(sourceRow, sourceSuffix, targetSuffix, targetTableName, templateRow) {
        // Kintoneのテーブル行には全フィールドが定義されている必要があるため、コピー先の既存行をテンプレとして使用する
        const newRow = templateRow ? JSON.parse(JSON.stringify(templateRow)) : { value: {} };
        delete newRow.id; // 新規行として扱うためにidを削除
        
        fieldsToCopy.forEach(baseCode => {
            const sourceCode = baseCode + sourceSuffix;
            const targetCode = baseCode + targetSuffix;
            
            // コピー元のフィールドが存在しない場合はスキップ
            if (!sourceRow.value[sourceCode]) return;
            
            let val = sourceRow.value[sourceCode].value;
            const type = sourceRow.value[sourceCode].type;
            
            // ラジオボタンの特殊処理
            if (baseCode === 'R計算方式') {
                val = mapRadioValue(val, targetTableName);
            }
            
            // 配列（チェックボックスなど）の場合は複製する
            if (Array.isArray(val)) {
                val = [...val];
            }
            
            // テンプレ行にフィールドが存在しない場合のセーフティ
            if (!newRow.value[targetCode]) {
                newRow.value[targetCode] = { type: type };
            }
            newRow.value[targetCode].value = val;
        });
        
        // Kintoneの厳密な仕様対策: テンプレート行由来の空フィールド等でvalueが存在しないとエラーになるため補完
        Object.keys(newRow.value).forEach(k => {
            if (!('value' in newRow.value[k])) {
                const t = newRow.value[k].type;
                newRow.value[k].value = (t === 'CHECK_BOX' || t === 'MULTI_SELECT' || t === 'USER_SELECT' || t === 'ORGANIZATION_SELECT' || t === 'GROUP_SELECT' || t === 'FILE') ? [] : "";
            }
        });
        
        return newRow;
    }

    kintone.events.on(events, function(event) {
        const ueSpace = kintone.app.record.getSpaceElement('ue');
        const sitaSpace = kintone.app.record.getSpaceElement('sita');

        // ueボタンの生成 (↑) : T面積計算(2) -> T時間計算(1)
        if (ueSpace && !document.getElementById('btn-copy-up')) {
            const btnUe = document.createElement('button');
            btnUe.id = 'btn-copy-up';
            btnUe.textContent = '↑';
            btnUe.style.padding = '4px 16px';
            btnUe.onclick = function() {
                const recordData = kintone.app.record.get();
                if (!recordData) return;
                const rec = recordData.record;
                
                // コピー元とコピー先のテーブル取得
                const sourceTable = rec['T面積計算'].value;
                const targetTable = rec['T時間計算'].value;
                const templateRow = targetTable.length > 0 ? targetTable[0] : null;
                const newTable = [];
                
                // 行ごとに変換
                sourceTable.forEach(row => {
                    newTable.push(createCopiedRow(row, '2', '1', 'T時間計算', templateRow));
                });
                
                // テーブルを書き換え
                rec['T時間計算'].value = newTable;
                kintone.app.record.set(recordData);
            };
            ueSpace.appendChild(btnUe);
        }

        // sitaボタンの生成 (↓) : T時間計算(1) -> T面積計算(2)
        if (sitaSpace && !document.getElementById('btn-copy-down')) {
            const btnSita = document.createElement('button');
            btnSita.id = 'btn-copy-down';
            btnSita.textContent = '↓';
            btnSita.style.padding = '4px 16px';
            btnSita.onclick = function() {
                const recordData = kintone.app.record.get();
                if (!recordData) return;
                const rec = recordData.record;
                
                // コピー元とコピー先のテーブル取得
                const sourceTable = rec['T時間計算'].value;
                const targetTable = rec['T面積計算'].value;
                const templateRow = targetTable.length > 0 ? targetTable[0] : null;
                const newTable = [];
                
                // 行ごとに変換
                sourceTable.forEach(row => {
                    newTable.push(createCopiedRow(row, '1', '2', 'T面積計算', templateRow));
                });
                
                // テーブルを書き換え
                rec['T面積計算'].value = newTable;
                kintone.app.record.set(recordData);
            };
            sitaSpace.appendChild(btnSita);
        }

        return event;
    });
})();
