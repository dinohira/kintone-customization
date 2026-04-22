/**
 * カスケードルックアップ — アプリ236 案件登録
 *
 * G作業情報グループ内に配置した2つのドロップダウン
 *  - Dよみ先頭文字（あ/か/さ/た/な/は/ま/や/ら/わ）
 *  - D客先グループ（A〜F）
 * のいずれかを選択すると、アプリ195 (MA客先詳細) を絞り込み、
 * 4段階のカスケードドロップダウン（初期フィルター→客先名→所属部署→担当者名）
 * を動的に生成し、最終選択時に236のフィールドへコピーする。
 *
 * @version 1.3.0
 * @date 2026-04-10
 */
(function () {
    'use strict';

    // =================================================================
    // CONFIG
    // =================================================================
    const CONFIG = {
        SOURCE_APP_ID: 195,       // MA客先詳細
        TARGET_APP_ID: 236,       // 案件登録

        // 初期フィルター用ドロップダウンのフィールドコード
        FILTER_YOMI: 'Dよみ先頭文字',
        FILTER_GROUP: 'D客先グループ',

        // フィルター用ドロップダウンのラベル名（DOM検索用）
        FILTER_YOMI_LABEL: 'よみ先頭文字',
        FILTER_GROUP_LABEL: '客先グループ',

        // カスケードの段階定義（195のフィールドコード）
        CASCADE_LEVELS: [
            { field: '客先名',     label: '客先名' },
            { field: '所属部署',   label: '所属部署' },
            { field: '担当者名',   label: '担当者名' }
        ],

        // 最終選択時のフィールドコピーマッピング（236 ← 195）
        COPY_MAP: [
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

        // UI設定
        SPACE_ID: 'cascade-lookup-space',
        PLACEHOLDER_TEXT: '--- 選択してください ---'
    };

    // =================================================================
    // スタイル定義（kintone標準に合わせたシンプルなスタイル）
    // =================================================================
    const STYLES = `
        .cascade-container {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            padding: 4px 0;
        }
        .cascade-select {
            font-size: 14px;
            min-width: 160px;
            max-width: 320px;
        }
        .cascade-arrow {
            color: #bbb;
            font-size: 14px;
            user-select: none;
        }
        .cascade-reset-btn,
        .cascade-new-btn {
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid #ccc;
            border-radius: 3px;
            background: #f5f5f5;
            color: #555;
            cursor: pointer;
        }
        .cascade-reset-btn:hover,
        .cascade-new-btn:hover {
            background: #e8e8e8;
            border-color: #bbb;
        }
        .cascade-new-btn {
            background: #e3f2fd;
            border-color: #90caf9;
            color: #1565c0;
        }
        .cascade-new-btn:hover {
            background: #bbdefb;
            border-color: #64b5f6;
        }
    `;

    // =================================================================
    // ユーティリティ
    // =================================================================

    /** 195からレコードを取得（絞り込み条件付き） */
    async function fetchRecords(conditions) {
        const parts = conditions.filter(Boolean);
        const query = parts.length > 0 ? parts.join(' and ') : '';
        const allRecords = [];
        let offset = 0;
        const limit = 500;

        while (true) {
            const q = query ? `${query} order by $id asc limit ${limit} offset ${offset}` : `order by $id asc limit ${limit} offset ${offset}`;
            const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.SOURCE_APP_ID,
                query: q
            });
            allRecords.push(...resp.records);
            if (resp.records.length < limit) break;
            offset += limit;
        }
        return allRecords;
    }

    /** 配列からユニークな値を取得（空文字除外） */
    function uniqueValues(records, fieldCode) {
        const set = new Set();
        records.forEach(r => {
            const val = r[fieldCode]?.value;
            if (val && val.trim()) set.add(val);
        });
        return [...set].sort();
    }

    /**
     * kintoneフィールドのDOM要素を無効化/有効化する
     * ラベルテキストからフィールドの親要素を特定してスタイルを切り替える
     */
    function setFieldDisabledByLabel(labelText, disabled) {
        const labels = document.querySelectorAll('.control-label-text-gaia');
        for (const label of labels) {
            if (label.textContent.trim() === labelText) {
                const fieldEl = label.closest('.control-gaia');
                if (fieldEl) {
                    if (disabled) {
                        fieldEl.style.pointerEvents = 'none';
                        fieldEl.style.opacity = '0.4';
                    } else {
                        fieldEl.style.pointerEvents = '';
                        fieldEl.style.opacity = '';
                    }
                }
                break;
            }
        }
    }

    // =================================================================
    // UI構築
    // =================================================================

    class CascadeLookup {
        constructor() {
            this.container = null;
            this.cascadeSelects = [];
            this.filteredRecords = [];
            this.selectedRecord = null;
            this.lastFilterField = null;
            this.lastFilterValue = null;
            this._onVisibilityChange = null;
        }

        /** スペース要素にUIを初期化 */
        init() {
            const space = kintone.app.record.getSpaceElement(CONFIG.SPACE_ID);
            if (!space) {
                console.warn('[CascadeLookup] スペース要素が見つかりません:', CONFIG.SPACE_ID);
                return;
            }

            // スタイル注入
            if (!document.getElementById('cascade-lookup-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'cascade-lookup-styles';
                styleEl.textContent = STYLES;
                document.head.appendChild(styleEl);
            }

            // コンテナ作成
            space.innerHTML = '';
            this.container = document.createElement('div');
            this.container.className = 'cascade-container';

            // リセットボタン
            const resetBtn = document.createElement('button');
            resetBtn.className = 'cascade-reset-btn';
            resetBtn.textContent = 'リセット';
            resetBtn.type = 'button';
            resetBtn.onclick = () => this.reset();

            // 新規ボタン（195の新規登録画面を別タブで開く）
            const newBtn = document.createElement('button');
            newBtn.className = 'cascade-new-btn';
            newBtn.textContent = '新規';
            newBtn.type = 'button';
            newBtn.onclick = () => this.openNewRecord();

            this.container.appendChild(resetBtn);
            this.container.appendChild(newBtn);
            space.appendChild(this.container);

            // タブ復帰時の自動リフレッシュ
            this._onVisibilityChange = () => {
                if (document.visibilityState === 'visible' && this.lastFilterField) {
                    this.refreshCurrentFilter();
                }
            };
            document.addEventListener('visibilitychange', this._onVisibilityChange);
        }

        /** カスケードをリセット */
        reset() {
            // 動的select要素を全て削除
            this.cascadeSelects.forEach(el => {
                const arrow = el.previousElementSibling;
                if (arrow && arrow.classList.contains('cascade-arrow')) arrow.remove();
                el.remove();
            });
            this.cascadeSelects = [];
            this.filteredRecords = [];
            this.selectedRecord = null;

            // kintoneフィールドのドロップダウンをリセット + コピー先フィールドをクリア
            const rec = kintone.app.record.get();
            rec.record[CONFIG.FILTER_YOMI].value = '';
            rec.record[CONFIG.FILTER_GROUP].value = '';
            // コピー先フィールドをクリア
            CONFIG.COPY_MAP.forEach(({ to }) => {
                if (rec.record[to]) {
                    rec.record[to].value = '';
                }
            });
            kintone.app.record.set(rec);

            // 両方のドロップダウンを使用可能にする
            setFieldDisabledByLabel(CONFIG.FILTER_YOMI_LABEL, false);
            setFieldDisabledByLabel(CONFIG.FILTER_GROUP_LABEL, false);

            // カスケードフラグをクリア
            try { sessionStorage.removeItem('cascadeLookupCompleted_236'); } catch(e) { /* ignore */ }
        }

        /** ドロップダウン変更時: 絞り込み開始 */
        async onFilterChange(filterField, filterValue, activeFilterCode) {
            // フィルター状態を保存（タブ復帰時のリフレッシュ用）
            this.lastFilterField = filterField;
            this.lastFilterValue = filterValue;
            this.lastActiveFilterCode = activeFilterCode;

            // 既存のカスケードselectを全削除
            this.cascadeSelects.forEach(el => {
                const prev1 = el.previousElementSibling;
                if (prev1 && prev1.classList.contains('cascade-arrow')) prev1.remove();
                el.remove();
            });
            this.cascadeSelects = [];
            this.selectedRecord = null;

            // 排他制御: 選択された方以外のドロップダウンを使用不可にする
            if (activeFilterCode === CONFIG.FILTER_YOMI) {
                setFieldDisabledByLabel(CONFIG.FILTER_GROUP_LABEL, !!filterValue);
                setFieldDisabledByLabel(CONFIG.FILTER_YOMI_LABEL, false);
            } else {
                setFieldDisabledByLabel(CONFIG.FILTER_YOMI_LABEL, !!filterValue);
                setFieldDisabledByLabel(CONFIG.FILTER_GROUP_LABEL, false);
            }

            if (!filterValue) {
                this.lastFilterField = null;
                this.lastFilterValue = null;
                setFieldDisabledByLabel(CONFIG.FILTER_YOMI_LABEL, false);
                setFieldDisabledByLabel(CONFIG.FILTER_GROUP_LABEL, false);
                return;
            }

            // 195のレコードを絞り込み
            const condition = `${filterField} = "${filterValue}"`;
            this.filteredRecords = await fetchRecords([condition]);

            if (this.filteredRecords.length === 0) {
                return;
            }

            // 第1段: 客先名の選択肢を生成
            this.addCascadeLevel(0, this.filteredRecords);
        }

        /** タブ復帰時: 現在のフィルターで再取得 */
        async refreshCurrentFilter() {
            if (!this.lastFilterField || !this.lastFilterValue) return;
            console.log('[CascadeLookup] タブ復帰 → カスケードを再取得します');
            await this.onFilterChange(this.lastFilterField, this.lastFilterValue, this.lastActiveFilterCode);
        }

        /** 195の新規登録画面を別タブで開く（カスケード文脈をプリフィル） */
        openNewRecord() {
            const baseUrl = `${location.origin}/k/${CONFIG.SOURCE_APP_ID}/edit`;
            const params = new URLSearchParams();

            // カスケードで客先名が選択済みの場合、客先名IDをプリフィル
            // 195側のヘルパースクリプトがcascadeLookupIdを検知し、
            // L客先名ルックアップに自動セット＆取得を実行する
            if (this.filteredRecords.length > 0) {
                const selectedName = this.cascadeSelects[0]?.value;
                if (selectedName) {
                    const matchRec = this.filteredRecords.find(r => r['客先名']?.value === selectedName);
                    if (matchRec && matchRec['客先名ID']?.value) {
                        params.set('cascadeLookupId', matchRec['客先名ID'].value);
                    }
                }
            }

            const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
            window.open(url, '_blank');
        }

        /** カスケードの段階を追加 */
        addCascadeLevel(levelIndex, records) {
            if (levelIndex >= CONFIG.CASCADE_LEVELS.length) {
                this.onRecordSelected(records[0]);
                return;
            }

            const level = CONFIG.CASCADE_LEVELS[levelIndex];
            const options = uniqueValues(records, level.field);

            if (options.length === 0) {
                this.addCascadeLevel(levelIndex + 1, records);
                return;
            }

            if (options.length === 1) {
                const filtered = records.filter(r => r[level.field]?.value === options[0]);
                this.addCascadeLevel(levelIndex + 1, filtered);
                return;
            }

            const arrow = document.createElement('span');
            arrow.className = 'cascade-arrow';
            arrow.textContent = '▸';

            const select = document.createElement('select');
            select.className = 'cascade-select';
            select.id = `cascade-level-${levelIndex}`;

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = `${CONFIG.PLACEHOLDER_TEXT} (${options.length}件)`;
            select.appendChild(placeholder);

            options.forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt;
                optEl.textContent = opt;
                select.appendChild(optEl);
            });

            select.addEventListener('change', () => {
                const idx = this.cascadeSelects.indexOf(select);
                const toRemove = this.cascadeSelects.splice(idx + 1);
                toRemove.forEach(el => {
                    const p1 = el.previousElementSibling;
                    if (p1 && p1.classList.contains('cascade-arrow')) p1.remove();
                    el.remove();
                });

                if (!select.value) return;

                const filtered = records.filter(r => r[level.field]?.value === select.value);

                if (filtered.length === 1) {
                    this.onRecordSelected(filtered[0]);
                } else {
                    this.addCascadeLevel(levelIndex + 1, filtered);
                }
            });

            const resetBtn = this.container.querySelector('.cascade-reset-btn');
            this.container.insertBefore(arrow, resetBtn);
            this.container.insertBefore(select, resetBtn);
            this.cascadeSelects.push(select);
        }

        /** レコード確定 → フィールドにコピー */
        onRecordSelected(record) {
            this.selectedRecord = record;

            const rec = kintone.app.record.get();

            CONFIG.COPY_MAP.forEach(({ to, from }) => {
                if (rec.record[to] && record[from]) {
                    rec.record[to].value = record[from].value ?? '';
                }
            });

            kintone.app.record.set(rec);

            // カスケード完了フラグをセット（ルックアップ自動取得との競合回避用）
            try {
                sessionStorage.setItem('cascadeLookupCompleted_236', 'true');
            } catch(e) { /* ignore */ }
        }
    }

    // =================================================================
    // イベント登録
    // =================================================================

    let activeLookup = null;

    /**
     * 客先詳細IDからアプリ195のレコードを取得し、フィールドに自動コピーする
     * 他アプリ(225, 240)からのハンドオーバー時に使用
     */
    async function autoPopulateFromId(detailId) {
        try {
            const records = await fetchRecords([`客先詳細ID = "${detailId}"`]);
            if (records.length === 0) {
                console.warn('[CascadeLookup] 客先詳細ID=' + detailId + ' に該当するレコードが見つかりません');
                return;
            }
            const sourceRecord = records[0];
            const rec = kintone.app.record.get();
            CONFIG.COPY_MAP.forEach(({ to, from }) => {
                if (rec.record[to] && sourceRecord[from]) {
                    rec.record[to].value = sourceRecord[from].value ?? '';
                }
            });
            kintone.app.record.set(rec);
            console.log('[CascadeLookup] 客先詳細ID=' + detailId + ' からフィールドを自動コピーしました');

            // カスケード完了フラグをセット（ルックアップ自動取得との競合回避用）
            try { sessionStorage.setItem('cascadeLookupCompleted_236', 'true'); } catch(e) { /* ignore */ }
        } catch (e) {
            console.error('[CascadeLookup] 自動コピーエラー:', e);
        }
    }

    // 表示イベント: インスタンスを初期化
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], (event) => {
        activeLookup = new CascadeLookup();
        activeLookup.init();

        // カスケードフラグをクリア
        try { sessionStorage.removeItem('cascadeLookupCompleted_236'); } catch(e) { /* ignore */ }

        // 客先詳細IDが既にある場合（他アプリからのハンドオーバー時）
        // アプリ195から該当レコードを取得してフィールドに自動コピー
        const detailId = event.record['客先詳細ID']?.value;
        if (detailId) {
            autoPopulateFromId(detailId);
        }

        return event;
    });

    // よみ先頭文字の変更イベント
    kintone.events.on([
        'app.record.create.change.Dよみ先頭文字',
        'app.record.edit.change.Dよみ先頭文字'
    ], (event) => {
        const value = event.record[CONFIG.FILTER_YOMI].value;
        event.record[CONFIG.FILTER_GROUP].value = '';

        if (!activeLookup) {
            activeLookup = new CascadeLookup();
            activeLookup.init();
        }
        // kintoneのchangeイベントはThenable(Promise)の戻り値を許可しないため
        // 非同期処理はfire-and-forgetで実行する
        activeLookup.onFilterChange('よみ先頭文字', value, CONFIG.FILTER_YOMI);
        return event;
    });

    // 客先グループの変更イベント
    kintone.events.on([
        'app.record.create.change.D客先グループ',
        'app.record.edit.change.D客先グループ'
    ], (event) => {
        const value = event.record[CONFIG.FILTER_GROUP].value;
        event.record[CONFIG.FILTER_YOMI].value = '';

        if (!activeLookup) {
            activeLookup = new CascadeLookup();
            activeLookup.init();
        }
        // kintoneのchangeイベントはThenable(Promise)の戻り値を許可しないため
        // 非同期処理はfire-and-forgetで実行する
        activeLookup.onFilterChange('客先グループ', value, CONFIG.FILTER_GROUP);
        return event;
    });

})();
