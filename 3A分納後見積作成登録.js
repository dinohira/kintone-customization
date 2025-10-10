(function () {
    'use strict';

    // =================================================================
    // 設定値
    // 環境に合わせてこれらの値を変更してください。
    // =================================================================

    /** @type {number} コピー先アプリのID */
    const DEST_APP_ID = 225;

    /** @type {string} 表示するボタンのテキスト */
    const BUTTON_CAPTION = '後見積を作成する';

    /** @type {string} ボタンに付与するユニークなID */
    const BUTTON_ID = 'koumitsumori-copy-btn';

    /** @type {string} ボタンに適用するCSSクラス名 */
    const BUTTON_CLASS = 'button013'; // ご要望に応じてクラス名を変更しました

    /**
     * @type {Array<{from: string, to: string}>}
     * コピー元とコピー先のフィールドマッピング（通常フィールド）
     * from: コピー元のフィールドコード
     * to:   コピー先のフィールドコード
     */
    const FIELD_PAIRS = [
        { from: '明細ID',         to: '明細ID' },
        { from: '客先詳細ID',     to: 'L客先選択' },
        { from: '見積用作業種別', to: 'L作業種別' },
        { from: 'カードNo',       to: 'カードNo' },
        { from: '数量',           to: '数量' },
        { from: '品名・寸法',     to: '品名・寸法' },
        { from: '図番その他',     to: '図番その他' },
        { from: '屑分類',         to: '屑分類' },
        { from: 'L素材中分類',    to: 'L素材中分類' },
        { from: '分納出荷数量',   to: '分納出荷数量' },
        { from: '分納品出荷日',   to: '分納品出荷日' },
        { from: 'F分納',          to: 'F分納' }
    ];

    /**
     * @type {Array<{fromTable: string, fromField: string, toTable: string, toField: string}>}
     * コピー元とコピー先のフィールドマッピング（サブテーブル）
     * fromTable: コピー元のサブテーブルのフィールドコード
     * fromField: コピー元のサブテーブル内のフィールドコード
     * toTable:   コピー先のサブテーブルのフィールドコード
     * toField:   コピー先のサブテーブル内のフィールドコード
     */
    const SUBTABLE_PAIRS = [
        { fromTable: 'T時間記録',    fromField: '作業時間', toTable: 'T時間計算',    toField: '時間指定1' },
        { fromTable: 'T面積記録',    fromField: '径',       toTable: 'T面積計算',    toField: '径2' },
        { fromTable: 'T面積記録',    fromField: '縦',       toTable: 'T面積計算',    toField: '縦2' },
        { fromTable: 'T面積記録',    fromField: '横',       toTable: 'T面積計算',    toField: '横2' },
        { fromTable: 'T鋸刃使用記録', fromField: '鋸刃',     toTable: 'T消耗品計算',  toField: 'L鋸刃選択' },
        { fromTable: 'T鋸刃使用記録', fromField: '使用本数',   toTable: 'T消耗品計算',  toField: '鋸刃使用本数' }
    ];


    /**
     * コピーボタンをヘッダーメニューに追加します。
     * @param {object} event kintoneイベントオブジェクト
     */
    function addCopyButton(event) {
        // ボタンが既に存在する場合は何もしない
        if (document.getElementById(BUTTON_ID)) {
            return;
        }

        const record = event.record;

        // --- ボタンの表示条件をチェック ---
        const isBunnouChecked = record['C分納1']?.value?.includes('分納') || record['C分納2']?.value?.includes('分納');
        const isKannouComplete = record['C完納']?.value?.includes('全量納品/作業完了');

        if (!isBunnouChecked || isKannouComplete) return;
        if (record['R見積種類']?.value !== '後見積(大同)') return;
        if (record['F後見積済']?.value !== '0') return;
        
        // 【変更点】客先名IDが1または2の場合はボタンを表示しない
        const customerNameId = record['客先名ID']?.value;
        if (customerNameId === '1' || customerNameId === '2') return;


        // --- ボタンを画面に追加 ---
        const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
        if (!headerMenuSpace) return;

        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.innerText = BUTTON_CAPTION;
        btn.className = BUTTON_CLASS;
        headerMenuSpace.appendChild(btn);

        // --- ボタンクリック時の処理 ---
        btn.onclick = handleCopyButtonClick;
    }

    /**
     * コピーボタンがクリックされたときの処理を非同期で実行します。
     */
    async function handleCopyButtonClick() {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn) return;

        // ボタンを無効化して二重クリックを防止
        btn.disabled = true;

        try {
            const sourceAppId = kintone.app.getId();
            const sourceRecordId = kintone.app.record.getId();

            // 1. 画面表示時からデータが変更されている可能性を考慮し、最新のレコード情報を取得
            const getResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'GET', {
                app: sourceAppId,
                id: sourceRecordId
            });
            const freshRecord = getResp.record;

            // 2. コピーのキーとなる「明細ID」が存在するかチェック
            const meiseiId = freshRecord['明細ID']?.value;
            if (!meiseiId) {
                // 本番環境ではalertの代わりに、よりUXの良い通知方法（例: SweetAlert2など）を検討してください。
                alert('明細IDが未入力のためコピーできません。');
                return;
            }

            // 3. コピー先に同じ「明細ID」のレコードが既に存在するか確認
            const query = `明細ID = "${meiseiId.replace(/"/g, '\\"')}"`;
            const checkResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: DEST_APP_ID,
                query: query,
                fields: ['$id']
            });

            // 既に存在する場合、そのレコードを開いて処理を終了
            if (checkResp.records && checkResp.records.length > 0) {
                const existingRecordId = checkResp.records[0].$id.value;
                alert('既に見積が作成されています。作成済みの見積画面を開きます。');
                window.open(`/k/${DEST_APP_ID}/show#record=${existingRecordId}`, '_blank');
                return;
            }

            // 4. コピー先の新しいレコードデータを作成
            const newRecord = createNewRecordData(freshRecord);

            // 5. コピー先アプリに新しいレコードを追加
            const addResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
                app: DEST_APP_ID,
                record: newRecord
            });

            // 6. 作成したレコードを開き、現在のウィンドウを閉じる
            alert('後見積を作成しました。新しいタブで開きます。');
            window.open(`/k/${DEST_APP_ID}/show#record=${addResp.id}`, '_blank');
            
            // 元の画面を更新するためにリロードを予約
            sessionStorage.setItem('reloadAfterCopy', '1');
            window.close();

        } catch (e) {
            console.error(e);
            const errorMessage = e.message || JSON.stringify(e.errors) || '不明なエラー';
            alert('コピー処理中にエラーが発生しました。\n' + errorMessage);
        } finally {
            // 処理が完了または失敗したら、ボタンを再度有効化
            // ただし、成功時はウィンドウを閉じるため、ここは主にエラー時に機能します。
            if(btn) btn.disabled = false;
        }
    }

    /**
     * コピー元のレコードデータから、コピー先の新しいレコードデータオブジェクトを生成します。
     * @param {object} sourceRecord - コピー元のレコードデータ
     * @returns {object} コピー先用の新しいレコードデータ
     */
    function createNewRecordData(sourceRecord) {
        const newRecord = {};

        // 通常フィールドの値をコピー
        FIELD_PAIRS.forEach(pair => {
            newRecord[pair.to] = {
                value: sourceRecord[pair.from]?.value ?? null
            };
        });

        // サブテーブルの値をコピー
        // 複数のサブテーブルから値を取得し、対応する先のサブテーブルにマージします。
        SUBTABLE_PAIRS.forEach(pair => {
            if (sourceRecord[pair.fromTable]?.value?.length > 0) {
                // コピー先のサブテーブルオブジェクトがなければ初期化
                if (!newRecord[pair.toTable]) {
                    newRecord[pair.toTable] = { value: [] };
                }

                sourceRecord[pair.fromTable].value.forEach((row, index) => {
                    // コピー先の行オブジェクトがなければ初期化
                    if (!newRecord[pair.toTable].value[index]) {
                        newRecord[pair.toTable].value[index] = { value: {} };
                    }
                    // 値をコピー
                    newRecord[pair.toTable].value[index].value[pair.toField] = {
                        value: row.value[pair.fromField]?.value ?? null
                    };
                });
            }
        });

        // 固定値を設定
        newRecord['R見積状態'] = { value: '後見積作成中' };

        return newRecord;
    }

    /**
     * 画面リロード後にsessionStorageをクリアするための処理
     */
    function handlePageReload() {
        if (sessionStorage.getItem('reloadAfterCopy') === '1') {
            sessionStorage.removeItem('reloadAfterCopy');
            location.reload();
        }
    }

    // kintoneイベントリスナー
    kintone.events.on('app.record.detail.show', function (event) {
        // 別タブから戻ってきたときに画面をリロードするための処理
        handlePageReload();
        // ボタン表示処理の呼び出し
        addCopyButton(event);
    });

})();
