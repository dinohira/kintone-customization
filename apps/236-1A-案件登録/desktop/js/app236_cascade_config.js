/**
 * アプリ236 — カスケードルックアップ設定（案件登録）
 *
 * CascadeEngine ライブラリを使用して、客先選択のカスケードルックアップを構成。
 * sessionStorageフラグによるルックアップ自動取得との競合回避を含む。
 *
 * @requires cascade-engine.js
 * @version 1.0.0
 * @date 2026-04-16
 */
(function () {
    'use strict';

    var CASCADE_CONFIG = {
        sourceAppId: 195,   // MA客先詳細

        filters: [
            {
                fieldCode:   'Dよみ先頭文字',
                label:       'よみ先頭文字',
                sourceField: 'よみ先頭文字'
            },
            {
                fieldCode:   'D客先グループ',
                label:       '客先グループ',
                sourceField: '客先グループ'
            }
        ],

        cascadeLevels: [
            { field: '客先名',     label: '客先名' },
            { field: '所属部署',   label: '所属部署' },
            { field: '担当者名',   label: '担当者名' }
        ],

        copyMap: [
            { to: 'L客先選択',             from: '客先詳細ID' },
            { to: '客先詳細ID',            from: '客先詳細ID' },
            { to: '客先名',               from: '客先名' },
            { to: '部署',                 from: '所属部署' },
            { to: '担当者',               from: '担当者' },
            { to: '客先種別ID',           from: '客先種別ID' },
            { to: '素材中分類登録用ID',     from: '素材中分類登録用ID' },
            { to: '郵便番号',             from: '郵便番号' },
            { to: '所在地',               from: '所在地' },
            { to: '電話番号',             from: '電話番号' },
            { to: '客先名ID',             from: '客先名ID' },
            { to: '略称',                 from: '略称' }
        ],

        lookupTrigger: {
            label:     '客先選択',
            fieldCode: 'L客先選択'
        },

        spaceId: 'cascade-lookup-space',

        autoPopulate: {
            fieldCode:   '客先詳細ID',
            sourceField: '客先詳細ID'
        },

        newRecordFields: {
            idField:   '客先名ID',
            paramName: 'cascadeLookupId'
        },

        placeholderText: '--- 選択してください ---',

        // カスケード完了フラグ（ルックアップ自動取得との競合回避用）
        sessionStorageKey: 'cascadeLookupCompleted_236'
    };

    // 表示イベント
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], function (event) {
        // カスケードフラグをクリア
        try { sessionStorage.removeItem(CASCADE_CONFIG.sessionStorageKey); } catch(e) { /* ignore */ }

        var instance = CascadeEngine.init(CASCADE_CONFIG, event);

        // onRecordSelectedをラップしてsessionStorageフラグをセット
        var originalOnSelected = instance.onRecordSelected.bind(instance);
        instance.onRecordSelected = function(record) {
            originalOnSelected(record);
            try { sessionStorage.setItem(CASCADE_CONFIG.sessionStorageKey, 'true'); } catch(e) { /* ignore */ }
        };

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
