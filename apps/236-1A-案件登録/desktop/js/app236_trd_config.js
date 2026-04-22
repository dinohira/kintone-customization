/**
 * App 236 (案件登録) — TRD Engine 設定ファイル
 * 社内鋼種ドロップダウン
 */
(function () {
    'use strict';

    TrdEngine.init([{
        sourceApp:      251,                    // 参照先アプリ（M大同屑分類）
        queryField:     '屑分類',                // 参照先の検索条件フィールド
        tableField:     'T社内鋼種',             // 参照先のテーブルフィールド
        columnField:    '社内鋼種',              // テーブル内の選択肢カラム
        triggerField:   'CC屑分類',              // トリガーフィールド（自アプリ）
        targetField:    '社内鋼種',              // 保存先フィールド（自アプリ）
        spaceId:        'Dsyanaikousyu',         // スペース要素ID
        label:          '社内鋼種選択',           // ドロップダウンラベル
        enableReset:    true,                    // リセットボタン
        enableEdit:     true                     // 編集ボタン
    }]);
})();
