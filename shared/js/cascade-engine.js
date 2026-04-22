/**
 * CascadeEngine — カスケードルックアップエンジン
 *
 * kintone の参照先アプリをドロップダウンで段階的に絞り込み、
 * 最終選択時にフィールドを自動コピーする再利用可能なライブラリ。
 * フィルター用ドロップダウン（排他制御付き）→ カスケード段階選択 → コピー。
 *
 * 使い方:
 *   kintone.events.on(['app.record.create.show', 'app.record.edit.show'], (event) => {
 *       CascadeEngine.init({
 *           sourceAppId:    195,
 *           filters: [
 *               { fieldCode: 'Dフィルター1', label: 'フィルター1', sourceField: '参照先フィールド1' },
 *               { fieldCode: 'Dフィルター2', label: 'フィルター2', sourceField: '参照先フィールド2' }
 *           ],
 *           cascadeLevels: [
 *               { field: '客先名',   label: '客先名' },
 *               { field: '所属部署', label: '所属部署' },
 *               { field: '担当者名', label: '担当者名' }
 *           ],
 *           copyMap: [
 *               { to: '自アプリフィールド', from: '参照先フィールド' }
 *           ],
 *           lookupTrigger: { label: 'ルックアップラベル', fieldCode: 'Lルックアップフィールド' },
 *           spaceId:       'cascade-lookup-space',
 *           autoPopulate:  { fieldCode: '客先詳細ID', sourceField: '客先詳細ID' },
 *           newRecordFields: { idField: '客先名ID', paramName: 'cascadeLookupId' }
 *       }, event);
 *       return event;
 *   });
 *
 * @version 1.0.0
 * @date 2026-04-16
 */
