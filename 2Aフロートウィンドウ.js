/**
 * kintone カスタマイズ - 作業管理アプリ
 * 
 * このカスタマイズではSweetAlert2ライブラリを使用します。
 * kintoneの「JavaScript / CSSでカスタマイズ」設定で、
 * 以下のURLをこのファイルより「先」に追加してください。
 * https://cdn.jsdelivr.net/npm/sweetalert2@11
 * @fileoverview 作業進捗管理と保管材管理のための拡張機能
 * @version 2.1.0
 */

(function () {
  'use strict';

  // =================================================================
  // 型定義（JSDoc形式）
  // =================================================================

  /**
   * @typedef {Object.<string, [string, string]>} ProcessRoute
   *   - key: 現在のステータス（STATUSES の値）
   *   - value: [アクション名, 次ステータス]
   */

  /**
   * @typedef {Object.<string, ProcessRoute>} ProcessRoutes
   *   - key: 外注作業種別（OUTSOURCE_TYPES の値）
   *   - value: ProcessRoute
   */

  /**
   * @typedef {Object} ErrorResponse
   * @property {string} type - エラーの種類
   * @property {string} message - エラーメッセージ
   * @property {*} [originalError] - 元のエラーオブジェクト
   */

  // =================================================================
  // 設定・定数
  // =================================================================

  /** システム全体の設定 */
  const CONFIG = Object.freeze({
    RETRY_COUNT: 3,
    API_TIMEOUT: 5000, // ms
    AUTO_SAVE_DELAY: 1000,
    ERROR_LOG_ENABLED: true,
    DEBUG_MODE: false
  });

  /** アプリケーションID */
  const DEST_APP_ID = 240; // 保管材アプリID

  /** エラータイプの定義 */
  const ERROR_TYPES = Object.freeze({
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  });

  /**
   * フィールドコードを定数として定義
   */
  const FIELDS = Object.freeze({
    // このアプリのフィールド
    TASK_ID: '作業ID',
    STATUS: 'R現況',
    OUTSOURCE_TYPE: 'R外注作業',
    REMAINING_MATERIAL: '残材',
    STORAGE_ID: '保管材管理番号',
    CUSTOMER_DETAIL_ID: '客先詳細ID',
    CUSTOMER_NAME: '客先名',
    CARD_NO: 'カードNo',
    STEEL_TYPE: '社内鋼種',
    MELT_NO: '溶解番号',
    SCRAP_CLASS: '屑分類',
    POLE: 'Lポール',
    ITEM_DIMENSIONS: '品名寸法',
    ESTIMATE_WORK_TYPE: '見積用作業種別',
    REMAINING_DIMENSION_CALC: 'C残寸法', // ← チェックボックス（配列）
    SPLIT_DELIVERY_1: 'C分納1',
    SPLIT_DELIVERY_2: 'C分納2',
    FULL_DELIVERY_FLAG: 'C完納',
    TOTAL_QUANTITY: '総計上数量',
    INTERRUPT_RETURN_STATUS: 'F中断復帰',
    CHECK_DATE: 'チェック日',
    DELIVERY_DATE: '納品日',
    WORK_INFO_1: 'C作業付帯情報1',
    WORK_INFO_2: 'C作業付帯情報2',
    IDENTIFY_INFO: 'C識別付帯情報',
    SPLIT_DELIVERY_TABLE: 'T分納記録',
    SPLIT_DELIVERY_STATUS: 'R分納明細転記',
    // 保管材アプリのフィールド
    DEST_STORAGE_STATUS: 'R保管材ステータス',
    DEST_STORAGE_RECORD_TABLE: 'T保管素材記録',
    DEST_STORAGE_TYPE: 'D保管材種別'
  });

  /**
   * ステータス文字列を定数として定義
   */
  const STATUSES = Object.freeze({
    NOT_ACCEPTED: '未受入 →',
    ACCEPTED: '受入済 →',
    WORKING: '作業中 →',
    WORK_DONE_CHECK_WAIT: '作業完了/チェック待ち →',
    CHECK_DONE_SHIP_WAIT: 'チェック完了/出荷待ち →',
    SHIPPED: '出荷済',
    OUTSOURCING: '外注作業中',
    INTERRUPTED: '不適合・中断',
    TRANSFER_DONE: '明細転記済',
    STORAGE_IN_STOCK: '現在保管中',
    STORAGE_ALL_USED: '全量作業済み',
    ALL_MATERIAL_USED: '素材全量使用済・残寸法ゼロ' // ← C残寸法（チェックボックス）に含まれるラベル
  });

  /**
   * 外注作業種別を定数として定義
   */
  const OUTSOURCE_TYPES = Object.freeze({
    NONE: 'なし',
    AFTER_CUT: '切断後外注',
    BEFORE_CUT: '切断前外注',
    ONLY_OUTSOURCE: '外注のみ'
  });

  /**
   * 繰り返し利用するキーワード（文字列）を定数化
   */
  const KEYWORDS = Object.freeze({
    STORAGE: '保管',
    FROM_STORAGE: '保管材からの作業',
    S_KA: 'S化',
    BUNNO: '分納',
    STOP_AND_STORAGE: '一時作業停止し保管材へ'
  });

  /**
   * プロセスの状態遷移を定義
   * @type {ProcessRoutes}
   */
  const processRoutes = Object.freeze({
    [OUTSOURCE_TYPES.NONE]: Object.freeze({
      [STATUSES.NOT_ACCEPTED]: ['受入完了', STATUSES.ACCEPTED],
      [STATUSES.ACCEPTED]: ['作業開始', STATUSES.WORKING],
      [STATUSES.WORKING]: ['作業完了', STATUSES.WORK_DONE_CHECK_WAIT],
      [STATUSES.WORK_DONE_CHECK_WAIT]: ['チェック', STATUSES.CHECK_DONE_SHIP_WAIT],
      [STATUSES.CHECK_DONE_SHIP_WAIT]: ['出荷', STATUSES.SHIPPED]
    }),
    [OUTSOURCE_TYPES.AFTER_CUT]: Object.freeze({
      [STATUSES.NOT_ACCEPTED]: ['受入完了', STATUSES.ACCEPTED],
      [STATUSES.ACCEPTED]: ['作業開始', STATUSES.WORKING],
      [STATUSES.WORKING]: ['作業完了 →外注作業', STATUSES.OUTSOURCING],
      [STATUSES.OUTSOURCING]: ['引取・チェック', STATUSES.WORK_DONE_CHECK_WAIT],
      [STATUSES.WORK_DONE_CHECK_WAIT]: ['チェック', STATUSES.CHECK_DONE_SHIP_WAIT],
      [STATUSES.CHECK_DONE_SHIP_WAIT]: ['出荷', STATUSES.SHIPPED]
    }),
    [OUTSOURCE_TYPES.BEFORE_CUT]: Object.freeze({
      [STATUSES.NOT_ACCEPTED]: ['受入完了', STATUSES.ACCEPTED],
      [STATUSES.ACCEPTED]: ['外注作業', STATUSES.OUTSOURCING],
      [STATUSES.OUTSOURCING]: ['引取・作業開始', STATUSES.WORKING],
      [STATUSES.WORKING]: ['作業完了', STATUSES.WORK_DONE_CHECK_WAIT],
      [STATUSES.WORK_DONE_CHECK_WAIT]: ['チェック', STATUSES.CHECK_DONE_SHIP_WAIT],
      [STATUSES.CHECK_DONE_SHIP_WAIT]: ['出荷', STATUSES.SHIPPED]
    }),
    [OUTSOURCE_TYPES.ONLY_OUTSOURCE]: Object.freeze({
      [STATUSES.NOT_ACCEPTED]: ['受入完了', STATUSES.ACCEPTED],
      [STATUSES.ACCEPTED]: ['外注作業', STATUSES.OUTSOURCING],
      [STATUSES.OUTSOURCING]: ['引取', STATUSES.WORK_DONE_CHECK_WAIT],
      [STATUSES.WORK_DONE_CHECK_WAIT]: ['チェック', STATUSES.CHECK_DONE_SHIP_WAIT],
      [STATUSES.CHECK_DONE_SHIP_WAIT]: ['出荷', STATUSES.SHIPPED]
    })
  });

  // =================================================================
  // エラーハンドリング
  // =================================================================

  /** ログ専用（UI通知はしない） */
  const logError = (error, type, context) => {
    if (!CONFIG.ERROR_LOG_ENABLED) return;
    console.error(`[${context}] ${type}:`, {
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * エラーログを記録し、ユーザに通知する（アラート）
   */
  const handleError = (error, type, context) => {
    logError(error, type, context);

    const userMessages = {
      [ERROR_TYPES.VALIDATION_ERROR]: '入力内容を確認してください',
      [ERROR_TYPES.API_ERROR]: 'APIリクエストに失敗しました',
      [ERROR_TYPES.NETWORK_ERROR]: 'ネットワーク接続を確認してください',
      [ERROR_TYPES.STORAGE_ERROR]: '保管材の処理に失敗しました',
      [ERROR_TYPES.UNKNOWN_ERROR]: 'システムエラーが発生しました'
    };

    const userMessage = userMessages[type] || userMessages[ERROR_TYPES.UNKNOWN_ERROR];
    // alert(`${userMessage}\n詳細: ${error?.message || '予期せぬエラーが発生しました'}`);
    Swal.fire({
      icon: 'error',
      title: userMessage,
      html: `詳細はコンソールを確認してください。<br><pre style="text-align: left; background-color: #f3f3f3; padding: 1em; white-space: pre-wrap; word-break: break-all;">${error?.message || '予期せぬエラー'}</pre>`
    });
  };

  // =================================================================
  // ヘルパー関数
  // =================================================================

  /**
   * 値のバリデーションを行う
   * @param {*} value - 検証する値
   * @param {string} fieldName - フィールド名
   * @param {Object} options - バリデーションオプション
   * @throws {Error} バリデーションエラー
   */
  const validateValue = (value, fieldName, options = {}) => {
    if (options.required && (value === undefined || value === null || value === '')) {
      throw new Error(`${fieldName}は必須です`);
    }
    if (options.maxLength && String(value).length > options.maxLength) {
      throw new Error(`${fieldName}は${options.maxLength}文字以内で入力してください`);
    }
    if (options.pattern && !options.pattern.test(String(value))) {
      throw new Error(`${fieldName}の形式が不正です`);
    }
  };

  /**
   * 文字列/配列/未定義に安全な includes
   */
  const safeIncludes = (v, needle) => {
    if (v == null) return false;
    try {
      return v.includes(needle);
    } catch {
      return false;
    }
  };

  /**
   * 16進数カラーコードを明るくする（入力不正時は #cccccc を返す）
   * @param {string} hex - 16進数カラーコード
   * @param {number} percent - 明るくする割合(0-100)
   * @returns {string} 変換後のカラーコード
   */
  const lightenColor = (hex, percent) => {
    hex = String(hex || '').replace(/^#/, '');
    if (!/^[A-Fa-f0-9]{3}([A-Fa-f0-9]{3})?$/.test(hex)) return '#cccccc';
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const clamp = (n) => Math.max(0, Math.min(255, n));
    const amt = Math.round(2.55 * Math.max(0, Math.min(100, percent || 0)));
    const r = clamp(parseInt(hex.slice(0, 2), 16) + amt);
    const g = clamp(parseInt(hex.slice(2, 4), 16) + amt);
    const b = clamp(parseInt(hex.slice(4, 6), 16) + amt);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  /** 今日 (YYYY-MM-DD) 文字列 */
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /** Promise にタイムアウトを付与 */
  const withTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('API timeout')), ms);
      promise.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });

  // APIリクエストの再試行を行うヘルパー関数（指数バックオフ）
  const retryApiRequest = async (apiCall, maxRetries = CONFIG.RETRY_COUNT) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await withTimeout(apiCall(), CONFIG.API_TIMEOUT);
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          const delay = 500 * Math.pow(2, i); // 500ms, 1000ms, 2000ms...
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  };

  /**
   * kintoneの保存ボタンをクリックする（複数セレクタに対応）
   * @returns {boolean} クリックできたか
   */
  const clickSaveButton = () => {
    const selectors = [
      '.gaia-ui-actionmenu-save',
      '[data-gaia-automation-id="record-save-button"]',
      '.recordlist-save-gaia'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        return true;
      }
    }
    logError(new Error('Save button not found'), ERROR_TYPES.UNKNOWN_ERROR, 'clickSaveButton');
    return false;
  };

  /**
   * kintoneのキャンセルボタンをクリックする（複数セレクタに対応）
   * @returns {boolean} クリックできたか
   */
  const clickCancelButton = () => {
    const selectors = [
      '.gaia-ui-actionmenu-cancel',
      '[data-gaia-automation-id="record-cancel-button"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        return true;
      }
    }
    logError(new Error('Cancel button not found'), ERROR_TYPES.UNKNOWN_ERROR, 'clickCancelButton');
    return false;
  };

  // =================================================================
  // APIラッパー関数
  // =================================================================

  /**
   * kintone API呼び出しのラッパー関数
   *   - ここでは UI 通知を行わず、Error をスローするのみ（呼び出し側で通知）
   * @param {Function} apiCall - () => Promise<any>
   * @returns {Promise<*>} API呼び出し結果
   */
  const callKintoneApi = async (apiCall) => {
    try {
      return await retryApiRequest(apiCall);
    } catch (error) {
      logError(error, ERROR_TYPES.API_ERROR, 'KintoneAPI');
      throw (error instanceof Error ? error : new Error(String(error?.message || 'API error')));
    }
  };

  /**
   * 保管材レコードのステータスを更新する（バックグラウンド処理）
   */
  const updateStorageMaterialStatus = async (currentRecord) => {
    const managementNo = currentRecord?.[FIELDS.STORAGE_ID]?.value;
    try {
      validateValue(managementNo, '保管材管理番号', { required: true });

      const getRes = await callKintoneApi(() =>
        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
          app: DEST_APP_ID,
          query: `${FIELDS.STORAGE_ID} = "${managementNo}" limit 1`
        })
      );

      if (!getRes.records || getRes.records.length === 0) {
        throw new Error(`保管材アプリに管理番号「${managementNo}」のレコードが見つかりません。`);
      }

      const target = getRes.records[0];
      const recordId = target.$id?.value || target.$id;
      const revision = target.$revision?.value || target.$revision;

      const updateBody = {
        app: DEST_APP_ID,
        id: recordId,
        revision: revision,
        record: {
          [FIELDS.DEST_STORAGE_STATUS]: { value: STATUSES.STORAGE_ALL_USED }
        }
      };

      await callKintoneApi(() =>
        kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updateBody)
      );

      Swal.fire({
        icon: 'info',
        title: '保管材ステータス更新',
        text: `保管材(管理番号: ${managementNo})のステータスを「${STATUSES.STORAGE_ALL_USED}」に更新しました。`
      });
    } catch (error) {
      handleError(error, ERROR_TYPES.STORAGE_ERROR, 'StorageUpdate');
    }
  };

  /**
   * 保管材登録アプリのレコードを更新し、画面遷移の準備をする
   * @param {object} rec - 現在のレコードデータ
   * @returns {Promise<string|null>} 成功した場合は遷移先URL、失敗した場合はnull
   */
  const getStorageAppUrl = async (rec) => {
    try {
      const managementNo = rec?.[FIELDS.STORAGE_ID]?.value;
      const taskId = rec?.[FIELDS.TASK_ID]?.value;

      validateValue(taskId, '作業ID', { required: true });

      const query = managementNo
        ? `${FIELDS.STORAGE_ID} = "${managementNo}"`
        : `${FIELDS.TASK_ID} = "${taskId}"`;

      const getRes = await callKintoneApi(() =>
        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
          app: DEST_APP_ID,
          query: `${query} limit 1`
        })
      );

      const updateRec = {
        [FIELDS.STORAGE_ID]: { value: managementNo },
        [FIELDS.TASK_ID]: { value: taskId },
        [FIELDS.CUSTOMER_DETAIL_ID]: { value: rec?.[FIELDS.CUSTOMER_DETAIL_ID]?.value },
        [FIELDS.CARD_NO]: { value: rec?.[FIELDS.CARD_NO]?.value },
        [FIELDS.STEEL_TYPE]: { value: rec?.[FIELDS.STEEL_TYPE]?.value },
        [FIELDS.MELT_NO]: { value: rec?.[FIELDS.MELT_NO]?.value },
        [FIELDS.SCRAP_CLASS]: { value: rec?.[FIELDS.SCRAP_CLASS]?.value },
        [FIELDS.POLE]: { value: rec?.[FIELDS.POLE]?.value },
        [FIELDS.ITEM_DIMENSIONS]: { value: rec?.[FIELDS.ITEM_DIMENSIONS]?.value }
      };

      const workType = rec?.[FIELDS.ESTIMATE_WORK_TYPE]?.value;
      if (workType === 'ビレット') {
        updateRec[FIELDS.DEST_STORAGE_TYPE] = { value: '(大同)ビレット' };
      } else if (workType === 'スタート板採取') {
        updateRec[FIELDS.DEST_STORAGE_TYPE] = { value: '(大同)スタート板専用ポール' };
      }

      // C残寸法（チェックボックス）に「素材全量使用済・残寸法ゼロ」が含まれているかで判定
      const zansuSelections = rec?.[FIELDS.REMAINING_DIMENSION_CALC]?.value;
      const isZansuZero = safeIncludes(zansuSelections, STATUSES.ALL_MATERIAL_USED);

      let recordId;
      const updateBody = { app: DEST_APP_ID, record: updateRec };

      if (isZansuZero) {
        updateRec[FIELDS.DEST_STORAGE_STATUS] = { value: STATUSES.STORAGE_ALL_USED };
        updateRec[FIELDS.DEST_STORAGE_RECORD_TABLE] = { value: [] };
      }

      if (getRes.records && getRes.records.length > 0) {
        if (!isZansuZero) {
          updateRec[FIELDS.DEST_STORAGE_STATUS] = { value: STATUSES.STORAGE_IN_STOCK };
        }
        const target = getRes.records[0];
        recordId = target.$id?.value || target.$id;
        const revision = target.$revision?.value || target.$revision;

        updateBody.id = recordId;
        updateBody.revision = revision;

        await callKintoneApi(() =>
          kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updateBody)
        );
      } else {
        const postRes = await callKintoneApi(() =>
          kintone.api(kintone.api.url('/k/v1/record', true), 'POST', updateBody)
        );
        recordId = postRes?.id;
      }

      if (recordId) {
        const url = `/k/${DEST_APP_ID}/show#record=${recordId}&mode=edit`;
        return url;
      }
      return null;
    } catch (error) {
      handleError(error, ERROR_TYPES.STORAGE_ERROR, 'StorageTransition');
    }
  };

  /**
   * 保管材入力のメッセージを表示し、画面遷移の準備をする
   * @returns {Promise<boolean>} 処理成功時はtrue
   */
  const promptAndPrepareStorageApp = async () => {
    await Swal.fire({
      icon: 'info',
      title: '保管材入力',
      text: '保管材の入力をしてください。'
    });
    const record = kintone.app.record.get().record;
    const url = await getStorageAppUrl(record);
    return url;
  };

  // =================================================================
  // UI操作ユーティリティ
  // =================================================================

  /** 既存のフローティングウィンドウを削除する */
  const removeFloatWindow = () => {
    try {
      const existingWindow = document.getElementById('floatWindow');
      if (existingWindow) {
        existingWindow.remove();
      }
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'RemoveFloatWindow');
    }
  };

  // =================================================================
  // UI生成関数
  // =================================================================

  /**
   * 汎用的なボタンを生成する
   */
  const createButton = (label, bgColor, textColor, onClick, hoverColor = null) => {
    try {
      validateValue(label, 'ボタンラベル', { required: true });
      validateValue(bgColor, '背景色', {
        required: true,
        pattern: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      });

      const btn = document.createElement('button');
      btn.textContent = label;
      btn.classList.add('fw-button');

      const finalHoverColor = hoverColor || lightenColor(bgColor, 20);

      // CSS変数でスタイルを設定
      btn.style.setProperty('--button-bg-color', bgColor);
      btn.style.setProperty('--button-hover-color', finalHoverColor);
      btn.style.setProperty('--button-text-color', textColor || '#ffffff');

      // デバウンスされたクリックハンドラを設定
      let isProcessing = false;
      btn.addEventListener('click', async (e) => {
        if (isProcessing) return;
        isProcessing = true;
        try {
          await onClick(e);
        } catch (error) {
          handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'ButtonClick');
        } finally {
          isProcessing = false;
        }
      });

      return btn;
    } catch (error) {
      handleError(error, ERROR_TYPES.VALIDATION_ERROR, 'ButtonCreation');
      return null;
    }
  };

  /**
   * レコード情報を表示するエリアを生成する
   */
  const createInfoArea = (record) => {
    try {
      validateValue(record, 'レコード', { required: true });

      const infoDiv = document.createElement('div');
      infoDiv.classList.add('float-info');

      [
        [FIELDS.STATUS, '現況'],
        [FIELDS.CARD_NO, '案件管理名'],
        [FIELDS.CUSTOMER_NAME, '客先名']
      ].forEach(([fieldCode, label]) => {
        const row = document.createElement('div');
        row.classList.add('info-row');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        row.appendChild(strong);
        row.appendChild(document.createTextNode(record?.[fieldCode]?.value || ''));
        infoDiv.appendChild(row);
      });

      const workInfos = [FIELDS.WORK_INFO_1, FIELDS.WORK_INFO_2, FIELDS.IDENTIFY_INFO]
        .map((c) => record?.[c]?.value)
        .filter(Boolean)
        .join(' ');

      if (workInfos) {
        const wiRow = document.createElement('div');
        wiRow.classList.add('info-row');
        const wiLabel = document.createElement('strong');
        wiLabel.textContent = '作業付帯情報: ';
        wiRow.appendChild(wiLabel);
        wiRow.appendChild(document.createTextNode(workInfos));
        infoDiv.appendChild(wiRow);
      }
      return infoDiv;
    } catch (error) {
      handleError(error, ERROR_TYPES.VALIDATION_ERROR, 'InfoAreaCreation');
      return null;
    }
  };

  /**
   * レコードの状態から、実行すべきプロセスアクションを決定する
   * @returns {{ caption: string, onClick: Function } | null}
   */
  const determineProcessAction = (record) => {
    try {
      validateValue(record, 'レコード', { required: true });

      const status = record?.[FIELDS.STATUS]?.value;
      const external = record?.[FIELDS.OUTSOURCE_TYPE]?.value || OUTSOURCE_TYPES.NONE;
      const zanasi = record?.[FIELDS.REMAINING_MATERIAL]?.value;

      const isBunno =
        safeIncludes(record?.[FIELDS.SPLIT_DELIVERY_1]?.value, KEYWORDS.BUNNO) ||
        safeIncludes(record?.[FIELDS.SPLIT_DELIVERY_2]?.value, KEYWORDS.BUNNO);
      const isKan = safeIncludes(record?.[FIELDS.FULL_DELIVERY_FLAG]?.value, KEYWORDS.STOP_AND_STORAGE);
      const soukeijouSuuryou = record?.[FIELDS.TOTAL_QUANTITY]?.value;
      
      /**
       * ステータス更新処理の共通ロジック
       * @param {string} nextStatus - 次のステータス
       */
      const createStatusUpdateAction = (nextStatus) => async (e) => {
        e.target.disabled = true;
        Swal.fire({
          title: '処理中...',
          text: 'ステータスを更新しています。',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        try {
          const currentRecordData = kintone.app.record.get().record;
          const updates = { [FIELDS.STATUS]: { value: nextStatus } };

          if (nextStatus === STATUSES.INTERRUPTED) {
            updates[FIELDS.INTERRUPT_RETURN_STATUS] = { value: status };
          }
          if (status === STATUSES.WORK_DONE_CHECK_WAIT) {
            updates[FIELDS.CHECK_DATE] = { value: getTodayString() };
          }
          if (status === STATUSES.CHECK_DONE_SHIP_WAIT) {
            updates[FIELDS.DELIVERY_DATE] = { value: getTodayString() };
          }

          const isTargetStatus = currentRecordData?.[FIELDS.STATUS]?.value === STATUSES.CHECK_DONE_SHIP_WAIT;
          const isSazaiSka = currentRecordData?.[FIELDS.REMAINING_MATERIAL]?.value === KEYWORDS.S_KA;
          const isFromStorage = safeIncludes(currentRecordData?.[FIELDS.WORK_INFO_2]?.value, KEYWORDS.FROM_STORAGE);

          if (isTargetStatus && isSazaiSka && isFromStorage) {
            await updateStorageMaterialStatus(currentRecordData);
          }

          await callKintoneApi(() => kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
            app: kintone.app.getId(),
            id: kintone.app.record.getId(),
            record: updates
          }));

          await Swal.fire({
            icon: 'success',
            title: '更新しました',
            timer: 1500,
            showConfirmButton: false
          });

          // ページを離れる際の確認ダイアログを無効化し、詳細画面へ強制的に遷移する
          window.onbeforeunload = null;
          const detailUrl = `/k/${kintone.app.getId()}/show#record=${kintone.app.record.getId()}`;
          window.location.href = detailUrl;

        } catch (error) {
          handleError(error, ERROR_TYPES.API_ERROR, 'StatusUpdate');
          e.target.disabled = false;
        }
      };

      if (status === STATUSES.WORKING) {
        if (external === OUTSOURCE_TYPES.NONE) {
          if (isBunno) {
            if (!isKan) {
              return {
                caption: '作業中断',
                onClick: createStatusUpdateAction(STATUSES.INTERRUPTED)
              };
            } else {
              if (soukeijouSuuryou && Number.parseFloat(soukeijouSuuryou) !== 0) {
                return {
                  caption: '全ストップ・計上要求',
                  onClick: async (e) => {
                    await Swal.fire({
                      icon: 'warning',
                      title: '確認',
                      text: '総計上数量が0になるようにしてください。作業を中断します。'
                    });
                    createStatusUpdateAction(STATUSES.INTERRUPTED)(e);
                  }
                };
              } else {
                const [caption] = processRoutes[external][status];
                const onClick =
                  zanasi === KEYWORDS.STORAGE
                    ? async (e) => {
                        const url = await promptAndPrepareStorageApp();
                        if (url) {
                          window.location.href = url;
                        } else {
                          createStatusUpdateAction(STATUSES.TRANSFER_DONE)(e);
                        }
                      }
                    : createStatusUpdateAction(STATUSES.TRANSFER_DONE);
                return { caption, onClick };
              }
            }
          }
        }
        if (zanasi === KEYWORDS.STORAGE) {
          const [caption, nextStatus] = processRoutes[external][status];
          return {
            caption,
            onClick: async (e) => {
              const url = await promptAndPrepareStorageApp();
              if (url) {
                window.location.href = url;
              }
              createStatusUpdateAction(nextStatus)(e);
            }
          };
        }
      }

      const route = processRoutes[external]?.[status];
      if (route) {
        const [caption, nextStatus] = route;
        return { caption, onClick: createStatusUpdateAction(nextStatus) };
      }

      return null;
    } catch (error) {
      handleError(error, ERROR_TYPES.VALIDATION_ERROR, 'ProcessAction');
      return null;
    }
  };

  /**
   * プロセス進行ボタンを生成する
   */
  const createProcessButton = (record) => {
    try {
      const action = determineProcessAction(record);
      if (!action) return null;

      const btn = createButton(action.caption, '#3498db', 'white', action.onClick);
      if (btn) btn.classList.add('button-full-width');
      return btn;
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'ProcessButton');
      return null;
    }
  };

  /**
   * 一時保存・中断/再開ボタンを生成する
   */
  const createActionButtons = (record) => {
    try {
      validateValue(record, 'レコード', { required: true });

      const rowDiv = document.createElement('div');
      rowDiv.classList.add('button-row');

      const saveBtn = createButton('一時保存', '#DB7734', 'white', (e) => {
        e.target.disabled = true;
        clickSaveButton();
      }, '#ff9b67');

      if (saveBtn) {
        saveBtn.classList.add('button-half-width');
        rowDiv.appendChild(saveBtn);
      }

      const isInterrupted = record?.[FIELDS.STATUS]?.value === STATUSES.INTERRUPTED;
      const interruptLabel = isInterrupted ? '再開' : '不適合・中断';
      const interruptBtn = createButton(
        interruptLabel,
        '#DB3498',
        'white',
        async (e) => {
          const currentRecord = kintone.app.record.get().record;
          let nextStatus;
          if (isInterrupted) {
            nextStatus = currentRecord?.[FIELDS.INTERRUPT_RETURN_STATUS]?.value;
          } else {
            nextStatus = STATUSES.INTERRUPTED;
          }
          // createStatusUpdateAction は次のステータスを引数に取る
          await createStatusUpdateAction(nextStatus)(e);
        },
        '#ff67cb'
      );

      if (interruptBtn) {
        interruptBtn.classList.add('button-half-width');
        rowDiv.appendChild(interruptBtn);
      }

      return rowDiv;
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'ActionButtons');
      return null;
    }
  };

  /**
   * 保管材登録ボタンを生成する
   */
  const createStorageButton = (record) => {
    try {
      validateValue(record, 'レコード', { required: true });

      const status = record?.[FIELDS.STATUS]?.value;
      const zanasi = record?.[FIELDS.REMAINING_MATERIAL]?.value;
      const validStatuses = [
        STATUSES.WORK_DONE_CHECK_WAIT,
        STATUSES.CHECK_DONE_SHIP_WAIT,
        STATUSES.SHIPPED,
        STATUSES.INTERRUPTED
      ];

      if (zanasi !== KEYWORDS.STORAGE || !validStatuses.includes(status)) {
        return null;
      }

      const btn = createButton('保管材登録', '#97DB34', 'black', async (e) => {
        e.target.disabled = true;
        const rec = kintone.app.record.get().record;
        const url = await getStorageAppUrl(rec);
        if (url) {
          window.location.href = url;
        }
      });

      if (btn) btn.classList.add('button-full-width');
      return btn;
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'StorageButton');
      return null;
    }
  };

  // =================================================================
  // メイン処理
  // =================================================================

  /**
   * フローティングウィンドウを生成・表示するメイン関数
   */
  const showFloatWindow = (event) => {
    try {
      const record = event?.record || kintone.app.record.get().record;
      validateValue(record, 'レコード', { required: true });

      removeFloatWindow();

      const floatWindow = document.createElement('div');
      floatWindow.id = 'floatWindow';
      floatWindow.classList.add('float-window');

      const infoArea = createInfoArea(record);
      if (infoArea) floatWindow.appendChild(infoArea);

      const btnContainer = document.createElement('div');
      btnContainer.classList.add('button-container');

      const processBtn = createProcessButton(record);
      if (processBtn) btnContainer.appendChild(processBtn);

      const actionBtns = createActionButtons(record);
      if (actionBtns) btnContainer.appendChild(actionBtns);

      const storageBtn = createStorageButton(record);
      if (storageBtn) btnContainer.appendChild(storageBtn);

      floatWindow.appendChild(btnContainer);
      document.body.appendChild(floatWindow);
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'ShowFloatWindow');
    }
  };

  /**
   * 分納記録テーブルの行を編集不可にする
   */
  const disableBunnoTableRows = (event) => {
    try {
      const table = event.record?.[FIELDS.SPLIT_DELIVERY_TABLE]?.value;
      if (table) {
        table.forEach((row) => {
          const isShipped =
            row?.value?.[FIELDS.SPLIT_DELIVERY_STATUS]?.value === STATUSES.SHIPPED;
          Object.values(row.value || {}).forEach((field) => {
            field.disabled = !!isShipped;
          });
        });
      }
      return event;
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'DisableBunnoTable');
      return event;
    }
  };

  // =================================================================
  // イベントハンドラ登録
  // =================================================================

  // フローティングウィンドウ表示のイベント
  const eventsToShow = [
    'app.record.edit.show',
    'app.record.create.show',
    `app.record.edit.change.${FIELDS.STATUS}`,
    `app.record.edit.change.${FIELDS.OUTSOURCE_TYPE}`,
    `app.record.edit.change.${FIELDS.REMAINING_MATERIAL}`,
    `app.record.edit.change.${FIELDS.WORK_INFO_2}`,
    `app.record.edit.change.${FIELDS.SPLIT_DELIVERY_1}`,
    `app.record.edit.change.${FIELDS.SPLIT_DELIVERY_2}`,
    `app.record.edit.change.${FIELDS.FULL_DELIVERY_FLAG}`,
    `app.record.edit.change.${FIELDS.TOTAL_QUANTITY}`
  ];

  kintone.events.on(eventsToShow, showFloatWindow);

  // 分納テーブル制御のイベント
  const tableEvents = [
    'app.record.edit.show',
    'app.record.create.show',
    `app.record.edit.change.${FIELDS.SPLIT_DELIVERY_TABLE}`
  ];

  kintone.events.on(tableEvents, disableBunnoTableRows);

  // 詳細画面表示時の画面遷移制御
  kintone.events.on('app.record.detail.show', (event) => {
    try {
      // 詳細画面では常にフローティングウィンドウを削除
      removeFloatWindow();
      return event;
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'DetailShow');
      return event;
    }
  });

  // DOMロード完了時のクリーンアップ
  document.addEventListener('DOMContentLoaded', () => {
    try {
      removeFloatWindow();
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'DOMContentLoaded');
    }
  });
})();