/**
 * フロートウィンドウ（情報表示のみ）
 * - ボタン表示・R現況変更・プロセス管理は一切含まない
 * - 画面上に情報（現況/カードNo/顧客名/作業情報系）だけを表示
 *
 * 前提:
 * - 必要であれば SweetAlert2 を読み込んでください（なくても動作は継続し、alert/consoleへフォールバック）
 *   CDN: https://cdn.jsdelivr.net/npm/sweetalert2@11
 */

(function () {
  'use strict';

  // =================================================================
  // 設定・定数（最小限）
  // =================================================================

  const CONFIG = Object.freeze({
    ERROR_LOG_ENABLED: true
  });

  const ERROR_TYPES = Object.freeze({
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  });

  // 使用するフィールドコードのみ定義（環境に合わせて適宜調整してください）
  const FIELDS = Object.freeze({
    STATUS: 'R現況',
    CARD_NO: 'カードNo',
    CUSTOMER_NAME: '顧客名',
    WORK_INFO_1: 'C作業情報1',
    WORK_INFO_2: 'C作業情報2',
    IDENTIFY_INFO: 'C識別情報'
  });

  // =================================================================
  // 共通ユーティリティ
  // =================================================================

  const logError = (error, type, context) => {
    if (!CONFIG.ERROR_LOG_ENABLED) return;
    try {
      // eslint-disable-next-line no-console
      console.error(`[${context}] ${type}:`, {
        message: error?.message || String(error),
        stack: error?.stack,
        timestamp: new Date().toISOString()
      });
    } catch (_) {
      /* noop */
    }
  };

  const handleError = (error, type, context) => {
    logError(error, type, context);
    const msg = error?.message || '不明なエラーが発生しました。';
    if (typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function') {
      window.Swal.fire({ icon: 'error', title: 'エラー', text: msg });
    } else if (typeof alert === 'function') {
      alert(msg);
    }
  };

  const validateValue = (value, fieldName, options = {}) => {
    if (options.required && (value === undefined || value === null || value === '')) {
      throw new Error(`${fieldName}は必須です`);
    }
  };

  // =================================================================
  // UI生成（情報表示のみ）
  // =================================================================

  const removeFloatWindow = () => {
    try {
      const existing = document.getElementById('floatWindow');
      if (existing) existing.remove();
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'RemoveFloatWindow');
    }
  };

  const createInfoArea = (record) => {
    try {
      validateValue(record, 'レコード', { required: true });

      const infoDiv = document.createElement('div');
      infoDiv.classList.add('float-info');

      const rows = [
        [FIELDS.STATUS, '現況'],
        [FIELDS.CARD_NO, 'カード管理No'],
        [FIELDS.CUSTOMER_NAME, '顧客名']
      ];

      rows.forEach(([fieldCode, label]) => {
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
        wiLabel.textContent = '作業付与情報: ';
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

  const showFloatWindow = (event) => {
    try {
      const record = event?.record || (kintone?.app?.record?.get?.() || {}).record;
      validateValue(record, 'レコード', { required: true });

      removeFloatWindow();

      const floatWindow = document.createElement('div');
      floatWindow.id = 'floatWindow';
      floatWindow.classList.add('float-window');

      const infoArea = createInfoArea(record);
      if (infoArea) floatWindow.appendChild(infoArea);

      document.body.appendChild(floatWindow);
      return event;
    } catch (error) {
      handleError(error, ERROR_TYPES.UNKNOWN_ERROR, 'ShowFloatWindow');
      return event;
    }
  };

  // =================================================================
  // イベント登録（情報表示の更新のみ）
  // =================================================================

  const eventsToShow = [
    'app.record.edit.show',
    'app.record.create.show',
    `app.record.edit.change.${FIELDS.STATUS}`,
    `app.record.edit.change.${FIELDS.CARD_NO}`,
    `app.record.edit.change.${FIELDS.CUSTOMER_NAME}`,
    `app.record.edit.change.${FIELDS.WORK_INFO_1}`,
    `app.record.edit.change.${FIELDS.WORK_INFO_2}`,
    `app.record.edit.change.${FIELDS.IDENTIFY_INFO}`
  ];

  kintone.events.on(eventsToShow, showFloatWindow);

  // 詳細画面ではフロートを撤去
  kintone.events.on('app.record.detail.show', (event) => {
    removeFloatWindow();
    return event;
  });

  // DOMロード時のクリーンアップ
  document.addEventListener('DOMContentLoaded', () => {
    try { removeFloatWindow(); } catch (_) {}
  });
})();

