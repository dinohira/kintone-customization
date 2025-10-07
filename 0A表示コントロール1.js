(function() {
    'use strict';

    // 対象アプリのイベント
    const events = [
        'app.record.create.change.R計算方式1',  // 新規作成時、R計算方式1の変更時
        'app.record.edit.change.R計算方式1',    // 編集時、R計算方式1の変更時
        'app.record.create.show',              // 新規作成画面の表示時
        'app.record.edit.show',                // 編集画面の表示時
        'app.record.detail.show',              // 詳細画面の表示時
        'app.record.create.change.T時間計算',  // テーブル行追加時（新規作成）
        'app.record.edit.change.T時間計算'     // テーブル行追加時（編集）
    ];

    // フィールド初期化関数
    function initializeFieldsForRow(row) {
        if (row.value['径1']) row.value['径1'].disabled = true;
        if (row.value['縦1']) row.value['縦1'].disabled = true;
        if (row.value['横1']) row.value['横1'].disabled = true;
        if (row.value['時間指定1']) row.value['時間指定1'].disabled = true;
        if (row.value['金額指定1']) row.value['金額指定1'].disabled = true;
    }

    // 表示制御の関数
    function toggleFields(event) {
        const record = event.record;
        const tableRows = record['T時間計算'] ? record['T時間計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            // 各フィールドコードが存在するか確認
            const calculationMethod = row.value['R計算方式1'] ? row.value['R計算方式1'].value : null;
            initializeFieldsForRow(row); // 初期化

            // 表示制御: R計算方式1の値による
            if (calculationMethod === '円形') {
                if (row.value['径1']) row.value['径1'].disabled = false;
            } else if (calculationMethod === '方形') {
                if (row.value['縦1']) row.value['縦1'].disabled = false;
                if (row.value['横1']) row.value['横1'].disabled = false;
            } else if (calculationMethod === '時間指定') {
                if (row.value['時間指定1']) row.value['時間指定1'].disabled = false;
            } else if (calculationMethod === '金額指定') {
                if (row.value['金額指定1']) row.value['金額指定1'].disabled = false;
            }
            // "-" またはその他の場合は全て非表示 (初期化済み)
        });

        return event;
    }

    // レコード読み込み時に初期化
    function initializeFields(event) {
        const record = event.record;
        const tableRows = record['T時間計算'] ? record['T時間計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            initializeFieldsForRow(row);
        });

        return event;
    }

    // 行追加時の初期化処理
    function handleRowAddition(event) {
        const record = event.record;
        const tableRows = record['T時間計算'] ? record['T時間計算'].value : []; // テーブルが空の場合対応
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
    kintone.events.on(['app.record.create.change.T時間計算', 'app.record.edit.change.T時間計算'], handleRowAddition);
})();