(function () {
    'use strict';

    // =================================================================
    // CONSTANTS
    // =================================================================
    var STYLE_ID = 'cascade-lookup-styles';
    var STYLES = '\
        .cascade-container {\
            display: flex;\
            align-items: flex-end;\
            gap: 6px;\
            flex-wrap: wrap;\
            padding: 4px 0;\
            min-height: 64px;\
        }\
        .cascade-level-group {\
            display: flex;\
            flex-direction: column;\
        }\
        .cascade-level-group .cascade-level-label {\
            font-size: 16px;\
            color: #333;\
            font-weight: normal;\
            margin-bottom: 8px;\
            white-space: nowrap;\
        }\
        .cascade-level-group .kintoneplugin-select-outer {\
            height: 40px;\
        }\
        .cascade-level-group .kintoneplugin-select {\
            height: 40px;\
            min-height: 40px;\
        }\
        .cascade-level-group .kintoneplugin-select select {\
            height: 38px;\
            padding: 0 8px;\
            font-size: 14px;\
            min-width: 160px;\
            max-width: 320px;\
        }\
        .cascade-arrow {\
            color: #bbb;\
            font-size: 14px;\
            user-select: none;\
            margin-bottom: 12px;\
        }\
        .cascade-action-btn {\
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
            margin-bottom: 0;\
        }\
        .cascade-action-btn:hover {\
            background-color: #f0f4f8;\
            border-color: #b0b6b8;\
            color: #333;\
        }\
        .cascade-action-btn .material-symbols-outlined {\
            font-size: 20px;\
        }\
        .cascade-action-btn.cascade-btn-reset:hover {\
            background-color: #fff3e0;\
            border-color: #ff9800;\
            color: #e65100;\
        }\
        .cascade-action-btn.cascade-btn-new:hover {\
            background-color: #e3f2fd;\
            border-color: #2196f3;\
            color: #0d47a1;\
        }\
    ';

    // =================================================================
    // ユーティリティ
    // =================================================================

    /** 指定アプリからレコードを取得（絞り込み条件付き） */
    async function fetchRecords(appId, conditions) {
        var parts = conditions.filter(Boolean);
        var query = parts.length > 0 ? parts.join(' and ') : '';
        var allRecords = [];
        var offset = 0;
        var limit = 500;

        while (true) {
            var q = query
                ? query + ' order by $id asc limit ' + limit + ' offset ' + offset
                : 'order by $id asc limit ' + limit + ' offset ' + offset;
            var resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: appId,
                query: q
            });
            allRecords = allRecords.concat(resp.records);
            if (resp.records.length < limit) break;
            offset += limit;
        }
        return allRecords;
    }

    /** 配列からユニークな値を取得（空文字除外） */
    function uniqueValues(records, fieldCode) {
        var set = {};
        records.forEach(function (r) {
            var val = r[fieldCode]?.value;
            if (val && val.trim()) set[val] = true;
        });
        return Object.keys(set).sort();
    }

    /** ラベルテキストからフィールドDOMを無効化/有効化 */
    function setFieldDisabledByLabel(labelText, disabled) {
        var labels = document.querySelectorAll('.control-label-text-gaia');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.trim() === labelText) {
                var fieldEl = labels[i].closest('.control-gaia');
                if (fieldEl) {
                    fieldEl.style.pointerEvents = disabled ? 'none' : '';
                    fieldEl.style.opacity = disabled ? '0.4' : '';
                }
                break;
            }
        }
    }

    /**
     * ネイティブルックアップの「取得」をプログラム的にトリガー
     * kintoneの保存バリデーション対策
     */
    function triggerLookupFetch(labelText, value) {
        if (!value) return;
        var controls = document.querySelectorAll('.control-gaia');
        var fieldEl = null;
        for (var i = 0; i < controls.length; i++) {
            var label = controls[i].querySelector('.control-label-text-gaia');
            if (label && label.textContent.trim() === labelText && !controls[i].closest('.subtable-gaia')) {
                fieldEl = controls[i];
                break;
            }
        }
        if (!fieldEl) return;

        var container = fieldEl.querySelector('.component-app-lookup-inputlookup');
        if (!container) return;

        var input = container.querySelector('input[type="text"]');
        var btn = container.querySelector('.input-lookup-gaia');
        if (!input || !btn) return;

        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        setTimeout(function () {
            btn.click();
            console.log('[Cascade] ネイティブルックアップ取得トリガー:', labelText, value);
        }, 150);
    }

    // =================================================================
    // スタイル注入
    // =================================================================
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);

        // Material Symbols フォントが未ロードの場合のみ追加
        if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=clear_all,new_window';
            document.head.appendChild(link);
        }
    }

    // =================================================================
    // CascadeLookup クラス
    // =================================================================

    function CascadeLookup(config) {
        this.config = config;
        this.container = null;
        this.cascadeSelects = [];
        this.filteredRecords = [];
        this.selectedRecord = null;
        this.lastFilterField = null;
        this.lastFilterValue = null;
        this.lastActiveFilterCode = null;
        this._onVisibilityChange = null;
    }

    /** スペース要素にUIを初期化 */
    CascadeLookup.prototype.init = function () {
        var self = this;
        var config = this.config;

        var space = kintone.app.record.getSpaceElement(config.spaceId);
        if (!space) {
            console.warn('[Cascade] スペース要素が見つかりません:', config.spaceId);
            return;
        }

        injectStyles();

        // コンテナ作成
        space.innerHTML = '';
        this.container = document.createElement('div');
        this.container.className = 'cascade-container';

        // リセットボタン（LKDと同じアイコンスタイル）
        var resetBtn = document.createElement('button');
        resetBtn.className = 'cascade-action-btn cascade-btn-reset';
        resetBtn.title = '選択をリセット';
        resetBtn.type = 'button';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">clear_all</span>';
        resetBtn.onclick = function (e) { e.stopPropagation(); self.reset(); };

        // 新規ボタン（LKDと同じアイコンスタイル）
        var newBtn = document.createElement('button');
        newBtn.className = 'cascade-action-btn cascade-btn-new';
        newBtn.title = '新規レコードを追加';
        newBtn.type = 'button';
        newBtn.innerHTML = '<span class="material-symbols-outlined">new_window</span>';
        newBtn.onclick = function (e) { e.stopPropagation(); self.openNewRecord(); };

        this.container.appendChild(resetBtn);
        this.container.appendChild(newBtn);
        space.appendChild(this.container);

        // タブ復帰時の自動リフレッシュ
        this._onVisibilityChange = function () {
            if (document.visibilityState === 'visible' && self.lastFilterField) {
                self.refreshCurrentFilter();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    };

    /** カスケードをリセット */
    CascadeLookup.prototype.reset = function () {
        var config = this.config;

        // 動的グループ要素を全て削除
        this.cascadeSelects.forEach(function (group) {
            var arrow = group.previousElementSibling;
            if (arrow && arrow.classList.contains('cascade-arrow')) arrow.remove();
            group.remove();
        });
        this.cascadeSelects = [];
        this.filteredRecords = [];
        this.selectedRecord = null;

        // フィルタードロップダウンをリセット + コピー先フィールドをクリア
        var rec = kintone.app.record.get();
        config.filters.forEach(function (f) {
            if (rec.record[f.fieldCode]) rec.record[f.fieldCode].value = '';
        });
        config.copyMap.forEach(function (m) {
            if (rec.record[m.to]) rec.record[m.to].value = '';
        });
        kintone.app.record.set(rec);

        // 両方のドロップダウンを使用可能にする
        config.filters.forEach(function (f) {
            setFieldDisabledByLabel(f.label, false);
        });
    };

    /** ドロップダウン変更時: 絞り込み開始 */
    CascadeLookup.prototype.onFilterChange = async function (sourceField, filterValue, activeFilterCode) {
        var self = this;
        var config = this.config;

        // フィルター状態を保存
        this.lastFilterField = sourceField;
        this.lastFilterValue = filterValue;
        this.lastActiveFilterCode = activeFilterCode;

        // 既存のカスケードグループを全削除
        this.cascadeSelects.forEach(function (group) {
            var prev = group.previousElementSibling;
            if (prev && prev.classList.contains('cascade-arrow')) prev.remove();
            group.remove();
        });
        this.cascadeSelects = [];
        this.selectedRecord = null;

        // 排他制御: 選択された方以外のドロップダウンを使用不可にする
        config.filters.forEach(function (f) {
            if (f.fieldCode === activeFilterCode) {
                setFieldDisabledByLabel(f.label, false);
            } else {
                setFieldDisabledByLabel(f.label, !!filterValue);
            }
        });

        if (!filterValue) {
            this.lastFilterField = null;
            this.lastFilterValue = null;
            config.filters.forEach(function (f) {
                setFieldDisabledByLabel(f.label, false);
            });
            return;
        }

        // 参照先アプリのレコードを絞り込み
        var condition = sourceField + ' = "' + filterValue + '"';
        this.filteredRecords = await fetchRecords(config.sourceAppId, [condition]);

        if (this.filteredRecords.length === 0) return;

        // 第1段: カスケード開始
        this.addCascadeLevel(0, this.filteredRecords);
    };

    /** タブ復帰時: 現在のフィルターで再取得 */
    CascadeLookup.prototype.refreshCurrentFilter = async function () {
        if (!this.lastFilterField || !this.lastFilterValue) return;
        console.log('[Cascade] タブ復帰 → カスケードを再取得します');
        await this.onFilterChange(this.lastFilterField, this.lastFilterValue, this.lastActiveFilterCode);
    };

    /** 参照先アプリの新規登録画面を別タブで開く */
    CascadeLookup.prototype.openNewRecord = function () {
        var config = this.config;
        var baseUrl = location.origin + '/k/' + config.sourceAppId + '/edit';
        var params = new URLSearchParams();

        if (config.newRecordFields && this.filteredRecords.length > 0) {
            var firstGroup = this.cascadeSelects[0];
            var selectedName = firstGroup ? (firstGroup.querySelector('select')?.value || '') : '';
            if (selectedName) {
                var nrf = config.newRecordFields;
                var matchRec = this.filteredRecords.find(function (r) {
                    return r[config.cascadeLevels[0].field]?.value === selectedName;
                });
                if (matchRec && matchRec[nrf.idField]?.value) {
                    params.set(nrf.paramName, matchRec[nrf.idField].value);
                }
            }
        }

        var url = params.toString() ? baseUrl + '?' + params.toString() : baseUrl;
        window.open(url, '_blank');
    };

    /** カスケードの段階を追加 */
    CascadeLookup.prototype.addCascadeLevel = function (levelIndex, records) {
        var self = this;
        var config = this.config;

        if (levelIndex >= config.cascadeLevels.length) {
            this.onRecordSelected(records[0]);
            return;
        }

        var level = config.cascadeLevels[levelIndex];
        var options = uniqueValues(records, level.field);

        if (options.length === 0) {
            this.addCascadeLevel(levelIndex + 1, records);
            return;
        }

        if (options.length === 1) {
            var filtered2 = records.filter(function (r) { return r[level.field]?.value === options[0]; });
            this.addCascadeLevel(levelIndex + 1, filtered2);
            return;
        }

        // グループ（ラベル + ドロップダウン）を作成
        var group = document.createElement('div');
        group.className = 'cascade-level-group';

        var levelLabel = document.createElement('div');
        levelLabel.className = 'cascade-level-label';
        levelLabel.textContent = level.label;
        group.appendChild(levelLabel);

        // kintoneプラグインスタイルのselect
        var selectOuter = document.createElement('div');
        selectOuter.className = 'kintoneplugin-select-outer';
        var selectWrapper = document.createElement('div');
        selectWrapper.className = 'kintoneplugin-select';

        var select = document.createElement('select');

        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = config.placeholderText || '--- 選択してください ---';
        select.appendChild(placeholder);

        options.forEach(function (val) {
            var opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });

        selectWrapper.appendChild(select);
        selectOuter.appendChild(selectWrapper);
        group.appendChild(selectOuter);

        var arrow = document.createElement('span');
        arrow.className = 'cascade-arrow';
        arrow.textContent = '→';

        select.addEventListener('change', function () {
            var idx = self.cascadeSelects.indexOf(group);
            var toRemove = self.cascadeSelects.splice(idx + 1);
            toRemove.forEach(function (g) {
                var p1 = g.previousElementSibling;
                if (p1 && p1.classList.contains('cascade-arrow')) p1.remove();
                g.remove();
            });

            if (!select.value) return;

            var filtered = records.filter(function (r) { return r[level.field]?.value === select.value; });

            if (filtered.length === 1) {
                self.onRecordSelected(filtered[0]);
            } else {
                self.addCascadeLevel(levelIndex + 1, filtered);
            }
        });

        // リセットボタンの前に挿入
        var resetBtn = this.container.querySelector('.cascade-btn-reset');
        this.container.insertBefore(arrow, resetBtn);
        this.container.insertBefore(group, resetBtn);
        this.cascadeSelects.push(group);
    };

    /** レコード確定 → フィールドにコピー */
    CascadeLookup.prototype.onRecordSelected = function (record) {
        var config = this.config;
        this.selectedRecord = record;

        var rec = kintone.app.record.get();

        config.copyMap.forEach(function (m) {
            if (rec.record[m.to] && record[m.from]) {
                rec.record[m.to].value = record[m.from].value ?? '';
            }
        });

        kintone.app.record.set(rec);

        // ルックアップのネイティブ「取得」をトリガー（保存バリデーション対策）
        if (config.lookupTrigger) {
            var lt = config.lookupTrigger;
            triggerLookupFetch(lt.label, rec.record[lt.fieldCode]?.value || '');
        }
    };

    // =================================================================
    // 自動コピー（他アプリからのハンドオーバー対応）
    // =================================================================

    async function autoPopulateFromId(config, detailId) {
        try {
            var ap = config.autoPopulate;
            var records = await fetchRecords(config.sourceAppId, [ap.sourceField + ' = "' + detailId + '"']);
            if (records.length === 0) {
                console.warn('[Cascade] ' + ap.sourceField + '=' + detailId + ' に該当するレコードが見つかりません');
                return;
            }
            var sourceRecord = records[0];
            var rec = kintone.app.record.get();
            config.copyMap.forEach(function (m) {
                if (rec.record[m.to] && sourceRecord[m.from]) {
                    rec.record[m.to].value = sourceRecord[m.from].value ?? '';
                }
            });
            kintone.app.record.set(rec);

            // ルックアップのネイティブ「取得」をトリガー
            if (config.lookupTrigger) {
                setTimeout(function () {
                    triggerLookupFetch(config.lookupTrigger.label, rec.record[config.lookupTrigger.fieldCode]?.value || '');
                }, 500);
            }

            console.log('[Cascade] ' + ap.sourceField + '=' + detailId + ' からフィールドを自動コピーしました');
        } catch (e) {
            console.error('[Cascade] 自動コピーエラー:', e);
        }
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    window.CascadeEngine = {
        /**
         * カスケードルックアップを初期化
         * @param {Object} config - 設定オブジェクト
         * @param {Object} event  - kintone イベントオブジェクト
         */
        init: function (config, event) {
            var instance = new CascadeLookup(config);
            instance.init();

            // 自動コピー（ハンドオーバー対応）
            if (config.autoPopulate && event) {
                var detailId = event.record[config.autoPopulate.fieldCode]?.value;
                if (detailId) {
                    autoPopulateFromId(config, detailId);
                }
            }

            // インスタンスを保存（changeイベントで使用）
            window._cascadeInstance = instance;

            return instance;
        },

        /**
         * フィルター変更を処理（kintoneのchangeイベントから呼び出し）
         * @param {string} sourceField      - 参照先アプリのフィルターフィールド名
         * @param {string} filterValue      - フィルター値
         * @param {string} activeFilterCode - アクティブなフィルターのフィールドコード
         */
        onFilterChange: function (sourceField, filterValue, activeFilterCode) {
            if (window._cascadeInstance) {
                window._cascadeInstance.onFilterChange(sourceField, filterValue, activeFilterCode);
            }
        }
    };

})();
