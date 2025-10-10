/*
 * Copyright (c) 2024 Your Company
 *
 * このプログラムは、kintoneの特定のイベントをトリガーにして、
 * 関連する別アプリのデータを集計・更新し、自身のレコード状態も更新するためのものです。
 *
 * アプリケーションID:
 * - データソースアプリ (このJSを配置するアプリ): 246
 * - データターゲットアプリ (集計先アプリ): 261
 * - 見積管理アプリ (更新対象アプリ): 225
 *
 * 動作概要:
 * 1. PDF出力プラグインのダウンロード完了イベント('goopone.download.success')を捕捉します。
 * 2. アプリ246の現在のレコードから必要な値を取得します。
 * 3. アプリ261(売上集計)を「処理年月」で検索し、レコードを更新または新規作成します。
 * 4. アプリ225(見積管理)を「明細ID」で検索し、該当レコードの状態を更新します。
 * 5. 上記処理が成功した後、アプリ246の現在のレコードのステータスを更新します。
 * 6. 全てのAPIリクエストはバックグラウンドで実行され、画面遷移は発生しません。
 */
(function() {
  'use strict';

  // --- 設定値 ---
  // ご自身の環境に合わせてフィールドコードを修正してください。

  // アプリID
  const TARGET_APP_ID = 261; // 更新先アプリ (売上集計アプリ)
  const ESTIMATE_APP_ID = 225; // ★追加: 見積管理アプリ

  // --- アプリ246 (このコードを配置するアプリ) のフィールドコード ---
  const FIELD_PROCESSING_YM_SRC = '処理年月';
  const FIELD_CUSTOMER_ID_SRC = '客先詳細ID';
  const FIELD_SALES_DATE_SRC = '売上日';
  const FIELD_SALES_AMOUNT_SRC = '書類用作業価格2';
  const FIELD_TRANSPORT_COST_SRC = '書類用輸送価格';
  const FIELD_OUTSOURCING_COST_SRC = '外注作業金額';
  const FIELD_STATUS_RADIO_SRC = 'R明細状態';
  const FIELD_STATUS_FLAG_SRC = '明細転記済フラグ';
  const FIELD_STATUS_GENERAL_SRC = '状態_一般';
  const FIELD_DETAIL_ID_SRC = '明細ID'; // ★追加: 明細ID

  // --- アプリ261 (更新先アプリ) のフィールドコード ---
  const FIELD_PROCESSING_YM_DEST = '処理年月';
  const FIELD_TABLE_DEST = 'T売上集計';
  // テーブル内のフィールドコード
  const FIELD_CUSTOMER_ID_IN_TABLE = '客先詳細ID';
  const FIELD_SALES_DATE_IN_TABLE = '売上日';
  const FIELD_SALES_AMOUNT_IN_TABLE = '売上金額';
  const FIELD_TRANSPORT_COST_IN_TABLE = '内輸送費';
  const FIELD_OUTSOURCING_COST_IN_TABLE = '内外注費';

  // --- ★追加: アプリ225 (見積管理アプリ) のフィールドコード ---
  const FIELD_DETAIL_ID_DEST_225 = '明細ID';
  const FIELD_ESTIMATE_STATUS_DEST_225 = 'R見積状態';


  // --- 処理の重複実行を防止するためのフラグ ---
  let isProcessing = false; // 処理が実行中かどうかを示すフラグ
  let isListenerAttached = false; // イベントリスナーが登録済みかを示すフラグ

  /**
   * メイン処理を実行する非同期関数
   * @param {object} event - プラグインから渡されるイベントオブジェクト
   */
  const handleProcess = async (event) => {
    if (isProcessing) {
      console.log('処理が既に実行中のため、今回のトリガーはスキップします。');
      return;
    }
    isProcessing = true;

    try {
      const currentRecordResponse = kintone.app.record.get();
      if (!currentRecordResponse || !currentRecordResponse.record) {
        console.log('レコード詳細情報が取得できません。詳細画面で実行してください。');
        return;
      }
      const currentRecord = currentRecordResponse.record;

      const processingYm = currentRecord[FIELD_PROCESSING_YM_SRC].value;
      const customerId = currentRecord[FIELD_CUSTOMER_ID_SRC].value;
      const detailId = currentRecord[FIELD_DETAIL_ID_SRC].value; // 明細IDを取得

      if (!processingYm || !customerId) {
        alert('「処理年月」または「客先詳細ID」が空のため、処理を中断しました。');
        return;
      }

      console.log(`処理を開始します。対象年月: ${processingYm}, 客先詳細ID: ${customerId}`);

      // 1. 売上集計アプリ(261)の更新処理
      const query = `${FIELD_PROCESSING_YM_DEST} = "${processingYm}" limit 1`;
      const getResponse = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
        app: TARGET_APP_ID,
        query: query
      });

      const salesDate = currentRecord[FIELD_SALES_DATE_SRC].value;
      const salesAmount = parseFloat(currentRecord[FIELD_SALES_AMOUNT_SRC].value || 0);
      const transportCost = parseFloat(currentRecord[FIELD_TRANSPORT_COST_SRC].value || 0);
      const outsourcingCost = parseFloat(currentRecord[FIELD_OUTSOURCING_COST_SRC].value || 0);

      if (getResponse.records.length > 0) {
        const targetRecord = getResponse.records[0];
        const targetRecordId = targetRecord.$id.value;
        const tableRows = targetRecord[FIELD_TABLE_DEST].value;
        const targetRow = tableRows.find(row => row.value[FIELD_CUSTOMER_ID_IN_TABLE].value === customerId);

        if (targetRow) {
          console.log('既存の行を更新します。');
          const existingSales = parseFloat(targetRow.value[FIELD_SALES_AMOUNT_IN_TABLE].value || 0);
          const existingTransport = parseFloat(targetRow.value[FIELD_TRANSPORT_COST_IN_TABLE].value || 0);
          const existingOutsourcing = parseFloat(targetRow.value[FIELD_OUTSOURCING_COST_IN_TABLE].value || 0);

          targetRow.value[FIELD_SALES_DATE_IN_TABLE].value = salesDate;
          targetRow.value[FIELD_SALES_AMOUNT_IN_TABLE].value = (existingSales + salesAmount).toString();
          targetRow.value[FIELD_TRANSPORT_COST_IN_TABLE].value = (existingTransport + transportCost).toString();
          targetRow.value[FIELD_OUTSOURCING_COST_IN_TABLE].value = (existingOutsourcing + outsourcingCost).toString();
        } else {
          console.log('新しい行を追加します。');
          tableRows.push({
            value: {
              [FIELD_CUSTOMER_ID_IN_TABLE]: { value: customerId },
              [FIELD_SALES_DATE_IN_TABLE]: { value: salesDate },
              [FIELD_SALES_AMOUNT_IN_TABLE]: { value: salesAmount.toString() },
              [FIELD_TRANSPORT_COST_IN_TABLE]: { value: transportCost.toString() },
              [FIELD_OUTSOURCING_COST_IN_TABLE]: { value: outsourcingCost.toString() }
            }
          });
        }
        const putParams = { app: TARGET_APP_ID, id: targetRecordId, record: { [FIELD_TABLE_DEST]: { value: tableRows } } };
        await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', putParams);
        console.log(`売上集計アプリの更新完了: レコードID ${targetRecordId}`);
      } else {
        console.log('該当レコードが見つからないため、新規作成します。');
        const newTableRows = [{
          value: {
            [FIELD_CUSTOMER_ID_IN_TABLE]: { value: customerId },
            [FIELD_SALES_DATE_IN_TABLE]: { value: salesDate },
            [FIELD_SALES_AMOUNT_IN_TABLE]: { value: salesAmount.toString() },
            [FIELD_TRANSPORT_COST_IN_TABLE]: { value: transportCost.toString() },
            [FIELD_OUTSOURCING_COST_IN_TABLE]: { value: outsourcingCost.toString() }
          }
        }];
        const postParams = { app: TARGET_APP_ID, record: { [FIELD_PROCESSING_YM_DEST]: { value: processingYm }, [FIELD_TABLE_DEST]: { value: newTableRows } } };
        const postResponse = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', postParams);
        console.log(`売上集計アプリの新規作成完了: レコードID ${postResponse.id}`);
      }

      // --- ★追加: 2. 見積管理アプリ(225)の更新処理 ---
      if (detailId) {
        console.log(`見積管理アプリ(225)の更新を開始します。対象明細ID: ${detailId}`);
        const queryEstimate = `${FIELD_DETAIL_ID_DEST_225} = "${detailId}" limit 1`;
        const getEstimateResponse = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
          app: ESTIMATE_APP_ID,
          query: queryEstimate
        });

        if (getEstimateResponse.records.length > 0) {
          const estimateRecord = getEstimateResponse.records[0];
          const estimateRecordId = estimateRecord.$id.value;
          const updateEstimateParams = {
            app: ESTIMATE_APP_ID,
            id: estimateRecordId,
            record: {
              [FIELD_ESTIMATE_STATUS_DEST_225]: { value: '見積管理完了' }
            }
          };
          await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updateEstimateParams);
          console.log(`見積管理アプリのレコード(ID: ${estimateRecordId})を更新しました。`);
        } else {
          console.log(`見積管理アプリに明細ID: ${detailId} のレコードが見つかりませんでした。`);
        }
      } else {
        console.log('明細IDが空のため、見積管理アプリの更新はスキップします。');
      }

      // --- 3. コピー元レコード(アプリ246)の状態を更新 ---
      console.log('コピー元レコードを更新します。');
      const sourceRecordId = kintone.app.record.getId();
      const updateSourceParams = {
        app: kintone.app.getId(),
        id: sourceRecordId,
        record: {
          [FIELD_STATUS_RADIO_SRC]: { value: '明細転記済' },
          [FIELD_STATUS_FLAG_SRC]: { value: '1' },
          [FIELD_STATUS_GENERAL_SRC]: { value: '納品・請求書作成、送付済み' }
        }
      };
      await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updateSourceParams);
      console.log(`コピー元レコード(ID: ${sourceRecordId})を更新しました。`);

      // 成功メッセージを統一
      alert(`関連アプリの更新と、このレコードのステータス更新が完了しました。\nページをリロードすると変更が反映されます。`);

    } catch (error) {
      console.error('処理中にエラーが発生しました:', error);
      alert('エラーが発生しました。詳細はデベロッパーツールのコンソールを確認してください。');
    } finally {
      isProcessing = false;
    }
  };

  // kintoneイベントハンドラを登録
  kintone.events.on(['app.record.index.show', 'app.record.detail.show'], (event) => {
    if (typeof tisevent !== 'undefined' && !isListenerAttached) {
      console.log('プラグインイベントリスナーを一度だけ登録します。');
      tisevent.on('goopone.download.success', handleProcess);
      isListenerAttached = true;
    } else if (isListenerAttached) {
      // すでに登録済みの場合は何もしない
    } else {
      console.log('tiseventオブジェクトが見つかりません。PDF出力プラグインが有効か確認してください。');
    }
    return event;
  });

})();
