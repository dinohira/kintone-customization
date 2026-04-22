/**
 * アプリ225 — ルックアップ定義（LKD Engine 設定ファイル）
 *
 * 対象ルックアップとフィルター条件:
 *   L作業種別   (ルート)         → 客先種別ID (225) = 客先種別ID (App198)
 *   L輸送方法2  (T輸送計算内)    → 客先種別ID (225) = 客先種別ID (App199)
 *   L素材中分類 (ルート)         → 客先専用素材テーブルID (225) = 素材中分類登録用ID (App196)
 *   L小分類     (T面積計算内)    → 素材中分類ID (225) = 中分類ID (App197)
 *
 * @requires lkd-engine.js（先に読み込むこと）
 */
(function () {
    'use strict';

    var LOOKUP_DEFS = {
        'L作業種別': {
            label: '作業種別',
            location: 'root',
            refApp: 198,
            refKeyField: '作業種別',
            displayField: '作業種別',
            filterField: '客先種別ID',
            filterFieldRef: '客先種別ID',
            emptyMessage: '客先を選択してください',
            enableReset: true,
            enableNewRecord: true,
            fieldMappings: [
                { to: '作業種別', from: '作業種別' },
                { to: 'D外注作業', from: 'D外注作業' }
            ]
        },
        'L輸送方法2': {
            label: '輸送方法',
            location: 'subtable',
            subtable: 'T輸送計算',
            refApp: 199,
            refKeyField: '輸送方法',
            displayField: '輸送方法',
            filterField: '客先種別ID',
            filterFieldRef: '客先種別ID',
            emptyMessage: '客先を選択してください',
            enableReset: true,
            enableNewRecord: true,
            fieldMappings: [],
            onChange: function (fieldCode, value, record) {
                // T輸送計算テーブルのL輸送方法2を連結してL輸送方法にセット
                if (!record['L輸送方法'] || !record['T輸送計算']) return;
                var table = record['T輸送計算'].value || [];
                var methods = [];
                for (var i = 0; i < table.length; i++) {
                    var v = table[i].value['L輸送方法2'] && table[i].value['L輸送方法2'].value;
                    if (v && v !== '') methods.push(v);
                }
                var newVal = methods.length === 0 ? '未設定'
                           : methods.length === 1 ? methods[0]
                           : methods.join('/');
                record['L輸送方法'].value = newVal;
                var rec = kintone.app.record.get();
                rec.record['L輸送方法'].value = newVal;
                kintone.app.record.set(rec);
            }
        },
        'L素材中分類': {
            label: '素材中分類',
            location: 'root',
            refApp: 196,
            refKeyField: '素材中分類',
            displayField: '素材中分類',
            filterField: '客先専用素材テーブルID',
            filterFieldRef: '素材中分類登録用ID',
            emptyMessage: '客先を選択してください',
            tooltipField: '例',
            enableReset: true,
            enableNewRecord: true,
            fieldMappings: [
                { to: '簡易比重', from: '簡易比重' },
                { to: '素材中分類ID', from: '素材中分類ID' }
            ]
        },
        'L小分類': {
            label: '小分類',
            location: 'subtable',
            subtable: 'T面積計算',
            refApp: 197,
            refKeyField: '素材小分類',
            displayField: '素材小分類',
            filterField: '素材中分類ID',
            filterFieldRef: '中分類ID',
            emptyMessage: '素材中分類を選択してください',
            tooltipField: '備考・メモ',
            enableReset: true,
            enableNewRecord: true,
            fieldMappings: [
                { to: '計算単価', from: '計算単価' }
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
