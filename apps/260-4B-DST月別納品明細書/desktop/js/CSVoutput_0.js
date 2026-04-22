// kintoneのレコード詳細画面が表示された際のイベントリスナー
kintone.events.on('app.record.detail.show', function(event) {
    // イベントオブジェクトからレコード情報を取得
    var record = event.record;

    // フィールドの値を安全に取得するためのヘルパー関数
    /**
     * kintoneのフィールドオブジェクトから安全に値を取得します。
     * フィールドが存在しない、または値がない場合は空文字を返します。
     * @param {object} field kintoneのフィールドオブジェクト
     * @returns {string} フィールドの値
     */
    function getFieldValue(field) {
        if (field && typeof field.value !== 'undefined' && field.value !== null) {
            return field.value;
        }
        return '';
    }

    // 既に同じボタンが存在する場合は削除する
    const existingButtonId = 'custom-csv-export-button';
    const oldButton = document.getElementById(existingButtonId);
    if (oldButton) {
        oldButton.remove();
    }

    // --- ボタンの設置 ---
    var statusMenuSpace = document.querySelector('.gaia-argoui-app-toolbar-statusmenu');
    if (!statusMenuSpace) {
        console.error('ボタンの配置場所が見つかりません。');
        return event;
    }

    var exportButton = document.createElement('button');
    exportButton.innerHTML = 'CSVで出力';
    exportButton.className = 'button013';
    exportButton.id = existingButtonId;

    statusMenuSpace.appendChild(exportButton);

    // --- ボタンクリック時の処理 ---
    exportButton.onclick = async function() {
        exportButton.disabled = true;
        exportButton.innerHTML = '処理中...';

        try {
            // --- 0. 事前準備 ---
            const targetRows = record['T明細項目'].value.filter(row => getFieldValue(row.value['出稿済フラグ1']) === '0');

            if (targetRows.length === 0) {
                alert('CSV出力の対象となるデータがありません。');
                exportButton.disabled = false;
                exportButton.innerHTML = 'CSVで出力';
                return;
            }

            const customerDetailId = getFieldValue(record['客先詳細ID']);
            if (!customerDetailId) {
                alert('コピー元のレコードに「客先詳細ID」が設定されていません。処理を中断します。');
                exportButton.disabled = false;
                exportButton.innerHTML = 'CSVで出力';
                return;
            }

            const totalAmountApp260 = targetRows.reduce((sum, row) => {
                return sum + Number(getFieldValue(row.value['合計金額']) || 0);
            }, 0);

            const internalTransportCost = Number(getFieldValue(record['内輸送費']) || 0);

            const aggregationKeyForCsv = getFieldValue(record['鍛延_火造']); // CSV出力用のキー

            // --- 1. CSVコンテンツの生成 ---
            var csvContent = "鍛延_火造,部署,処理年月,納品日,カードNo,工番,品名・寸法,加工工程,個数,DST見積り内容,希望単価,合計金額,屑分類\n";

            targetRows.forEach(function(row) {
                // CSVの最初の列にレコード直下の「鍛延_火造」の値を設定
                csvContent += aggregationKeyForCsv + "," +
                                getFieldValue(record['部署']) + "," +
                                getFieldValue(record['処理年月']) + "," +
                                getFieldValue(row.value['納品日']) + "," +
                                getFieldValue(row.value['カードNo']) + "," +
                                getFieldValue(row.value['工番']) + "," +
                                getFieldValue(row.value['品名・寸法']) + "," +
                                getFieldValue(row.value['加工工程']) + "," +
                                getFieldValue(row.value['個数']) + "," +
                                getFieldValue(row.value['DST見積り内容']) + "," +
                                getFieldValue(row.value['希望単価']) + "," +
                                getFieldValue(row.value['合計金額']) + "," +
                                getFieldValue(row.value['屑分類']) + "\n";
                row.value['出稿済フラグ1'].value = '1';
            });

            if (getFieldValue(record['重量1']) != 0 && getFieldValue(record['大同輸送費合計1']) != 0) {
                csvContent += ",,,,,,,,,,,,運搬費,," + getFieldValue(record['重量1']) + ",,,1430円/t," + getFieldValue(record['大同輸送費合計1']) + "\n";
            }
            if (getFieldValue(record['重量2']) != 0 && getFieldValue(record['大同輸送費合計2']) != 0) {
                csvContent += ",,,,,,,,,,,,運搬費,," + getFieldValue(record['重量2']) + ",,,815円/t," + getFieldValue(record['大同輸送費合計2']) + "\n";
            }
            if (getFieldValue(record['重量3']) != 0 && getFieldValue(record['大同輸送費合計3']) != 0) {
                csvContent += ",,,,,,,,,,,,運搬費,," + getFieldValue(record['重量3']) + ",,,615円/t," + getFieldValue(record['大同輸送費合計3']) + "\n";
            }

            // --- 2. レコード情報の更新準備 (現在のアプリ) ---
            var updatedCounter = Number(getFieldValue(record['カウンタ'])) + 1;

            var now = new Date();
            var year = now.getFullYear();
            var month = String(now.getMonth() + 1).padStart(2, '0');
            var day = String(now.getDate()).padStart(2, '0');
            var todayString = year + '-' + month + '-' + day;
            var yyyymmdd = todayString.replace(/-/g, '');
            var concatenatedId = customerDetailId + yyyymmdd + updatedCounter;

            // ▼▼▼【変更】フィールドコードを修正 ▼▼▼
            record['TDST輸送費'].value.forEach(function(row) {
                row.value['輸送費集計済フラグ'].value = '1';
            });
            // ▲▲▲【変更】▲▲▲

            // --- 2.5. 別アプリ(261)の更新処理 ---
            const APP_ID_261 = 261;
            const processYearMonth = getFieldValue(record['処理年月']);
            const latestDeliveryDate = todayString;

            console.log('アプリ261の更新処理を開始します。');
            const getResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: APP_ID_261,
                query: `処理年月 = "${processYearMonth}"`
            });

            if (getResp.records.length > 0) {
                const targetRecord261 = getResp.records[0];
                const subtable = targetRecord261['T売上集計'].value;

                console.log(`アプリ261のサブテーブル内を検索します。検索キー (客先詳細ID): ${customerDetailId}`);
                const rowIndex = subtable.findIndex(row => getFieldValue(row.value['客先詳細ID']) === customerDetailId);
                console.log(`検索結果 (行インデックス): ${rowIndex}`);

                if (rowIndex > -1) {
                    console.log('一致する行が見つかりました。既存の行を更新します。');
                    const currentAmount = Number(getFieldValue(subtable[rowIndex].value['売上金額']) || 0);
                    subtable[rowIndex].value['売上金額'].value = String(currentAmount + totalAmountApp260);
                    subtable[rowIndex].value['売上日'].value = latestDeliveryDate;

                    const currentTransportCost = Number(getFieldValue(subtable[rowIndex].value['内輸送費']) || 0);
                    subtable[rowIndex].value['内輸送費'].value = String(currentTransportCost + internalTransportCost);

                } else {
                    console.log('一致する行が見つかりません。新しい行を作成して追加します。');
                    subtable.push({
                        value: {
                            '客先詳細ID': { value: customerDetailId },
                            '売上日': { value: latestDeliveryDate },
                            '売上金額': { value: String(totalAmountApp260) },
                            '内輸送費': { value: String(internalTransportCost) }
                        }
                    });
                    console.log(`新しい行が追加されました。現在のサブテーブルの行数: ${subtable.length}`);
                }
                await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                    app: APP_ID_261,
                    id: getFieldValue(targetRecord261.$id),
                    record: { 'T売上集計': { value: subtable } }
                });
                console.log('アプリ261のレコードを更新しました。');
            } else {
                console.log(`処理年月「${processYearMonth}」のレコードが見つかりません。新規レコードを作成します。`);
                await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
                    app: APP_ID_261,
                    record: {
                        '処理年月': { value: processYearMonth },
                        'T売上集計': {
                            value: [{
                                value: {
                                    '客先詳細ID': { value: customerDetailId },
                                    '売上日': { value: latestDeliveryDate },
                                    '売上金額': { value: String(totalAmountApp260) },
                                    '内輸送費': { value: String(internalTransportCost) }
                                }
                            }]
                        }
                    }
                });
                console.log('アプリ261に新規レコードを作成しました。');
            }

            // --- 3. レコードの更新 (現在のアプリの基本情報) ---
            const putBody = {
                app: kintone.app.getId(),
                id: getFieldValue(record.$id),
                record: {
                    'T明細項目': { value: record['T明細項目'].value },
                    'カウンタ': { value: updatedCounter },
                    // ▼▼▼【変更】フィールドコードを修正 ▼▼▼
                    'TDST輸送費': { value: record['TDST輸送費'].value },
                    // ▲▲▲【変更】▲▲▲
                    '最新出稿日': { value: todayString },
                    '転記用月別明細ID': { value: concatenatedId }
                }
            };
            await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', putBody);
            console.log(`現在のアプリ(${kintone.app.getId()})の基本情報を更新しました。`);

            // --- 4. CSVファイルのアップロード ---
            const fileKey = await (new Promise((resolve, reject) => {
                const formData = new FormData();
                const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
                const fileName = getFieldValue(record['部署']) + getFieldValue(record['処理年月']) + updatedCounter + '.csv';
                formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
                formData.append('file', blob, fileName);

                const xhr = new XMLHttpRequest();
                xhr.open('POST', kintone.api.url('/k/v1/file', true), true);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText).fileKey);
                    } else {
                        reject(new Error('ファイルアップロードに失敗しました: ' + xhr.responseText));
                    }
                };
                xhr.onerror = () => reject(new Error('ネットワークエラーが発生しました。'));
                xhr.send(formData);
            }));
            console.log('CSVファイルのアップロードに成功しました。 FileKey:', fileKey);

            // --- 5. レコードの更新 (現在のアプリの添付ファイル) ---
            const existingFiles = getFieldValue(record['csv']) || [];
            existingFiles.push({ fileKey: fileKey });
            const updateAttachmentBody = {
                app: kintone.app.getId(),
                id: getFieldValue(record.$id),
                record: { 'csv': { value: existingFiles } }
            };
            await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updateAttachmentBody);
            console.log('添付ファイルの更新に成功しました。');

            // --- 6. 完了 ---
            alert('CSV出力と関連アプリの更新が完了しました。');
            location.reload();

        } catch (error) {
            console.error('処理全体でエラーが発生しました。', error);
            alert('処理中にエラーが発生しました。詳細はコンソールを確認してください。');
            exportButton.disabled = false;
            exportButton.innerHTML = 'CSVで出力';
        }
    };

    return event;
});