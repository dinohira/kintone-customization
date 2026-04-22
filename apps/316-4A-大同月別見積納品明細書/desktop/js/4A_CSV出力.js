/**
 * @license
 * Copyright 2025 (c) <Your Name or Company>. All Rights Reserved.
 *
 * アプリ316用 CSV出力 & 転記カスタマイズ v7
 * ・Button 1: 大同見積CSV出力 (Status: 未見積 -> 見積出稿済/明細未出稿)
 * ・Button 2: 大同納品明細CSV出力(作業費・輸送費) (Status: 見積出稿済/明細未出稿 -> 明細出稿済)
 * ・Button 3: 売上集計転記 (App 316 -> App 261) [Upsert Logic]
 * ・Auto-fill: 転記1チェック -> 売上日自動入力
 */
(function () {
    'use strict';

    // =================================================================
    // 設定
    // =================================================================
    const CONFIG = {
        APP_ID: 316,
        TARGET_APP_ID: 261,

        SUBTABLE_CODE: 'T明細項目',

        // 添付ファイル保存先
        ATTACHMENT_FIELD_CODE: 'csv',
        ATTACHMENT2_FIELD_CODE: 'csv2',
        ATTACHMENT3_FIELD_CODE: 'csv3',

        // カウンタ
        COUNTER_FIELD_CODE: 'カウンタ',
        COUNTER2_FIELD_CODE: 'カウンタ2',
        COUNTER3_FIELD_CODE: 'カウンタ3',

        PROCESS_MONTH_FIELD_CODE: '処理年月',
        DEPT_FIELD_CODE: '部署',
        PIC_FIELD_CODE: '担当',
        LATEST_OUTPUT_DATE_CODE: '最新出稿日',

        // 追加ロジック用フィールド
        TIME_AREA_SELECT_CODE: '時間面積選択',
        PRESET_UNIT_PRICE_FLAG_CODE: 'F既定単価設定',

        // 転記用フィールド (App 316)
        CHECK_TRANSFER_CODE: 'C転記確認', // 転記1
        CHECK_TRANSFER_VAL: 'すべて転記完了し月別処理を終える',
        SALES_DATE_CODE: '売上日',
        CUSTOMER_DETAIL_ID_CODE: '客先詳細ID',
        TOTAL_WORK_COST_CODE: '合計作業費',
        TOTAL_TRANSPORT_COST_CODE: '合計輸送費',
        SOURCE_RECORD_ID_CODE: '月別明細ID', // レコード番号

        // 転記先フィールド (App 261)
        TARGET_KEY_CODE: '処理年月',
        TARGET_SUBTABLE_CODE: 'T売上集計',
        TARGET_SUB_CUSTOMER_ID: '客先詳細ID',
        TARGET_SUB_SALES_DATE: '売上日',
        TARGET_SUB_SALES_AMOUNT: '売上金額',
        TARGET_SUB_TRANSPORT_COST: '外輸送費',
        TARGET_SUB_SOURCE_REF: '転記元レコードNo', // 重複防止用キー

        // テーブル内フィールド
        TABLE_STATUS_CODE: 'R状態',
        TargetStatus_Quote: '未見積',
        NextStatus_Quote: '見積出稿済/明細未出稿',
        TargetStatus_Work: '見積出稿済/明細未出稿',
        NextStatus_Work: '明細出稿済',

        // 分割行数
        CHUNK_SIZE: 5,

        // Button 1 Mappings (Quote)
        QUOTE_COL_COUNT: 33,
        QUOTE_ROW1_MAPPING: { 1: 'カードNo', 4: '溶解番号', 7: '社内鋼種', 14: '屑分類', 16: '品名・寸法', 21: '総カット数', 23: '大同明細項目_単価', 27: '大同明細項目_単位', 28: '面積_切断実績', 32: '明細項目_金額' },
        QUOTE_ROW2_MAPPING: { 12: '数量_納入実績', 23: '大同単品輸送費', 28: '明細用重量', 32: '大同単品輸送費' },

        // Button 2 Mappings (Work Cost)
        WORK_COL_COUNT: 17,
        WORK_MAPPING: { 0: '納品_月', 1: '納品_日', 2: '依頼No', 3: 'カードNo', 4: '工番', 5: '社内鋼種', 6: '屑分類', 7: '品名・寸法', 8: '数量_支給内容', 9: '重量_支給内容', 10: '加工内容', 11: '数量_納入実績', 12: '重量_納入実績', 13: '総カット数', 15: '大同明細項目_単価', 16: '明細項目_金額' },

        // Button 3 Mappings (Transport Cost - CSV)
        TRANSPORT_COL_COUNT: 17,
        TRANSPORT_SUFFIXES: ['1430', '815', '615'],
        TRANSPORT_PRICES: { '1430': '1430円/t', '815': '815円/t', '615': '615円/t' }
    };

    // =================================================================
    // 汎用関数
    // =================================================================
    const showSpinner = (msg) => {
        if (document.getElementById('kintone-spinner')) return;
        const spinner = document.createElement('div');
        spinner.id = 'kintone-spinner';
        spinner.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 9999; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; color: white; font-size: 24px;';
        spinner.innerText = msg || '処理中...';
        document.body.appendChild(spinner);
    };

    const hideSpinner = () => {
        const spinner = document.getElementById('kintone-spinner');
        if (spinner) spinner.remove();
    };

    const formatCell = (cell) => {
        const str = String(cell);
        if (str.includes('"') || str.includes(',') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const uploadFile = async (fileName, blob) => {
        const formData = new FormData();
        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
        formData.append('file', blob, fileName);
        const url = kintone.api.url('/k/v1/file', true);
        const headers = { 'X-Requested-With': 'XMLHttpRequest' };
        const response = await fetch(url, { method: 'POST', headers: headers, body: formData });
        const json = await response.json();
        if (!json.fileKey) throw new Error('File upload failed: ' + JSON.stringify(json));
        return json.fileKey;
    };

    // =================================================================
    // CSV生成ロジック
    // =================================================================
    const generateCSV_Quote = (tableRows, headerData) => {
        const csvLines = [];
        if (headerData) csvLines.push(headerData.map(formatCell).join(','));
        tableRows.forEach(row => {
            const rData = row.value;
            const line1 = new Array(CONFIG.QUOTE_COL_COUNT).fill('');
            const line2 = new Array(CONFIG.QUOTE_COL_COUNT).fill('');
            Object.keys(CONFIG.QUOTE_ROW1_MAPPING).forEach(idx => { const code = CONFIG.QUOTE_ROW1_MAPPING[idx]; if (rData[code]) line1[idx] = rData[code].value || ''; });

            const timeAreaSelect = rData[CONFIG.TIME_AREA_SELECT_CODE] ? rData[CONFIG.TIME_AREA_SELECT_CODE].value : '';
            const presetFlag = rData[CONFIG.PRESET_UNIT_PRICE_FLAG_CODE] ? Number(rData[CONFIG.PRESET_UNIT_PRICE_FLAG_CODE].value) : null;
            let afValue = '';
            if (timeAreaSelect === '時間計算') afValue = 'H';
            else if (timeAreaSelect === '面積・既定計算') { if (presetFlag === 0) afValue = 'c㎡'; else if (presetFlag === 1) afValue = 'cut'; }
            line1[31] = afValue;

            Object.keys(CONFIG.QUOTE_ROW2_MAPPING).forEach(idx => { const code = CONFIG.QUOTE_ROW2_MAPPING[idx]; if (rData[code]) { let val = rData[code].value || ''; if (code === '明細用重量' && val !== '') val = Number(val) * 0.001; line2[idx] = val; } });
            line2[31] = 't';
            csvLines.push(line1.map(formatCell).join(','));
            csvLines.push(line2.map(formatCell).join(','));
        });
        return csvLines.join('\r\n');
    };

    const generateCSV_WorkCost = (tableRows, headerData) => {
        const csvLines = [];
        if (headerData) csvLines.push(headerData.map(formatCell).join(','));
        tableRows.forEach(row => {
            const rData = row.value;
            const line = new Array(CONFIG.WORK_COL_COUNT).fill('');
            Object.keys(CONFIG.WORK_MAPPING).forEach(idx => {
                const code = CONFIG.WORK_MAPPING[idx];
                if (idx == 15) {
                    const price = rData['大同明細項目_単価'] ? (rData['大同明細項目_単価'].value || '') : '';
                    const unit = rData['大同明細項目_単位'] ? (rData['大同明細項目_単位'].value || '') : '';
                    line[idx] = price + unit;
                } else if (rData[code]) {
                    line[idx] = rData[code].value || '';
                }
            });
            const area = rData['面積_切断実績'] ? (rData['面積_切断実績'].value || '') : '';
            const timeAreaSelect = rData[CONFIG.TIME_AREA_SELECT_CODE] ? rData[CONFIG.TIME_AREA_SELECT_CODE].value : '';
            const presetFlag = rData[CONFIG.PRESET_UNIT_PRICE_FLAG_CODE] ? Number(rData[CONFIG.PRESET_UNIT_PRICE_FLAG_CODE].value) : null;
            let oValue = '';
            if (presetFlag === 1) oValue = '一式';
            else if (timeAreaSelect === '時間計算') oValue = area + 'H';
            else if (timeAreaSelect === '面積・既定計算' && presetFlag === 0) oValue = area + 'c㎡';
            else oValue = area;
            line[14] = oValue;
            csvLines.push(line.map(formatCell).join(','));
        });
        return csvLines.join('\r\n');
    };

    const generateCSV_TransportCost = (record, headerData) => {
        const csvLines = [];
        if (headerData) csvLines.push(headerData.map(formatCell).join(','));
        CONFIG.TRANSPORT_SUFFIXES.forEach(suffix => {
            const qty = Number(record[`大同合計数量_${suffix}`].value || 0);
            const weight = Number(record[`大同合計重量_${suffix}`].value || 0);
            const cost = Number(record[`大同合計輸送費_${suffix}`].value || 0);
            if (qty !== 0 || weight !== 0 || cost !== 0) {
                const line = new Array(CONFIG.TRANSPORT_COL_COUNT).fill('');
                line[10] = '運搬費'; line[11] = qty !== 0 ? qty : ''; line[12] = weight !== 0 ? weight : ''; line[15] = CONFIG.TRANSPORT_PRICES[suffix]; line[16] = cost !== 0 ? cost : '';
                csvLines.push(line.map(formatCell).join(','));
            }
        });
        if (csvLines.length === (headerData ? 1 : 0)) return null;
        return csvLines.join('\r\n');
    };

    // =================================================================
    // イベントハンドラ: Checkbox Auto-fill (追加要件1)
    // =================================================================
    const checkEvents = [
        `app.record.create.change.${CONFIG.CHECK_TRANSFER_CODE}`,
        `app.record.edit.change.${CONFIG.CHECK_TRANSFER_CODE}`
    ];
    kintone.events.on(checkEvents, function (event) {
        const record = event.record;
        const vals = record[CONFIG.CHECK_TRANSFER_CODE].value;
        if (vals.includes(CONFIG.CHECK_TRANSFER_VAL)) {
            const today = new Date().toISOString().split('T')[0];
            record[CONFIG.SALES_DATE_CODE].value = today;
        }
        return event;
    });

    // =================================================================
    // メイン画面イベント
    // =================================================================
    kintone.events.on('app.record.detail.show', function (event) {
        let targetSpace = document.getElementsByClassName('gaia-argoui-app-toolbar-statusmenu')[0];
        if (!targetSpace) targetSpace = kintone.app.record.getHeaderMenuSpaceElement();
        if (!targetSpace || document.getElementById('custom-csv-buttons-container')) return;

        const container = document.createElement('div');
        container.id = 'custom-csv-buttons-container';
        container.style.cssText = 'display: inline-flex; gap: 10px; margin-left: 16px;';

        const greenStyle = `
            .button013-green { border-left-color: #2ecc71 !important; }
            .button013-green:before { background: #2ecc71 !important; }
        `;
        const styleTag = document.createElement('style');
        styleTag.innerText = greenStyle;
        document.head.appendChild(styleTag);

        const record = event.record;
        const subtable = record[CONFIG.SUBTABLE_CODE].value;

        // Common Data
        const processMonth = record[CONFIG.PROCESS_MONTH_FIELD_CODE].value || '';
        const dept = record[CONFIG.DEPT_FIELD_CODE].value || '';
        const pic = record[CONFIG.PIC_FIELD_CODE].value || '';
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];

        // ----------------------------------------------------
        // Button 1: 大同見積CSV出力
        // ----------------------------------------------------
        const createBtn1 = () => {
            const btn = document.createElement('button');
            btn.innerText = '大同見積CSV出力';
            btn.className = 'button013';
            const hasTarget = subtable.some(row => row.value[CONFIG.TABLE_STATUS_CODE].value === CONFIG.TargetStatus_Quote);
            if (!hasTarget) { btn.disabled = true; }
            else {
                btn.onclick = async () => {
                    const currentRecord = kintone.app.record.get().record;
                    const currentTable = currentRecord[CONFIG.SUBTABLE_CODE].value;
                    const targetRows = [];
                    currentTable.forEach((row, index) => { if (row.value[CONFIG.TABLE_STATUS_CODE].value === CONFIG.TargetStatus_Quote) targetRows.push({ index: index, data: row }); });
                    if (!targetRows.length) return alert('対象データがありません');
                    if (!confirm(`「未見積」行: ${targetRows.length}件\nCSV出力してステータスを更新しますか？`)) return;
                    try {
                        showSpinner();
                        let currentCounter = parseInt(currentRecord[CONFIG.COUNTER_FIELD_CODE].value, 10) || 0;
                        const headerData = [processMonth, dept, pic, 0, dateStr, timeStr];
                        const newFileKeys = [];
                        for (let i = 0; i < targetRows.length; i += CONFIG.CHUNK_SIZE) {
                            const chunk = targetRows.slice(i, i + CONFIG.CHUNK_SIZE);
                            const chunkRows = chunk.map(item => item.data);
                            currentCounter++;
                            headerData[3] = currentCounter;
                            const csvContent = generateCSV_Quote(chunkRows, headerData);
                            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                            const fileName = `大同見積_${processMonth}_${dept}_${pic}_${currentCounter}.csv`;
                            newFileKeys.push(await uploadFile(fileName, new Blob([bom, csvContent], { type: 'text/csv' })));
                        }
                        const existingFiles = currentRecord[CONFIG.ATTACHMENT_FIELD_CODE].value;
                        const allFileKeys = existingFiles.map(f => ({ fileKey: f.fileKey }));
                        newFileKeys.forEach(key => allFileKeys.push({ fileKey: key }));
                        const newSubtable = currentTable.map(row => {
                            if (targetRows.some(t => t.data === row)) return { id: row.id, value: { ...row.value, [CONFIG.TABLE_STATUS_CODE]: { value: CONFIG.NextStatus_Quote } } };
                            return row;
                        });
                        await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', { app: kintone.app.getId(), id: currentRecord.$id.value, record: { [CONFIG.ATTACHMENT_FIELD_CODE]: { value: allFileKeys }, [CONFIG.COUNTER_FIELD_CODE]: { value: currentCounter }, [CONFIG.LATEST_OUTPUT_DATE_CODE]: { value: dateStr }, [CONFIG.SUBTABLE_CODE]: { value: newSubtable } } });
                        alert('完了しました。\n作成ファイル数: ' + newFileKeys.length);
                        location.reload();
                    } catch (e) { console.error(e); alert('エラー: ' + e.message); } finally { hideSpinner(); }
                };
            }
            return btn;
        };

        // ----------------------------------------------------
        // Button 2: 大同納品明細CSV出力(作業費・輸送費)
        // ----------------------------------------------------
        const createBtn2 = () => {
            const btn = document.createElement('button');
            btn.innerHTML = '大同納品明細CSV出力<br>(作業費・輸送費)';
            btn.className = 'button013 button013-monochrome';
            const hasTarget = subtable.some(row => row.value[CONFIG.TABLE_STATUS_CODE].value === CONFIG.TargetStatus_Work);
            if (!hasTarget) { btn.disabled = true; }
            else {
                btn.onclick = async () => {
                    const currentRecord = kintone.app.record.get().record;
                    const currentTable = currentRecord[CONFIG.SUBTABLE_CODE].value;
                    const targetRows = currentTable.filter(row => row.value[CONFIG.TABLE_STATUS_CODE].value === CONFIG.TargetStatus_Work);
                    if (!confirm(`「見積出稿済/明細未出稿」行: ${targetRows.length}件\n納品明細CSV(作業費・輸送費)を出力し、ステータスを更新しますか？`)) return;
                    try {
                        showSpinner('CSV作成・アップロード中...');
                        const updatePayload = {};
                        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                        let cnt2 = parseInt(currentRecord[CONFIG.COUNTER2_FIELD_CODE].value, 10) || 0;
                        cnt2++;
                        const hData2 = [processMonth, dept, pic, cnt2, dateStr, timeStr];
                        const csvContent2 = generateCSV_WorkCost(targetRows, hData2);
                        const fKey2 = await uploadFile(`大同納品明細作業費_${processMonth}_${dept}_${pic}_${cnt2}.csv`, new Blob([bom, csvContent2], { type: 'text/csv' }));
                        const exist2 = currentRecord[CONFIG.ATTACHMENT2_FIELD_CODE].value;
                        const keys2 = exist2.map(f => ({ fileKey: f.fileKey }));
                        keys2.push({ fileKey: fKey2 });
                        updatePayload[CONFIG.ATTACHMENT2_FIELD_CODE] = { value: keys2 };
                        updatePayload[CONFIG.COUNTER2_FIELD_CODE] = { value: cnt2 };

                        let cnt3 = parseInt(currentRecord[CONFIG.COUNTER3_FIELD_CODE].value, 10) || 0;
                        cnt3++;
                        const hData3 = [processMonth, dept, pic, cnt3, dateStr, timeStr];
                        const csvContent3 = generateCSV_TransportCost(currentRecord, hData3);
                        if (csvContent3) {
                            const fKey3 = await uploadFile(`大同納品明細輸送費_${processMonth}_${dept}_${pic}_${cnt3}.csv`, new Blob([bom, csvContent3], { type: 'text/csv' }));
                            const exist3 = currentRecord[CONFIG.ATTACHMENT3_FIELD_CODE].value;
                            const keys3 = exist3.map(f => ({ fileKey: f.fileKey }));
                            keys3.push({ fileKey: fKey3 });
                            updatePayload[CONFIG.ATTACHMENT3_FIELD_CODE] = { value: keys3 };
                            updatePayload[CONFIG.COUNTER3_FIELD_CODE] = { value: cnt3 };
                        }
                        const newSubtable = currentTable.map(row => {
                            if (row.value[CONFIG.TABLE_STATUS_CODE].value === CONFIG.TargetStatus_Work) return { id: row.id, value: { ...row.value, [CONFIG.TABLE_STATUS_CODE]: { value: CONFIG.NextStatus_Work } } };
                            return row;
                        });
                        updatePayload[CONFIG.SUBTABLE_CODE] = { value: newSubtable };
                        await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', { app: kintone.app.getId(), id: currentRecord.$id.value, record: updatePayload });
                        alert('完了しました。\n(輸送費CSVは対象データがない場合スキップされています)');
                        location.reload();
                    } catch (e) { console.error(e); alert('エラー: ' + e.message); } finally { hideSpinner(); }
                };
            }
            return btn;
        };

        // ----------------------------------------------------
        // Button 3: 売上集計転記 (App 261 Sync) (Upsert with Key)
        // ----------------------------------------------------
        const createBtn3 = () => {
            const btn = document.createElement('button');
            btn.innerText = '売上集計転記';
            btn.className = 'button013 button013-green';

            const checkVals = record[CONFIG.CHECK_TRANSFER_CODE].value;
            const isChecked = checkVals && checkVals.includes(CONFIG.CHECK_TRANSFER_VAL);

            if (!isChecked) {
                btn.disabled = true;
            } else {
                btn.onclick = async () => {
                    const currentRecord = kintone.app.record.get().record;
                    const pDate = currentRecord[CONFIG.PROCESS_MONTH_FIELD_CODE].value;

                    if (!pDate) return alert('処理年月が設定されていません');
                    if (!confirm(`処理年月: ${pDate}\nこのデータをアプリ(${CONFIG.TARGET_APP_ID})へ転記しますか？`)) return;

                    try {
                        showSpinner('データ転記中...');

                        // Generate Unique Key: AppID + RecordID (MonthlyDetailID)
                        const sourceRecID = currentRecord[CONFIG.SOURCE_RECORD_ID_CODE].value;
                        const uniqueKey = Number(`${CONFIG.APP_ID}${sourceRecID}`);

                        // 1. Get Target Records
                        const getResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                            app: CONFIG.TARGET_APP_ID,
                            query: `${CONFIG.TARGET_KEY_CODE} = "${pDate}"`,
                            fields: ['$id', CONFIG.TARGET_SUBTABLE_CODE]
                        });

                        const srcData = {
                            customerDetailId: currentRecord[CONFIG.CUSTOMER_DETAIL_ID_CODE].value,
                            salesDate: currentRecord[CONFIG.SALES_DATE_CODE].value,
                            workCost: currentRecord[CONFIG.TOTAL_WORK_COST_CODE].value,
                            transportCost: currentRecord[CONFIG.TOTAL_TRANSPORT_COST_CODE].value
                        };

                        const newRowValue = {
                            [CONFIG.TARGET_SUB_CUSTOMER_ID]: { value: srcData.customerDetailId },
                            [CONFIG.TARGET_SUB_SALES_DATE]: { value: srcData.salesDate },
                            [CONFIG.TARGET_SUB_SALES_AMOUNT]: { value: srcData.workCost },
                            [CONFIG.TARGET_SUB_TRANSPORT_COST]: { value: srcData.transportCost },
                            [CONFIG.TARGET_SUB_SOURCE_REF]: { value: uniqueKey }
                        };

                        if (getResp.records.length > 0) {
                            // Update Existing Record (Subtable Upsert)
                            const targetRec = getResp.records[0];
                            const targetTable = targetRec[CONFIG.TARGET_SUBTABLE_CODE].value;

                            // Find existing row by key
                            const existingRowIndex = targetTable.findIndex(row => Number(row.value[CONFIG.TARGET_SUB_SOURCE_REF].value) === uniqueKey);

                            if (existingRowIndex > -1) {
                                // Update existing row
                                console.log('Updating existing row at index:', existingRowIndex);
                                targetTable[existingRowIndex].value = { ...targetTable[existingRowIndex].value, ...newRowValue };
                                alert('既存の行を更新しました。');
                            } else {
                                // Append new row
                                targetTable.push({ value: newRowValue });
                                alert('新しい行を追加しました。');
                            }

                            await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                                app: CONFIG.TARGET_APP_ID,
                                id: targetRec.$id.value,
                                record: {
                                    [CONFIG.TARGET_SUBTABLE_CODE]: { value: targetTable }
                                }
                            });
                        } else {
                            // Create New Record
                            await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
                                app: CONFIG.TARGET_APP_ID,
                                record: {
                                    [CONFIG.TARGET_KEY_CODE]: { value: pDate },
                                    [CONFIG.TARGET_SUBTABLE_CODE]: { value: [{ value: newRowValue }] }
                                }
                            });
                            alert('新規レコードを作成しました。');
                        }
                    } catch (e) { console.error(e); alert('転記エラー: ' + e.message); } finally { hideSpinner(); }
                };
            }
            return btn;
        };

        container.appendChild(createBtn1());
        container.appendChild(createBtn2());
        container.appendChild(createBtn3());

        targetSpace.appendChild(container);
    });

})();
