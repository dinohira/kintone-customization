(function() {
    'use strict';

    // 対象アプリのイベント
    const events = [
        'app.record.create.change.R計算方式2',  // 新規作成時、R計算方式2の変更時
        'app.record.edit.change.R計算方式2',    // 編集時、R計算方式2の変更時
        'app.record.create.show',              // 新規作成画面の表示時
        'app.record.edit.show',                // 編集画面の表示時
        'app.record.detail.show',              // 詳細画面の表示時
        'app.record.create.change.T面積計算',  // テーブル行追加時（新規作成）
        'app.record.edit.change.T面積計算'     // テーブル行追加時（編集）
    ];

    // フィールド初期化関数
    function initializeFieldsForRow(row) {
        if (row.value['径2']) row.value['径2'].disabled = true;
        if (row.value['縦2']) row.value['縦2'].disabled = true;
        if (row.value['横2']) row.value['横2'].disabled = true;
        if (row.value['面積指定2']) row.value['面積指定2'].disabled = true;
        if (row.value['金額指定2']) row.value['金額指定2'].disabled = true;
    }

    // 表示制御の関数
    function toggleFields(event) {
        const record = event.record;
        const tableRows = record['T面積計算'] ? record['T面積計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            // 各フィールドコードが存在するか確認
            const calculationMethod = row.value['R計算方式2'] ? row.value['R計算方式2'].value : null;
            initializeFieldsForRow(row); // 初期化

            // 表示制御: R計算方式2の値による
            if (calculationMethod === '円形') {
                if (row.value['径2']) row.value['径2'].disabled = false;
            } else if (calculationMethod === '方形') {
                if (row.value['縦2']) row.value['縦2'].disabled = false;
                if (row.value['横2']) row.value['横2'].disabled = false;
            } else if (calculationMethod === '面積指定') {
                if (row.value['面積指定2']) row.value['面積指定2'].disabled = false;
            } else if (calculationMethod === '金額指定') {
                if (row.value['金額指定2']) row.value['金額指定2'].disabled = false;
            }
            // "-" またはその他の場合は全て非表示 (初期化済み)
        });

        return event;
    }

    // レコード読み込み時に初期化
    function initializeFields(event) {
        const record = event.record;
        const tableRows = record['T面積計算'] ? record['T面積計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            initializeFieldsForRow(row);
        });

        return event;
    }

    // 行追加時の初期化処理
    function handleRowAddition(event) {
        const record = event.record;
        const tableRows = record['T面積計算'] ? record['T面積計算'].value : []; // テーブルが空の場合対応
        const newRow = tableRows[tableRows.length - 1]; // 最後に追加された行

        if (newRow) {
            initializeFieldsForRow(newRow);
        }

        return event;
    }

    // イベント登録
    kintone.events.on(['app.record.create.show', 'app.record.edit.show'], initializeFields);
    kintone.events.on(events, toggleFields);

    // 行追加時のイベント
    kintone.events.on(['app.record.create.change.T面積計算', 'app.record.edit.change.T面積計算'], handleRowAddition);
})();
