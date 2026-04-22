(function () {
    'use strict';

    // =================================================================
    // 統合設定 (客先名ID: 2 専用)
    // =================================================================
    const CONFIG = {
        DEST_APP_ID: 260,
        BUTTON_ID: 'dst-tsuki-betsu-copy-btn',
        BUTTON_LABEL: 'DST月別明細転記',
        // レコード特定用のキーフィールド
        UNIQUE_KEYS: ['処理年月', '鍛延_火造'],
        // 特別加算の設定
        SPECIAL_ADDITION: {
            CHECKBOX: 'C特別加算2',
            REMARKS: '特別加算額備考2',
            AMOUNT: '明細項目_特別加算額2',
            DEST_TYPE_FIELD: 'DetailItemType',
            TYPE_NORMAL: '通常',
            TYPE_SPECIAL: '特別加算',
            // 特別加算行のフィールドマッピング
            FIELD_MAP: {
                'DST見積り内容': 'REMARKS', // 備考 -> DST見積り内容
                '希望単価': 'AMOUNT',     // 金額 -> 希望単価
                '合計金額': 'AMOUNT'      // 金額 -> 合計金額
            }
        },
        // テーブル設定
        TABLES: {
            MEISAI: {
                CODE: 'T明細項目',
                KEY_FIELD: '明細ID',
                FIELD_MAP: { /* DST用のフィールドマッピング */
                    '明細ID': '明細ID', '納品日': 'DST納品日', 'カードNo': 'カードNo', '屑分類': '屑分類', '品名・寸法': '品名・寸法', '個数': '個数', '工番': '工番', '加工工程': '加工工程', 'DST見積り内容': 'DST見積り内容', '希望単価': '希望単価', '合計金額': '合計金額'
                }
            },
            YUSOHI: {
                CODE: 'TDST輸送費',
                KEY_FIELD: '明細ID2',
                KEY_SOURCE_FIELD: '明細ID',
                CONDITION_FIELD: '輸送係数2', // このフィールドに値があればコピー
                FIELD_MAP: { /* DST用のフィールドマッピング */
                    '明細ID2': '明細ID',
                    '輸送係数': '輸送係数2',
                    '大同単品輸送費': 'DST単品輸送費',
                    '重量': '明細用重量2',
                    '明細用重量': '明細用重量2'
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

        // --- 客先名IDが '2' ではない場合は処理を終了 ---
        if (customerId !== '2') {
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
        btn.className = 'button013';
        btn.innerText = CONFIG.BUTTON_LABEL;
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
                    queryParts.push(`${key} = "${value}"`);
                }
                const query = queryParts.join(' and ');

                // --- コピー先レコードを検索 ---
                const getResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                    app: CONFIG.DEST_APP_ID,
                    query: query,
                    fields: ['$id', CONFIG.TABLES.MEISAI.CODE, CONFIG.TABLES.YUSOHI.CODE]
                });

                // --- 送信するレコードデータを準備 ---
                const saConfig = CONFIG.SPECIAL_ADDITION;
                const meisaiConf = CONFIG.TABLES.MEISAI;
                const yusohiConf = CONFIG.TABLES.YUSOHI;

                // 1. 通常行
                const normalRow = createTableRow(srcRecord, meisaiConf.FIELD_MAP);
                normalRow.value[saConfig.DEST_TYPE_FIELD] = { value: saConfig.TYPE_NORMAL };

                // 2. 特別加算行
                const isSpecialAdditionChecked = srcRecord[saConfig.CHECKBOX]?.value.length > 0;
                let specialAdditionRow = null;
                if (isSpecialAdditionChecked) {
                    specialAdditionRow = {
                        value: {
                            [meisaiConf.KEY_FIELD]: { value: srcRecord[meisaiConf.KEY_FIELD].value },
                            [saConfig.DEST_TYPE_FIELD]: { value: saConfig.TYPE_SPECIAL }
                        }
                    };
                    for (const [toField, fromKey] of Object.entries(saConfig.FIELD_MAP)) {
                        specialAdditionRow.value[toField] = { value: srcRecord[saConfig[fromKey]].value };
                    }
                }

                // 3. 輸送費行
                let newYusohiRow = null;
                if (srcRecord[yusohiConf.CONDITION_FIELD]?.value) {
                    newYusohiRow = createTableRow(srcRecord, yusohiConf.FIELD_MAP);
                }

                let openRecordId;
                // --- レコード更新または新規作成 ---
                if (getResp.records.length > 0) { // 更新
                    const destRecord = getResp.records[0];
                    openRecordId = destRecord['$id'].value;
                    const srcMeisaiId = srcRecord[meisaiConf.KEY_FIELD]?.value;
                    const meisaiRows = destRecord[meisaiConf.CODE].value;

                    // 明細テーブル更新
                    const normalIndex = meisaiRows.findIndex(r => r.value[meisaiConf.KEY_FIELD]?.value === srcMeisaiId && r.value[saConfig.DEST_TYPE_FIELD]?.value === saConfig.TYPE_NORMAL);
                    if (normalIndex > -1) meisaiRows[normalIndex] = normalRow; else meisaiRows.push(normalRow);

                    const specialIndex = meisaiRows.findIndex(r => r.value[meisaiConf.KEY_FIELD]?.value === srcMeisaiId && r.value[saConfig.DEST_TYPE_FIELD]?.value === saConfig.TYPE_SPECIAL);
                    if (isSpecialAdditionChecked) {
                        if (specialIndex > -1) meisaiRows[specialIndex] = specialAdditionRow; else meisaiRows.push(specialAdditionRow);
                    } else if (specialIndex > -1) {
                        meisaiRows.splice(specialIndex, 1);
                    }

                    // 輸送費テーブル更新
                    const yusohiRows = destRecord[yusohiConf.CODE]?.value || [];
                    if (newYusohiRow) {
                        const srcYusohiKey = srcRecord[yusohiConf.KEY_SOURCE_FIELD]?.value;
                        const yusohiIndex = yusohiRows.findIndex(r => r.value[yusohiConf.KEY_FIELD]?.value === srcYusohiKey);
                        if (yusohiIndex > -1) yusohiRows[yusohiIndex] = newYusohiRow; else yusohiRows.push(newYusohiRow);
                    }

                    await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                        app: CONFIG.DEST_APP_ID, id: openRecordId,
                        record: {
                            [meisaiConf.CODE]: { value: meisaiRows },
                            [yusohiConf.CODE]: { value: yusohiRows }
                        }
                    });
                } else { // 新規作成
                    const meisaiRowsToAdd = [normalRow];
                    if (specialAdditionRow) meisaiRowsToAdd.push(specialAdditionRow);

                    const postRecord = {};
                    CONFIG.UNIQUE_KEYS.forEach(key => postRecord[key] = { value: srcRecord[key].value });
                    postRecord[meisaiConf.CODE] = { value: meisaiRowsToAdd };
                    if (newYusohiRow) postRecord[yusohiConf.CODE] = { value: [newYusohiRow] };

                    const postResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', { app: CONFIG.DEST_APP_ID, record: postRecord });
                    openRecordId = postResp.id;
                }

                // --- コピー元レコードの状態を更新 ---
                await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                    app: kintone.app.getId(), id: srcRecordId, record: { 'R明細状態': { value: '明細転記済' } }
                });

                alert('明細の転記が完了しました。');
                window.open(`/k/${CONFIG.DEST_APP_ID}/show#record=${openRecordId}`, '_blank');
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
