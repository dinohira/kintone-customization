(function () {
    'use strict';

    // =================================================================
    // 統合設定 (客先名ID: 1 専用)
    // =================================================================
    const CONFIG = {
        DEST_APP_ID: 316, // 転記先アプリID
        BUTTON_ID: 'dst-meisai-copy-btn-id1', // IDが重複しないよう念のため変更
        BUTTON_LABEL: '明細ID転記',
        // レコード特定用のキーフィールド ("処理年月" と "客先詳細ID" の両方で特定)
        UNIQUE_KEYS: ['処理年月', '客先詳細ID'],
        
        // テーブル設定 (TDST輸送費を削除、T明細項目のみ残す)
        TABLES: {
            MEISAI: {
                CODE: 'T明細項目',
                KEY_FIELD: '明細ID',
                // コピーするフィールドコード (明細IDのみ)
                FIELD_MAP: {
                    '明細ID': '明細ID'
                }
            }
        }
    };

    /**
     * テーブル行データを生成する関数
     */
    function createTableRow(srcRecord, fieldMap) {
        const row = {};
        for (const [toField, fromField] of Object.entries(fieldMap)) {
            if (srcRecord[fromField] && srcRecord[fromField].value !== undefined) {
                row[toField] = { value: srcRecord[fromField].value };
            }
        }
        return { value: row };
    }

    // --- イベントハンドラ ---
    kintone.events.on('app.record.detail.show', function (event) {
        const record = event.record;
        const customerId = record['客先名ID']?.value;

        // --- 客先名IDが '1' ではない場合は処理を終了 ---
        // (条件を "2" から "1" に変更)
        if (customerId !== '1') {
            return event;
        }

        // 転記済みの場合はボタンを表示しない
        if (record['R明細状態']?.value === '明細転記済' || document.getElementById(CONFIG.BUTTON_ID)) {
            return event;
        }

        // --- ボタンの作成と配置 ---
        const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
        if (!headerMenuSpace) return event;

        const btn = document.createElement('button');
        btn.id = CONFIG.BUTTON_ID;
        btn.className = 'button013'; // kintoneライクなスタイルクラス（環境に合わせて調整してください）
        btn.innerText = CONFIG.BUTTON_LABEL;
        // スタイル調整（任意）
        btn.style.height = '48px';
        btn.style.marginTop = '10px';
        btn.style.marginLeft = '10px';
        
        headerMenuSpace.appendChild(btn);

        // --- ボタンクリック時の処理 ---
        btn.onclick = async () => {
            btn.disabled = true;
            try {
                const srcRecord = kintone.app.record.get().record;
                const srcRecordId = kintone.app.record.getId();

                // --- 必須項目チェックとクエリ作成 ---
                const queryParts = [];
                for (const key of CONFIG.UNIQUE_KEYS) {
                    const value = srcRecord[key]?.value;
                    if (!value) {
                        alert(`必須項目「${key}」が入力されていません。`);
                        return; // finallyでボタン有効化
                    }
                    // 文字列フィールドとして検索クエリを作成
                    queryParts.push(`${key} = "${value}"`);
                }
                // UNIQUE_KEYSに含まれるすべての条件を AND で結合
                const query = queryParts.join(' and ');

                // --- コピー先レコードを検索 ---
                const getResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                    app: CONFIG.DEST_APP_ID,
                    query: query,
                    // 必要なフィールドのみ取得 (輸送費テーブルは除外)
                    fields: ['$id', CONFIG.TABLES.MEISAI.CODE]
                });

                // --- 送信するレコードデータを準備 ---
                const meisaiConf = CONFIG.TABLES.MEISAI;

                // 明細行の作成 (明細IDのみ)
                const newRow = createTableRow(srcRecord, meisaiConf.FIELD_MAP);

                let openRecordId;

                // --- レコード更新または新規作成 ---
                if (getResp.records.length > 0) { // 更新
                    const destRecord = getResp.records[0];
                    openRecordId = destRecord['$id'].value;
                    const srcMeisaiId = srcRecord[meisaiConf.KEY_FIELD]?.value;
                    
                    // 既存のテーブル行を取得
                    const meisaiRows = destRecord[meisaiConf.CODE].value;

                    // 明細テーブル更新ロジック
                    // キーフィールド(明細ID)が一致する行を探す
                    const targetIndex = meisaiRows.findIndex(r => r.value[meisaiConf.KEY_FIELD]?.value === srcMeisaiId);

                    if (targetIndex > -1) {
                        // 既存行を更新 (上書き)
                        meisaiRows[targetIndex] = newRow;
                    } else {
                        // 新規行を追加
                        meisaiRows.push(newRow);
                    }

                    // 更新実行
                    await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                        app: CONFIG.DEST_APP_ID,
                        id: openRecordId,
                        record: {
                            [meisaiConf.CODE]: { value: meisaiRows }
                        }
                    });

                } else { // 新規作成
                    const meisaiRowsToAdd = [newRow];

                    const postRecord = {};
                    // キーフィールド(処理年月 + 客先詳細ID)をセット
                    CONFIG.UNIQUE_KEYS.forEach(key => postRecord[key] = { value: srcRecord[key].value });
                    // テーブルをセット
                    postRecord[meisaiConf.CODE] = { value: meisaiRowsToAdd };

                    // 作成実行
                    const postResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
                        app: CONFIG.DEST_APP_ID,
                        record: postRecord
                    });
                    openRecordId = postResp.id;
                }

                // --- コピー元レコードの状態を更新 ---
                await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                    app: kintone.app.getId(),
                    id: srcRecordId,
                    record: { 'R明細状態': { value: '明細転記済' } }
                });

                alert('明細IDの転記が完了しました。');
                // 転記先レコードを別タブで開く
                window.open(`/k/${CONFIG.DEST_APP_ID}/show#record=${openRecordId}`, '_blank');
                // 元の画面をリロード
                location.reload();

            } catch (error) {
                console.error(error);
                alert('エラーが発生しました: ' + (error.message || error));
            } finally {
                btn.disabled = false;
            }
        };
        return event;
    });
})();