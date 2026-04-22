/**
 * アプリ225 — カスケードルックアップ設定
 *
 * CascadeEngine ライブラリを使用して、客先選択のカスケードルックアップを構成。
 * 本ファイルはアプリ固有の設定のみを記述し、ロジックは cascade-engine.js に委譲。
 *
 * @requires cascade-engine.js
 * @version 1.0.0
 * @date 2026-04-16
 */
(function () {
    'use strict';

    // =================================================================
    // アプリ225 — カスケードルックアップ設定
    // =================================================================
    var CASCADE_CONFIG = {
        // 参照先アプリ
        sourceAppId: 195,   // MA客先詳細

        // フィルター用ドロップダウン定義
        // （排他制御: 一方を選択すると他方が無効化される）
        filters: [
            {
                fieldCode:   'Dよみ先頭文字',      // 自アプリのフィールドコード
                label:       'よみ先頭文字',        // フォーム上のラベル名（DOM検索用）
                sourceField: 'よみ先頭文字'         // 参照先アプリのフィールド名
            },
            {
                fieldCode:   'D客先グループ',
                label:       '客先グループ',
                sourceField: '客先グループ'
            }
        ],

        // カスケード段階定義（参照先アプリのフィールドで段階的に絞り込み）
        cascadeLevels: [
            { field: '客先名',     label: '客先名' },
            { field: '所属部署',   label: '所属部署' },
            { field: '担当者名',   label: '担当者名' }
        ],

        // フィールドコピーマッピング（自アプリ ← 参照先アプリ）
        copyMap: [
            { to: 'L客先選択',             from: '客先詳細ID' },
            { to: '客先詳細ID',            from: '客先詳細ID' },
            { to: '客先名',               from: '客先名' },
            { to: '郵便番号',             from: '郵便番号' },
            { to: '所在地',               from: '所在地' },
            { to: '部署',                 from: '所属部署' },
            { to: '担当者',               from: '担当者' },
            { to: '略称',                 from: '略称' },
            { to: '電話番号',             from: '電話番号' },
            { to: '作業メモ',             from: '作業メモ' },
            { to: '市区町村ID',           from: '市区町村ID' },
            { to: '客先専用素材テーブルID', from: '素材中分類登録用ID' },
            { to: '客先種別ID',           from: '客先種別ID' }
        ],

        // ルックアップネイティブ取得トリガー（保存バリデーション対策）
        lookupTrigger: {
            label:     '客先選択',          // フォーム上のルックアップラベル名
            fieldCode: 'L客先選択'          // ルックアップフィールドコード
        },

        // カスケードUI配置先のスペース要素ID
        spaceId: 'cascade-lookup-space',

        // 自動コピー設定（他アプリからのハンドオーバー対応）
        autoPopulate: {
            fieldCode:   '客先詳細ID',      // 自アプリ内の検索キーフィールド
            sourceField: '客先詳細ID'       // 参照先アプリの検索フィールド
        },

        // 新規レコード作成ボタン設定
        newRecordFields: {
            idField:   '客先名ID',          // 参照先アプリのIDフィールド
            paramName: 'cascadeLookupId'    // URLパラメータ名
        },

        // プレースホルダーテキスト
        placeholderText: '--- 選択してください ---'
    };

    // =================================================================
    // イベント登録
    // =================================================================

    // 表示イベント: CascadeEngineを初期化
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], function (event) {
        CascadeEngine.init(CASCADE_CONFIG, event);
        return event;
    });

    // よみ先頭文字の変更イベント
    kintone.events.on([
        'app.record.create.change.Dよみ先頭文字',
        'app.record.edit.change.Dよみ先頭文字'
    ], function (event) {
        var value = event.record['Dよみ先頭文字'].value;
        event.record['D客先グループ'].value = '';
        CascadeEngine.onFilterChange('よみ先頭文字', value, 'Dよみ先頭文字');
        return event;
    });

    // 客先グループの変更イベント
    kintone.events.on([
        'app.record.create.change.D客先グループ',
        'app.record.edit.change.D客先グループ'
    ], function (event) {
        var value = event.record['D客先グループ'].value;
        event.record['Dよみ先頭文字'].value = '';
        CascadeEngine.onFilterChange('客先グループ', value, 'D客先グループ');
        return event;
    });

})();
