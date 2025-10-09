/**
 * @fileoverview
 * kintoneアプリ(241)からアプリ(246)へレコードをコピーする統合スクリプト。
 * レコードの状況に応じて、「単品明細書作成」と「分納品明細転記」の2つの異なる処理を実行します。
 * また、単品明細書作成時には、鋸刃の使用記録を別アプリ(50)に転記します。
 * さらに、屑分類アプリ(251)へも実績を転記します。
 *
 * @version 2.1.0
 * @author Gemini (with improvements)
 */
(function() {
  'use strict';

  // --- 設定値 ---
  const CONFIG = {
    // アプリID
    SOURCE_APP_ID: 241, // コピー元アプリ
    DEST_APP_ID: 246,   // コピー先アプリ
    BLADE_MASTER_APP_ID: 50, // 鋸刃管理アプリ
    SCRAP_APP_ID: 251,   // 屑分類アプリ

    // フィールドコード
    FIELD_CODE: {
      // --- 共通 ---
      STATUS: 'R現況',
      WORK_ID: '作業ID',
      CASE_ID: 'L案件ID',
      WORK_RECORD: 'T作業記録',         // コピー元テーブル
      TIME_RECORD: 'T時間記録',         // コピー先テーブル
      AREA_RECORD: 'T面積記録',         // コピー先テーブル
      BLADE_USAGE_RECORD: 'T鋸刃使用記録',
      RECORD_ID: '$id',
      // --- 条件判定用 ---
      DELIVERY_PARTIAL_1: 'C分納1',
      DELIVERY_PARTIAL_2: 'C分納2',
      DELIVERY_COMPLETE: 'C完納',
      DELIVERY_TABLE: 'T分納記録',
      TOTAL_QUANTITY: '総計上数量',
      F_BUNNO: 'F分納',
      // --- 分納処理用 ---
      DELIVERY_DEDUPE_ID: '分納重複管理ID',
      DELIVERY_TABLE_STATUS: 'R分納明細転記',
      // --- 鋸刃転記処理用 ---
      BLADE_USAGE_TABLE_LOOKUP: '鋸刃',
      BLADE_USAGE_TABLE_DATE: '使用日付',
      BLADE_USAGE_TABLE_QTY: '使用本数',
      BLADE_MASTER_TABLE: 'T鋸刃使用_入庫記録',
      BLADE_MASTER_TABLE_DATE: '使用日付',
      BLADE_MASTER_TABLE_QTY: '使用_入庫',
      // --- T作業記録テーブル内のフィールドコード ---
      WORK_DATE_3: '作業日付3',
      MACHINE_3: '作業機械3',
      START_3: '開始3',
      END_3: '終了3',
      DIAMETER_3: '径3',
      LENGTH_3: '縦3',
      WIDTH_3: '横3',
      CUT_COUNT_3: 'カット数3',
      // --- コピー先テーブル内のフィールドコード ---
      WORK_DATE: '作業日付',
      MACHINE: '作業機械',
      START: '開始',
      END: '終了',
      WORK_DATE_2: '作業日付2',
      DIAMETER: '径',
      LENGTH: '縦',
      WIDTH: '横',
      CUT_COUNT: 'カット数',

      // --- 屑分類アプリ転記用 ---
      // コピー元(241)
      SCRAP_CLASSIFICATION_LOOKUP: 'L屑分類',
      SURFACE_CONDITION: 'R表面状態',
      TOTAL_CUT_AREA: '総切断面積',
      TOTAL_WORK_TIME: '総作業時間',
      TOTAL_BLADES_USED: '総使用本数',
      SENSE_INPUT: 'M所感選択入力', // ★追加
      WORK_MEMO: '作業メモ',       // ★追加
      // コピー先(251)
      SCRAP_CLASSIFICATION: '屑分類',
      PERFORMANCE_TABLE: 'T実績',
      SENSE_TABLE: 'T所感入力',   // ★追加
      // コピー先(251) T実績テーブル内
      TABLE_SURFACE_CONDITION: 'R表面状態',
      TABLE_TOTAL_CUT_AREA: '総切断面積',
      TABLE_TOTAL_WORK_TIME: '総作業時間',
      TABLE_TOTAL_BLADES_USED: '総使用本数',
      // ★追加★ コピー先(251) T所感入力テーブル内
      TABLE_SENSE_INPUT: 'M所感選択入力',
      TABLE_WORK_MEMO: '作業メモ',
    },

    // 特定の値
    STATUS_VALUE: {
      SHIPPED: '出荷済',
      WORKING: '作業中 →',
      TRANSFERRED: '明細転記済',
    },
    DELIVERY_VALUE: {
      PARTIAL: '分納',
      COMPLETE: '全量納品/作業完了',
    },
    TABLE_STATUS_VALUE: {
      SHIPPED: '出荷済',
    },

    // ボタン設定
    BUTTON_ID: 'integrated-copy-button',
    BUTTON_TEXT_DEFAULT: '明細転記処理',
    BUTTON_TEXT_PROCESSING: '処理中...',
    BUTTON_CLASS: 'button013',
  };

  /**
   * レコードオブジェクトから安全にフィールド値を取得します。
   */
  const getFieldValue = (record, fieldCode, defaultValue = '') => {
    if (record && record[fieldCode] && typeof record[fieldCode].value !== 'undefined') {
      return record[fieldCode].value;
    }
    return defaultValue;
  };

  /**
   * チェックボックスフィールドに特定の値が含まれているか確認します。
   */
  const isCheckboxChecked = (record, fieldCode, value) => {
    const fieldValue = getFieldValue(record, fieldCode, []);
    return Array.isArray(fieldValue) && fieldValue.includes(value);
  };

  /**
   * ユーザーに通知メッセージを表示します。
   */
  const showNotification = (text, type = 'success') => {
    const prefix = type === 'error' ? '[エラー]' : '[成功]';
    alert(`${prefix} ${text}`); // alertはkintoneの標準的な通知UIではないため、状況に応じてより適切なUI（例: SweetAlert2など）に置き換えることを検討
    console.log(`${prefix} ${text}`);
  };

  /**
   * 今日の日付を 'YYYY-MM-DD' 形式の文字列で取得します。
   * @returns {string} 今日の日付文字列
   */
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };


  // --- 条件判定ロジック ---

  /**
   * 条件1（単品明細書作成）の条件を満たすか判定します。
   */
  const checkConditionForCase1 = (record) => {
    const status = getFieldValue(record, CONFIG.FIELD_CODE.STATUS);
    const isPartialDelivery1 = isCheckboxChecked(record, CONFIG.FIELD_CODE.DELIVERY_PARTIAL_1, CONFIG.DELIVERY_VALUE.PARTIAL);
    const isPartialDelivery2 = isCheckboxChecked(record, CONFIG.FIELD_CODE.DELIVERY_PARTIAL_2, CONFIG.DELIVERY_VALUE.PARTIAL);
    const isDeliveryComplete = isCheckboxChecked(record, CONFIG.FIELD_CODE.DELIVERY_COMPLETE, CONFIG.DELIVERY_VALUE.COMPLETE);

    if (status !== CONFIG.STATUS_VALUE.SHIPPED) return false;
    if ((isPartialDelivery1 || isPartialDelivery2) && !isDeliveryComplete) return false;

    return true;
  };

  /**
   * 条件2（分納品明細転記）の条件を満たすか判定します。
   */
  const checkConditionForCase2 = (record) => {
    const status = getFieldValue(record, CONFIG.FIELD_CODE.STATUS);
    const isDeliveryComplete = isCheckboxChecked(record, CONFIG.FIELD_CODE.DELIVERY_COMPLETE, CONFIG.DELIVERY_VALUE.COMPLETE);
    const deliveryTable = getFieldValue(record, CONFIG.FIELD_CODE.DELIVERY_TABLE, []);
    const totalQuantity = getFieldValue(record, CONFIG.FIELD_CODE.TOTAL_QUANTITY);
    const fBunno = getFieldValue(record, CONFIG.FIELD_CODE.F_BUNNO);

    return (
      status === CONFIG.STATUS_VALUE.WORKING &&
      (String(fBunno) === '1' || String(fBunno) === '2') &&
      !isDeliveryComplete &&
      deliveryTable.length > 0 &&
      totalQuantity && String(totalQuantity) !== '0'
    );
  };

  /**
   * T作業記録テーブルからT時間記録とT面積記録テーブル用のデータを生成します。
   */
  const createTableDataFromWorkRecord = (workRecordTable) => {
    const timeRecord = [];
    const areaRecord = [];

    workRecordTable.forEach(row => {
      const rowValue = row.value;
      // T時間記録へのマッピング
      timeRecord.push({
        value: {
          [CONFIG.FIELD_CODE.WORK_DATE]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.WORK_DATE_3) },
          [CONFIG.FIELD_CODE.MACHINE]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.MACHINE_3) },
          [CONFIG.FIELD_CODE.START]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.START_3) },
          [CONFIG.FIELD_CODE.END]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.END_3) },
        }
      });
      // T面積記録へのマッピング
      areaRecord.push({
        value: {
          [CONFIG.FIELD_CODE.WORK_DATE_2]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.WORK_DATE_3) },
          [CONFIG.FIELD_CODE.DIAMETER]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.DIAMETER_3) },
          [CONFIG.FIELD_CODE.LENGTH]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.LENGTH_3) },
          [CONFIG.FIELD_CODE.WIDTH]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.WIDTH_3) },
          [CONFIG.FIELD_CODE.CUT_COUNT]: { value: getFieldValue(rowValue, CONFIG.FIELD_CODE.CUT_COUNT_3) },
        }
      });
    });

    return { timeRecord, areaRecord };
  };

  /**
   * 屑分類アプリ(251)へ実績を転記します。
   * この処理でエラーが発生しても、メインの転記処理は続行されるように設計されています。
   */
  const executeCopyToScrapApp = async (record) => {
    console.log('追加処理: 屑分類アプリへの転記を開始します。');
    try {
      // ルックアップフィールドから転記先のキーとなる値を取得
      const scrapLookupValue = getFieldValue(record, CONFIG.FIELD_CODE.SCRAP_CLASSIFICATION_LOOKUP);
      if (!scrapLookupValue) {
        console.log('「L屑分類」が空のため、屑分類アプリへの転記はスキップしました。');
        return; // 値がなければ処理を中断
      }

      // 1. 屑分類アプリから合致するレコードを検索
      const query = `${CONFIG.FIELD_CODE.SCRAP_CLASSIFICATION} = "${scrapLookupValue}"`;
      const searchResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
        app: CONFIG.SCRAP_APP_ID,
        query: query
      });

      if (searchResp.records.length === 0) {
        console.warn(`屑分類アプリに「${scrapLookupValue}」に一致するレコードが見つかりませんでした。`);
        return; // 一致するレコードがなければ処理を中断
      }

      const destRecord = searchResp.records[0];
      const destRecordId = getFieldValue(destRecord, CONFIG.FIELD_CODE.RECORD_ID);

      // 2. ★★★ 変更点 ★★★ 2つのテーブルを更新する準備
      // 2a. T実績テーブルの更新データを作成
      const existingPerformanceTable = getFieldValue(destRecord, CONFIG.FIELD_CODE.PERFORMANCE_TABLE, []);
      const newPerformanceRow = {
        value: {
          [CONFIG.FIELD_CODE.TABLE_SURFACE_CONDITION]: { value: getFieldValue(record, CONFIG.FIELD_CODE.SURFACE_CONDITION) },
          [CONFIG.FIELD_CODE.TABLE_TOTAL_CUT_AREA]: { value: getFieldValue(record, CONFIG.FIELD_CODE.TOTAL_CUT_AREA) },
          [CONFIG.FIELD_CODE.TABLE_TOTAL_WORK_TIME]: { value: getFieldValue(record, CONFIG.FIELD_CODE.TOTAL_WORK_TIME) },
          [CONFIG.FIELD_CODE.TABLE_TOTAL_BLADES_USED]: { value: getFieldValue(record, CONFIG.FIELD_CODE.TOTAL_BLADES_USED) },
        }
      };
      const updatedPerformanceTable = [...existingPerformanceTable, newPerformanceRow];

      // 2b. T所感入力テーブルの更新データを作成
      const existingSenseTable = getFieldValue(destRecord, CONFIG.FIELD_CODE.SENSE_TABLE, []);
      const newSenseRow = {
        value: {
            [CONFIG.FIELD_CODE.TABLE_SENSE_INPUT]: { value: getFieldValue(record, CONFIG.FIELD_CODE.SENSE_INPUT) },
            [CONFIG.FIELD_CODE.TABLE_WORK_MEMO]: { value: getFieldValue(record, CONFIG.FIELD_CODE.WORK_MEMO) },
        }
      };
      const updatedSenseTable = [...existingSenseTable, newSenseRow];

      // 3. 屑分類アプリのレコードを更新（複数のテーブルに同時に行を追加）
      await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
        app: CONFIG.SCRAP_APP_ID,
        id: destRecordId,
        record: {
          [CONFIG.FIELD_CODE.PERFORMANCE_TABLE]: { value: updatedPerformanceTable },
          [CONFIG.FIELD_CODE.SENSE_TABLE]: { value: updatedSenseTable }
        }
      });

      console.log(`屑分類アプリのレコード(ID: ${destRecordId})のテーブルを更新しました。`);

    } catch (error) {
      console.error('屑分類アプリへの転記処理中にエラーが発生しました:', error);
      // ユーザーへの通知はメイン処理の妨げになる可能性があるため、コンソール出力に留める。
      // メイン処理をブロックしないように、ここではエラーをスローしない。
    }
  };


  // --- 実行処理ロジック ---

  /**
   * 処理1（単品明細書作成）を実行します。
   */
  const executeCase1 = async (record) => {
    console.log('処理1: 単品明細書作成 を実行します。');
    const workId = getFieldValue(record, CONFIG.FIELD_CODE.WORK_ID);
    if (!workId) throw new Error('「作業ID」が空のため、処理を中断しました。');

    const workRecordTable = getFieldValue(record, CONFIG.FIELD_CODE.WORK_RECORD, []);
    const { timeRecord, areaRecord } = createTableDataFromWorkRecord(workRecordTable);

    const query = `${CONFIG.FIELD_CODE.WORK_ID} = "${workId}"`;
    const searchResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', { app: CONFIG.DEST_APP_ID, query });

    const recordDataForApi = {
      [CONFIG.FIELD_CODE.WORK_ID]: { value: workId },
      [CONFIG.FIELD_CODE.CASE_ID]: { value: getFieldValue(record, CONFIG.FIELD_CODE.CASE_ID) },
      [CONFIG.FIELD_CODE.TIME_RECORD]: { value: timeRecord },
      [CONFIG.FIELD_CODE.AREA_RECORD]: { value: areaRecord },
      [CONFIG.FIELD_CODE.BLADE_USAGE_RECORD]: { value: getFieldValue(record, CONFIG.FIELD_CODE.BLADE_USAGE_RECORD, []) },
    };

    if (searchResp.records.length > 0) {
      const destRecordId = getFieldValue(searchResp.records[0], CONFIG.FIELD_CODE.RECORD_ID);
      await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', { app: CONFIG.DEST_APP_ID, id: destRecordId, record: recordDataForApi });
    } else {
      await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', { app: CONFIG.DEST_APP_ID, record: recordDataForApi });
    }

    // 鋸刃管理アプリへの更新をバルクリクエスト（一括処理）に変更
    console.log('追加処理: 鋸刃使用記録をアプリ50に転記します（一括処理）。');
    const bladeUsageTable = getFieldValue(record, CONFIG.FIELD_CODE.BLADE_USAGE_RECORD, []);

    if (bladeUsageTable.length > 0) {
        const usageDataMap = new Map();
        bladeUsageTable.forEach(row => {
            const rowValue = row.value;
            const lookupId = getFieldValue(rowValue, CONFIG.FIELD_CODE.BLADE_USAGE_TABLE_LOOKUP);
            const usageDate = getFieldValue(rowValue, CONFIG.FIELD_CODE.BLADE_USAGE_TABLE_DATE);
            const usageQty = getFieldValue(rowValue, CONFIG.FIELD_CODE.BLADE_USAGE_TABLE_QTY);

            if (lookupId && usageDate && usageQty) {
                if (!usageDataMap.has(lookupId)) {
                    usageDataMap.set(lookupId, []);
                }
                usageDataMap.get(lookupId).push({
                    value: {
                        [CONFIG.FIELD_CODE.BLADE_MASTER_TABLE_DATE]: { value: usageDate },
                        [CONFIG.FIELD_CODE.BLADE_MASTER_TABLE_QTY]: { value: usageQty }
                    }
                });
            }
        });

        const bladeMasterRecordIds = Array.from(usageDataMap.keys());

        if (bladeMasterRecordIds.length > 0) {
            const queryForGet = bladeMasterRecordIds.map(id => `${CONFIG.FIELD_CODE.RECORD_ID} = "${id}"`).join(' or ');
            const getBladeMasterResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.BLADE_MASTER_APP_ID,
                query: queryForGet
            });

            const recordsForUpdate = getBladeMasterResp.records.map(masterRecord => {
                const recordId = getFieldValue(masterRecord, CONFIG.FIELD_CODE.RECORD_ID);
                const existingTable = getFieldValue(masterRecord, CONFIG.FIELD_CODE.BLADE_MASTER_TABLE, []);
                const newRows = usageDataMap.get(String(recordId)) || [];
                
                return {
                    id: recordId,
                    record: {
                        [CONFIG.FIELD_CODE.BLADE_MASTER_TABLE]: {
                            value: [...existingTable, ...newRows]
                        }
                    }
                };
            });

            if (recordsForUpdate.length > 0) {
                await kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
                    app: CONFIG.BLADE_MASTER_APP_ID,
                    records: recordsForUpdate
                });
                console.log(`アプリ50の${recordsForUpdate.length}件のレコードに使用履歴を転記しました。`);
            }
        }
    }

    // --- アプリ241のステータス更新 ---
    await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
      app: CONFIG.SOURCE_APP_ID,
      id: getFieldValue(record, CONFIG.FIELD_CODE.RECORD_ID),
      record: { [CONFIG.FIELD_CODE.STATUS]: { value: CONFIG.STATUS_VALUE.TRANSFERRED } }
    });

    showNotification('単品明細書の作成（更新）と鋸刃使用記録の転記が完了しました。');
    location.reload();
  };

  /**
   * 処理2（分納品明細転記）を実行します。
   */
  const executeCase2 = async (record) => {
    console.log('処理2: 分納品明細転記 を実行します。');
    const workId = getFieldValue(record, CONFIG.FIELD_CODE.WORK_ID);
    const dedupeId = getFieldValue(record, CONFIG.FIELD_CODE.DELIVERY_DEDUPE_ID);
    const fBunnoValue = getFieldValue(record, CONFIG.FIELD_CODE.F_BUNNO);
    if (!workId || !dedupeId || !fBunnoValue) throw new Error('「作業ID」「分納重複管理ID」「F分納」のいずれかが空のため、処理を中断しました。');

    const workRecordTable = getFieldValue(record, CONFIG.FIELD_CODE.WORK_RECORD, []);
    const { timeRecord, areaRecord } = createTableDataFromWorkRecord(workRecordTable);

    const query = `${CONFIG.FIELD_CODE.WORK_ID} = "${workId}" and ${CONFIG.FIELD_CODE.DELIVERY_DEDUPE_ID} = "${dedupeId}" and ${CONFIG.FIELD_CODE.F_BUNNO} = "${fBunnoValue}"`;
    const searchResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', { app: CONFIG.DEST_APP_ID, query });

    const recordDataForApi = {
      [CONFIG.FIELD_CODE.WORK_ID]: { value: workId },
      [CONFIG.FIELD_CODE.DELIVERY_DEDUPE_ID]: { value: dedupeId },
      [CONFIG.FIELD_CODE.F_BUNNO]: { value: fBunnoValue },
      [CONFIG.FIELD_CODE.CASE_ID]: { value: getFieldValue(record, CONFIG.FIELD_CODE.CASE_ID) },
      [CONFIG.FIELD_CODE.TIME_RECORD]: { value: timeRecord },
      [CONFIG.FIELD_CODE.AREA_RECORD]: { value: areaRecord },
      [CONFIG.FIELD_CODE.BLADE_USAGE_RECORD]: { value: getFieldValue(record, CONFIG.FIELD_CODE.BLADE_USAGE_RECORD, []) },
    };

    let destRecordId;
    if (searchResp.records.length > 0) {
      destRecordId = getFieldValue(searchResp.records[0], CONFIG.FIELD_CODE.RECORD_ID);
      await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', { app: CONFIG.DEST_APP_ID, id: destRecordId, record: recordDataForApi });
    } else {
      const postResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', { app: CONFIG.DEST_APP_ID, record: recordDataForApi });
      destRecordId = postResp.id;
    }

    const updatedTable = getFieldValue(record, CONFIG.FIELD_CODE.DELIVERY_TABLE, []).map(row => ({
      id: row.id,
      value: { ...row.value, [CONFIG.FIELD_CODE.DELIVERY_TABLE_STATUS]: { value: CONFIG.TABLE_STATUS_VALUE.SHIPPED } }
    }));

    await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
      app: CONFIG.SOURCE_APP_ID,
      id: getFieldValue(record, CONFIG.FIELD_CODE.RECORD_ID),
      record: { [CONFIG.FIELD_CODE.DELIVERY_TABLE]: { value: updatedTable } }
    });

    showNotification('分納品明細の転記が完了しました。');
    window.open(`/k/${CONFIG.DEST_APP_ID}/show#record=${destRecordId}`, '_blank');
    location.reload();
  };


  // --- イベントハンドラ ---
  const events = [
    'app.record.detail.show',
    'mobile.app.record.detail.show',
    'app.record.edit.change.' + CONFIG.FIELD_CODE.TOTAL_QUANTITY,
    'app.record.edit.change.' + CONFIG.FIELD_CODE.F_BUNNO,
  ];

  kintone.events.on(events, (event) => {
    if (event.type.indexOf('detail.show') === -1 && event.type.indexOf('edit.change') === -1) {
        return event;
    }
    
    const renderButton = () => {
        const oldButton = document.getElementById(CONFIG.BUTTON_ID);
        if (oldButton) oldButton.remove();

        const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
        if (!headerMenuSpace) {
          return;
        }

        const currentRecord = kintone.app.record.get() ? kintone.app.record.get().record : event.record;
        if (!currentRecord) return;

        const showForCase1 = checkConditionForCase1(currentRecord);
        const showForCase2 = checkConditionForCase2(currentRecord);

        if (!showForCase1 && !showForCase2) {
          console.log('ボタン表示条件を満たしませんでした。');
          return;
        }

        const button = document.createElement('button');
        button.id = CONFIG.BUTTON_ID;
        button.innerText = CONFIG.BUTTON_TEXT_DEFAULT;
        button.className = CONFIG.BUTTON_CLASS;
        button.style.marginLeft = '10px';

        headerMenuSpace.appendChild(button);

        button.onclick = async () => {
          try {
            button.disabled = true;
            button.innerText = CONFIG.BUTTON_TEXT_PROCESSING;

            const recordId = kintone.app.record.getId();
            if (!recordId) throw new Error('レコードIDが取得できませんでした。');

            const getRecordResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'GET', {
              app: CONFIG.SOURCE_APP_ID,
              id: recordId
            });
            const latestRecord = getRecordResp.record;
            
            // 屑分類アプリへのコピー処理を先に実行
            await executeCopyToScrapApp(latestRecord);

            if (checkConditionForCase1(latestRecord)) {
              await executeCase1(latestRecord);
            } else if (checkConditionForCase2(latestRecord)) {
              await executeCase2(latestRecord);
            } else {
              throw new Error('処理の条件を満たさなくなりました。ページをリロードして再度お試しください。');
            }

          } catch (error) {
            console.error('処理中にエラーが発生しました:', error);
            showNotification(error.message || '不明なエラーが発生しました。詳細はコンソールを確認してください。', 'error');
            button.disabled = false;
            button.innerText = CONFIG.BUTTON_TEXT_DEFAULT;
          }
        };
    };

    setTimeout(renderButton, 0);
    return event;
  });
})();

