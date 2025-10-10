(function () {
    'use strict';

    // ----------------------------------------------------------------
    // 設定
    // ----------------------------------------------------------------

    // コピー元アプリID (現在のアプリ)
    const SOURCE_APP_ID = kintone.app.getId();
    // コピー先アプリID
    const DEST_APP_ID = 225;

    // ボタン設定
    const BUTTON_ID = 'koumitsumori-copy-btn';
    const BUTTON_CAPTION_CREATE = '後見積作成'; // #修正2
    const BUTTON_CAPTION_MODIFY = '後見積修正'; // #修正3
    const BUTTON_CLASS = 'button013'; // #修正1

    // ボタンを配置する要素のセレクタ
    const TOOLBAR_SELECTOR = '.gaia-argoui-app-toolbar-statusmenu';

    // 通常フィールドのコピー設定 (from: コピー元フィールドコード, to: コピー先フィールドコード)
    const FIELD_PAIRS = [
        { from: '明細ID', to: '明細ID' },
        { from: '客先詳細ID', to: 'L客先選択' },
        { from: '見積用作業種別', to: 'L作業種別' },
        { from: 'カードNo', to: 'カードNo' },
        { from: '数量', to: '数量' },
        { from: '品名・寸法', to: '品名・寸法' },
        { from: '図番その他', to: '図番その他' },
        { from: '屑分類', to: '屑分類' },
        { from: 'L素材中分類', to: 'L素材中分類' }
    ];

    // サブテーブルのコピー設定
    const SUBTABLE_PAIRS = [
        { fromTable: 'T時間記録', fromField: '作業時間', toTable: 'T時間計算', toField: '時間指定1' },
        { fromTable: 'T面積記録', fromField: '径', toTable: 'T面積計算', toField: '径2' },
        { fromTable: 'T面積記録', fromField: '縦', toTable: 'T面積計算', toField: '縦2' },
        { fromTable: 'T面積記録', fromField: '横', toTable: 'T面積計算', toField: '横2' },
        { fromTable: 'T面積記録', fromField: 'カット数', toTable: 'T面積計算', toField: 'カット数2' }, // #修正4
        { fromTable: 'T鋸刃使用記録', fromField: '鋸刃', toTable: 'T消耗品計算', toField: 'L鋸刃選択' },
        { fromTable: 'T鋸刃使用記録', fromField: '使用本数', toTable: 'T消耗品計算', toField: '鋸刃使用本数' }
    ];

    /**
     * ボタンの表示条件を判定し、条件を満たせばボタンを画面に追加します。
     * @param {object} event - kintoneイベントオブジェクト
     */
    function showCopyButton(event) {
        // ボタンが既に存在する場合は何もしない
        if (document.getElementById(BUTTON_ID)) {
            return;
        }

        const record = event.record;

        // --- ボタンを表示しない条件 ---
        // 見積種類が「後見積(大同)」でない場合
        if (record['R見積種類'].value !== '後見積(大同)') return;
        // 分納が設定されている場合
        if ((record['C分納1']?.value?.length > 0) || (record['C分納2']?.value?.length > 0)) return;
        // 特定の客先IDの場合
        const nonTargetCustomerIds = ['1', '2'];
        if (record['客先名ID'] && nonTargetCustomerIds.includes(record['客先名ID'].value)) return;

        // #修正3: 「後見積済」フラグに応じてボタンのキャプションを変更
        const isAlreadyCreated = record['F後見積済'].value === '1';
        const buttonCaption = isAlreadyCreated ? BUTTON_CAPTION_MODIFY : BUTTON_CAPTION_CREATE;

        // ツールバー要素を取得
        const toolbar = document.querySelector(TOOLBAR_SELECTOR);
        if (!toolbar) {
            console.error('ツールバー要素が見つかりません。');
            return;
        }

        // ボタンを作成して配置
        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.innerText = buttonCaption;
        button.className = BUTTON_CLASS;
        toolbar.appendChild(button);

        // ボタンクリック時の処理を登録
        button.onclick = () => handleCopyClick(event);
    }

    /**
     * コピーボタンがクリックされたときの処理を実行します。
     * @param {object} event - kintoneイベントオブジェクト
     */
    async function handleCopyClick(event) {
        const button = document.getElementById(BUTTON_ID);
        button.disabled = true;

        try {
            const record = event.record;
            const detailId = record['明細ID']?.value;

            if (!detailId) {
                alert('明細IDが未入力のためコピーできません。');
                return;
            }

            // コピー先に同じ明細IDのレコードが既に存在するかチェック
            const query = `明細ID = "${detailId.replace(/"/g, '\\"')}"`;
            const checkResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: DEST_APP_ID,
                query: query,
                fields: ['$id']
            });

            // 存在する場合、そのレコードを開いて終了
            if (checkResp.records.length > 0) {
                const existingRecId = checkResp.records[0].$id.value;
                // 「後見積修正」ボタンを押した場合は、既存レコードを開くだけ
                if (record['F後見積済'].value === '1') {
                    alert('作成済みの見積画面を開きます。');
                } else {
                    alert('既に見積が作成されています。作成済みの見積画面を開きます。');
                }
                window.open(`/k/${DEST_APP_ID}/show#record=${existingRecId}`, '_blank');
                return;
            }

            // --- 新規レコードの作成処理 ---
            const newRecord = {};

            // 通常フィールドの値をコピー
            FIELD_PAIRS.forEach(pair => {
                newRecord[pair.to] = { value: record[pair.from]?.value ?? null };
            });

            // サブテーブルの値をコピー
            SUBTABLE_PAIRS.forEach(pair => {
                const fromTableValue = record[pair.fromTable]?.value;
                if (!Array.isArray(fromTableValue)) return;

                if (!newRecord[pair.toTable]) {
                    newRecord[pair.toTable] = { value: [] };
                }

                fromTableValue.forEach((row, index) => {
                    if (!newRecord[pair.toTable].value[index]) {
                        newRecord[pair.toTable].value[index] = { value: {} };
                    }
                    const fromFieldValue = row.value[pair.fromField]?.value;
                    newRecord[pair.toTable].value[index].value[pair.toField] = {
                        value: fromFieldValue ?? null
                    };
                });
            });

            // 見積状態を固定値で設定
            newRecord['R見積状態'] = { value: '後見積作成中' };

            // コピー先アプリにレコードを登録
            const addResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
                app: DEST_APP_ID,
                record: newRecord
            });

            // コピー元レコードの「後見積済」フラグを更新
            await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                app: SOURCE_APP_ID,
                id: event.recordId,
                record: { 'F後見積済': { value: '1' } }
            });

            // 作成したレコードを新しいタブで開き、現在の画面をリロード
            window.open(`/k/${DEST_APP_ID}/show#record=${addResp.id}`, '_blank');
            location.reload();

        } catch (e) {
            console.error(e);
            alert('コピー処理中にエラーが発生しました。\n詳細はコンソールを確認してください。\n' + (e.message || JSON.stringify(e)));
        } finally {
            button.disabled = false;
        }
    }

    // レコード詳細画面の表示イベント
    kintone.events.on('app.record.detail.show', showCopyButton);

})();
