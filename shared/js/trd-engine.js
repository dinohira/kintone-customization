/**
 * TRD Engine — Table Row Dropdown エンジン
 *
 * 参照先アプリの特定レコード内のサブテーブルから値を取得し、
 * スペース要素にドロップダウンとして表示する再利用可能なライブラリ。
 *
 * 使い方:
 *   kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function (event) {
 *       TrdEngine.init([{
 *           sourceApp:      251,
 *           queryField:     '屑分類',
 *           tableField:     'T社内鋼種',
 *           columnField:    '社内鋼種',
 *           triggerField:   'L屑分類',
 *           targetField:    '社内鋼種',
 *           spaceId:        'Dsyanaikousyu',
 *           label:          '社内鋼種選択',
 *           readonlyFields: ['屑分類', '社内鋼種'],
 *           enableReset:    true,
 *           enableEdit:     true,
 *           editParams: {
 *               fields: [
 *                   { param: 'L素材大分類', from: '素材大分類_屑選択用' }
 *               ]
 *           }
 *       }]);
 *       return event;
 *   });
 *
 * @version 1.0.0
 * @date 2026-04-22
 */
(function () {
    'use strict';

    // =================================================================
    // CONSTANTS
    // =================================================================
    var STYLE_ID = 'trd-engine-styles';
    var POLL_INTERVAL_MS = 500;

    var STYLES = '\
        .trd-space-root {\
            margin-top: 8px;\
        }\
        .trd-label {\
            font-size: 16px;\
            color: #333;\
            font-weight: normal;\
            margin-bottom: 8px;\
        }\
        .trd-container {\
            display: flex;\
            align-items: center;\
            gap: 6px;\
        }\
        .trd-container .kintoneplugin-select-outer {\
            height: 32px;\
        }\
        .trd-container .kintoneplugin-select {\
            height: 32px;\
            min-height: 32px;\
        }\
        .trd-container .kintoneplugin-select select {\
            height: 30px;\
            padding: 0 8px;\
            font-size: 14px;\
        }\
        .trd-action-btn {\
            display: inline-flex;\
            align-items: center;\
            justify-content: center;\
            width: 32px;\
            height: 32px;\
            border: 1px solid #e3e7e8;\
            border-radius: 4px;\
            background-color: #fff;\
            color: #666;\
            cursor: pointer;\
            flex-shrink: 0;\
            transition: background-color 0.2s, border-color 0.2s, color 0.2s;\
            padding: 0;\
            line-height: 1;\
        }\
        .trd-action-btn:hover {\
            background-color: #f0f4f8;\
            border-color: #b0b6b8;\
            color: #333;\
        }\
        .trd-action-btn .material-symbols-outlined {\
            font-size: 20px;\
        }\
        .trd-action-btn.trd-btn-reset:hover {\
            background-color: #fff3e0;\
            border-color: #ff9800;\
            color: #e65100;\
        }\
        .trd-action-btn.trd-btn-edit:hover {\
            background-color: #e3f2fd;\
            border-color: #2196f3;\
            color: #0d47a1;\
        }\
    ';

    // =================================================================
    // STYLE INJECTION
    // =================================================================
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);

        // Material Symbols
        if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
            document.head.appendChild(link);
        }
    }

    // =================================================================
    // STATE
    // =================================================================
    var instances = [];

    // =================================================================
    // TRD INSTANCE
    // =================================================================
    function TrdInstance(config) {
        this.config = config;
        this.lastTriggerValue = null;
        this.pollInterval = null;
        this.currentRecordId = null;
    }

    /** トリガーフィールドの値を取得 */
    TrdInstance.prototype.getTriggerValue = function () {
        var rec = kintone.app.record.get();
        if (!rec || !rec.record) return null;
        var field = rec.record[this.config.triggerField];
        return field ? (field.value || '') : '';
    };

    /** ポーリング開始 */
    TrdInstance.prototype.startPolling = function () {
        var self = this;
        if (this.pollInterval) clearInterval(this.pollInterval);

        this.pollInterval = setInterval(function () {
            var currentVal = self.getTriggerValue();
            if (currentVal !== self.lastTriggerValue) {
                console.log('[TRD] トリガー変更検出:', self.config.triggerField,
                    self.lastTriggerValue, '→', currentVal);
                self.lastTriggerValue = currentVal;

                // スペースクリア + ターゲットフィールドクリア
                var spaceEl = kintone.app.record.getSpaceElement(self.config.spaceId);
                if (spaceEl) spaceEl.innerHTML = '';

                var rec = kintone.app.record.get();
                if (rec && rec.record[self.config.targetField]) {
                    rec.record[self.config.targetField].value = '';
                    kintone.app.record.set(rec);
                }

                if (currentVal) {
                    self.renderDropdown(currentVal, '');
                }
            }
        }, POLL_INTERVAL_MS);
    };

    /** ポーリング停止 */
    TrdInstance.prototype.stopPolling = function () {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    };

    /** 初期化（showイベント時に呼ばれる） */
    TrdInstance.prototype.setup = function (event) {
        var config = this.config;

        // 編集不可フィールド設定
        if (config.readonlyFields) {
            config.readonlyFields.forEach(function (fc) {
                if (event.record[fc]) event.record[fc].disabled = true;
            });
        }

        // 詳細画面では何もしない
        if (event.type === 'app.record.detail.show') return;

        // 初期値取得
        var initialTrigger = event.record[config.triggerField]
            ? (event.record[config.triggerField].value || '') : '';
        var initialTarget = event.record[config.targetField]
            ? (event.record[config.targetField].value || '') : '';

        this.lastTriggerValue = initialTrigger;

        // 初期値がある場合はドロップダウン描画
        if (initialTrigger) {
            this.renderDropdown(initialTrigger, initialTarget);
        }

        // ポーリング開始
        this.startPolling();
    };

    /** ドロップダウン描画 */
    TrdInstance.prototype.renderDropdown = function (triggerValue, initialTargetValue) {
        var self = this;
        var config = this.config;
        var spaceEl = kintone.app.record.getSpaceElement(config.spaceId);
        if (!spaceEl) return;

        (async function () {
            try {
                var escapedVal = triggerValue.replace(/"/g, '\\"');
                var params = {
                    app: config.sourceApp,
                    query: config.queryField + ' = "' + escapedVal + '" limit 1',
                    fields: ['$id', config.tableField]
                };
                var resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params);

                spaceEl.innerHTML = '';

                if (!resp.records || resp.records.length === 0) {
                    spaceEl.innerText = '関連する詳細データが見つかりません。';
                    return;
                }

                var recordId = resp.records[0].$id.value;
                self.currentRecordId = recordId;
                var tableData = resp.records[0][config.tableField].value;

                if (!tableData || tableData.length === 0) {
                    spaceEl.innerText = '詳細データが登録されていません。';
                    return;
                }

                // --- UI構築 ---
                var spaceRoot = document.createElement('div');
                spaceRoot.className = 'trd-space-root';

                // ラベル
                var label = document.createElement('div');
                label.className = 'trd-label';
                label.textContent = config.label || 'テーブル選択';
                spaceRoot.appendChild(label);

                // コンテナ（ドロップダウン + ボタン）
                var container = document.createElement('div');
                container.className = 'trd-container';

                // ドロップダウン
                var selectOuter = document.createElement('div');
                selectOuter.className = 'kintoneplugin-select-outer';
                var selectWrapper = document.createElement('div');
                selectWrapper.className = 'kintoneplugin-select';

                var dropdown = document.createElement('select');
                var defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.text = '--- 選択してください ---';
                dropdown.appendChild(defaultOpt);

                var hasMatchedInitialValue = false;

                tableData.forEach(function (row) {
                    if (row.value && row.value[config.columnField] && row.value[config.columnField].value) {
                        var opt = document.createElement('option');
                        var val = row.value[config.columnField].value;
                        opt.value = val;
                        opt.text = val;
                        if (initialTargetValue === val) {
                            opt.selected = true;
                            hasMatchedInitialValue = true;
                        }
                        dropdown.appendChild(opt);
                    }
                });

                // 既存値がリストにない場合（設定外値の保持）
                if (initialTargetValue && !hasMatchedInitialValue) {
                    var legacyOpt = document.createElement('option');
                    legacyOpt.value = initialTargetValue;
                    legacyOpt.text = initialTargetValue + ' (設定外)';
                    legacyOpt.selected = true;
                    dropdown.appendChild(legacyOpt);
                }

                dropdown.addEventListener('change', function (e) {
                    var rec = kintone.app.record.get();
                    rec.record[config.targetField].value = e.target.value;
                    kintone.app.record.set(rec);
                });

                selectWrapper.appendChild(dropdown);
                selectOuter.appendChild(selectWrapper);
                container.appendChild(selectOuter);

                // リセットボタン
                if (config.enableReset) {
                    var resetBtn = document.createElement('button');
                    resetBtn.className = 'trd-action-btn trd-btn-reset';
                    resetBtn.title = '選択をリセット';
                    resetBtn.type = 'button';
                    resetBtn.innerHTML = '<span class="material-symbols-outlined">clear_all</span>';
                    resetBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        var rec = kintone.app.record.get();

                        // トリガーフィールドクリア
                        if (rec.record[config.triggerField]) rec.record[config.triggerField].value = '';

                        // ターゲットフィールドクリア
                        if (rec.record[config.targetField]) rec.record[config.targetField].value = '';

                        // 編集不可フィールドもクリア
                        if (config.readonlyFields) {
                            config.readonlyFields.forEach(function (fc) {
                                if (rec.record[fc]) rec.record[fc].value = '';
                            });
                        }

                        kintone.app.record.set(rec);
                        spaceEl.innerHTML = '';
                        self.lastTriggerValue = '';
                    });
                    container.appendChild(resetBtn);
                }

                // 編集ボタン
                if (config.enableEdit) {
                    var editBtn = document.createElement('button');
                    editBtn.className = 'trd-action-btn trd-btn-edit';
                    editBtn.title = '詳細編集';
                    editBtn.type = 'button';
                    editBtn.innerHTML = '<span class="material-symbols-outlined">new_window</span>';
                    editBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        var rec = kintone.app.record.get();
                        var currentTrigger = rec.record[config.triggerField]
                            ? rec.record[config.triggerField].value : '';
                        if (!currentTrigger) return;

                        var url = '/k/' + config.sourceApp + '/show?record=' + recordId + '&mode=edit';

                        // 追加パラメータ
                        if (config.editParams && config.editParams.fields) {
                            var urlParams = {};
                            config.editParams.fields.forEach(function (f) {
                                var val = rec.record[f.from] ? rec.record[f.from].value : '';
                                if (val) urlParams[f.param] = { value: val };
                            });
                            if (Object.keys(urlParams).length > 0) {
                                url += '&initialValues=' + encodeURIComponent(JSON.stringify(urlParams));
                            }
                        }

                        window.open(url, '_blank');
                    });
                    container.appendChild(editBtn);
                }

                spaceRoot.appendChild(container);
                spaceEl.appendChild(spaceRoot);

            } catch (error) {
                spaceEl.innerText = 'データ取得中にエラーが発生しました。';
                console.error('[TRD] データ取得エラー:', error);
            }
        })();
    };

    // =================================================================
    // PUBLIC API
    // =================================================================
    var TrdEngine = {
        /**
         * TRDエンジンを初期化
         * @param {Array} configs - TRD定義の配列
         */
        init: function (configs) {
            injectStyles();

            // 既存インスタンスのクリーンアップ
            instances.forEach(function (inst) { inst.stopPolling(); });
            instances = [];

            // showイベント登録
            var showEvents = [
                'app.record.create.show',
                'app.record.edit.show',
                'app.record.detail.show'
            ];

            kintone.events.on(showEvents, function (event) {
                // 既存ポーリング停止
                instances.forEach(function (inst) { inst.stopPolling(); });
                instances = [];

                configs.forEach(function (cfg) {
                    var inst = new TrdInstance(cfg);
                    inst.setup(event);
                    instances.push(inst);
                });

                return event;
            });

            // クリーンアップイベント
            var teardownEvents = [
                'app.record.create.submit',
                'app.record.create.submit.success',
                'app.record.create.cancel',
                'app.record.edit.submit',
                'app.record.edit.submit.success',
                'app.record.edit.cancel'
            ];

            kintone.events.on(teardownEvents, function (event) {
                instances.forEach(function (inst) { inst.stopPolling(); });
                return event;
            });
        }
    };

    window.TrdEngine = TrdEngine;
})();
