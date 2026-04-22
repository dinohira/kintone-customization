/**
 * アプリ240 — LKD Engine 設定ファイル（MA保管材）
 *
 * L屑分類ルックアップをLKDドロップダウンに変換。
 * フィルター条件: 240の客先種別ID = 251の客先種別ID
 *
 * @requires lkd-engine.js（先に読み込むこと）
 * @version 1.0.0
 * @date 2026-04-22
 */
(function () {
    'use strict';

    var LOOKUP_DEFS = {
        'L屑分類': {
            label:          '屑分類検索',
            location:       'root',
            refApp:         251,
            refKeyField:    '屑分類',
            displayField:   '屑分類',
            filterField:    '客先種別ID',
            filterFieldRef: '客先種別ID',
            emptyMessage:   '客先を選択してください',
            enableReset:    true,
            enableNewRecord: true,
            fieldMappings: [
                { to: '屑分類',              from: '屑分類' },
                { to: '素材大分類_屑選択用_', from: '素材大分類' },
                { to: '素材中分類_屑選択用_', from: '素材中分類' }
            ]
        }
    };

    // --- kintone イベント登録 ---
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], function (event) {
        LkdEngine.init(LOOKUP_DEFS);
        return event;
    });

})();
