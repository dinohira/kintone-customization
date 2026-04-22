/**
 * アプリ196 — カスケードルックアップ設定（M素材中分類）
 *
 * CascadeEngine ライブラリを使用して、客先選択のカスケードルックアップを構成。
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
            { to: '客先名ID',             from: '客先名ID' },
            { to: '客先名',               from: '客先名' },
            { to: '担当者',               from: '担当者' },
            { to: '素材中分類登録用ID_1',   from: '素材中分類登録用ID' }
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

        placeholderText: '--- 選択してください ---'
    };

    // 表示イベント
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
