(function() {
  'use strict';

  // --- 設定値 ---
  const TARGET_APP_ID = 236; // コピー先のアプリID
  const STATUS_TO_SHOW_BUTTON = '現在保管中'; // ボタンを表示するステータス
  const STATUS_AFTER_COPY = '作業中'; // コピー後のステータス
  const NEW_CHECKBOX_VALUE = '保管材からの作業'; // 追加するチェックボックスの値
  const COPY_FIELDS = [
    'L客先選択', 'カードNo', '社内鋼種', '溶解番号', '屑分類',
    '品名寸法', 'Lポール', 'L作業種別', 'L素材中分類', 'L素材小分類',
    '受入日', 'R形状選択', '保管材管理番号', '分納品残数',
    'L輸送方法', '納期'
  ];
  const MESSAGE_ELEMENT_ID = 'copy-info-message-013';

  let targetAppFormPromise = null;

  /**
   * コピー先アプリに存在するフィールド定義を取得する。
   * @returns {Promise<Map<string, any>>}
   */
  const fetchTargetAppForm = async () => {
    if (!targetAppFormPromise) {
      targetAppFormPromise = kintone.api(
        kintone.api.url('/k/v1/app/form/fields', true),
        'GET',
        { app: TARGET_APP_ID }
      ).then((resp) => {
        const fieldMap = new Map();
        const flatten = (properties) => {
          Object.keys(properties).forEach((code) => {
            const property = properties[code];
            if (property.type === 'SUBTABLE') {
              flatten(property.fields);
              return;
            }
            fieldMap.set(code, property);
          });
        };
        flatten(resp.properties);
        return fieldMap;
      }).catch((err) => {
        targetAppFormPromise = null;
        throw err;
      });
    }

    return targetAppFormPromise;
  };

  /**
   * ヘッダーにメッセージ表示用要素を用意する
   * @returns {HTMLDivElement|null}
   */
  const ensureMessageElement = () => {
    const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
    if (!headerMenuSpace) {
      return null;
    }

    let messageElement = document.getElementById(MESSAGE_ELEMENT_ID);
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.id = MESSAGE_ELEMENT_ID;
      messageElement.style.marginLeft = '12px';
      messageElement.style.fontSize = '12px';
      messageElement.style.lineHeight = '1.6';
      messageElement.style.maxWidth = '360px';
      headerMenuSpace.appendChild(messageElement);
    }
    messageElement.textContent = '';
    return messageElement;
  };

  /**
   * 値が空かどうかを判定する。
   * @param {*} value
   * @returns {boolean}
   */
  const isEmptyValue = (value) => {
    if (value === null || typeof value === 'undefined') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'string') {
      return value === '';
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  };

  const formatDateToYmd = (date) => {
    const year = date.getFullYear();
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const day = `0${date.getDate()}`.slice(-2);
    return `${year}-${month}-${day}`;
  };

  /**
   * 新規レコード画面が読み込まれるのを待ち、フィールド値を差し込む。
   * @param {Window|null} popupWindow
   * @param {Object} values
   * @returns {Promise<void>}
   */
  const fillCreateForm = (popupWindow, values) => {
    if (!popupWindow) {
      return Promise.resolve();
    }

    const start = Date.now();
    const timeout = 10000;
    const intervalMs = 200;

    return new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (!popupWindow || popupWindow.closed) {
          clearInterval(timer);
          reject(new Error('コピー先ウィンドウが閉じられました。'));
          return;
        }

        try {
          const popupKintone = popupWindow.kintone;
          if (popupKintone && popupKintone.app && popupKintone.app.record) {
            const current = popupKintone.app.record.get();
            if (current && current.record) {
              const updated = {
                record: current.record
              };

              Object.keys(values).forEach((code) => {
                if (updated.record[code]) {
                  updated.record[code].value = values[code].value;
                }
              });

              popupKintone.app.record.set(updated);
              clearInterval(timer);
              resolve();
              return;
            }
          }
        } catch (err) {
          console.warn('コピー先ウィンドウへの値差し込みに失敗しました:', err);
        }

        if (Date.now() - start > timeout) {
          clearInterval(timer);
          resolve();
        }
      }, intervalMs);
    });
  };

  /**
   * レコード詳細画面が表示されたときのイベント
   */
  kintone.events.on('app.record.detail.show', (event) => {
    const record = event.record;

    if (record['R保管材ステータス'].value !== STATUS_TO_SHOW_BUTTON) {
      return event;
    }

    if (document.getElementById('custom-copy-button-013')) {
      return event;
    }

    const button = document.createElement('button');
    button.id = 'custom-copy-button-013';
    button.innerText = '保管材利用案件登録';
    button.className = 'button013';

    const messageElement = ensureMessageElement();

    button.onclick = async () => {
      let popupWindow = null;
      try {
        button.disabled = true;
        if (messageElement) {
          messageElement.textContent = '';
          messageElement.style.color = '#d9534f';
        }

        const srcRecordId = kintone.app.record.getId();
        if (!srcRecordId) {
          throw new Error('レコード番号が取得できませんでした。');
        }

        popupWindow = window.open('about:blank', '_blank');
        if (!popupWindow || popupWindow.closed) {
          throw new Error('ポップアップウィンドウがブロックされています。ブラウザの設定をご確認ください。');
        }

        const fieldMap = await fetchTargetAppForm();
        const newRecord = {};
        const skippedFields = [];
        const copiedFields = [];

        COPY_FIELDS.forEach((fieldCode) => {
          if (!fieldMap.has(fieldCode)) {
            skippedFields.push(fieldCode);
            return;
          }
          const sourceField = record[fieldCode];
          if (!sourceField || typeof sourceField.value === 'undefined') {
            return;
          }
          newRecord[fieldCode] = { value: sourceField.value };
          copiedFields.push(fieldCode);
        });

        if (fieldMap.has('C作業付帯情報2')) {
          newRecord['C作業付帯情報2'] = { value: [NEW_CHECKBOX_VALUE] };
        } else {
          skippedFields.push('C作業付帯情報2');
        }

        if (fieldMap.has('L輸送方法') &&
            (!newRecord['L輸送方法'] || isEmptyValue(newRecord['L輸送方法'].value))) {
          newRecord['L輸送方法'] = { value: '選択してください' };
          if (!copiedFields.includes('L輸送方法')) {
            copiedFields.push('L輸送方法');
          }
        }

        if (fieldMap.has('納期') &&
            (!newRecord['納期'] || isEmptyValue(newRecord['納期'].value))) {
          newRecord['納期'] = { value: formatDateToYmd(new Date()) };
          if (!copiedFields.includes('納期')) {
            copiedFields.push('納期');
          }
        }

        if (record['D保管材種別'] && record['D保管材種別'].value === '(大同)スタート板専用ポール') {
          if (fieldMap.has('L作業種別')) {
            newRecord['L作業種別'] = { value: 'スタート板採取' };
          } else {
            skippedFields.push('L作業種別');
          }
          if (fieldMap.has('C分納')) {
            newRecord['C分納'] = { value: ['分納'] };
          } else {
            skippedFields.push('C分納');
          }
          if (fieldMap.has('R形状選択')) {
            newRecord['R形状選択'] = { value: 'ポール' };
          } else {
            skippedFields.push('R形状選択');
          }
        }

        const missingRequiredFields = [];
        fieldMap.forEach((property, code) => {
          if (!property.required) {
            return;
          }
          const copied = newRecord[code];
          if (copied && !isEmptyValue(copied.value)) {
            return;
          }
          if (typeof property.defaultValue !== 'undefined' && !isEmptyValue(property.defaultValue)) {
            return;
          }
          if (property.type === 'CREATOR' || property.type === 'CREATED_TIME' ||
            property.type === 'MODIFIER' || property.type === 'UPDATED_TIME') {
            return;
          }
          const label = property.label ? `${property.label}（${code}）` : code;
          missingRequiredFields.push(label);
        });

        if (messageElement) {
          const messages = [];
          if (skippedFields.length > 0) {
            messages.push(`コピー先に存在しないフィールド: ${skippedFields.join(', ')}`);
          }
          if (missingRequiredFields.length > 0) {
            messages.push(`コピー後も未入力の必須フィールド: ${missingRequiredFields.join(', ')}`);
          }
          if (messages.length > 0) {
            messageElement.textContent = messages.join(' / ');
            messageElement.style.color = '#d9534f';
          } else if (copiedFields.length > 0) {
            messageElement.textContent = `コピーしたフィールド: ${copiedFields.join(', ')}`;
            messageElement.style.color = '#0b8043';
          } else {
            messageElement.textContent = 'コピー対象のフィールドがありませんでした。';
            messageElement.style.color = '#f0ad4e';
          }
        }

        const targetUrl = `${window.location.origin}/k/${TARGET_APP_ID}/edit`;
        popupWindow.location.href = targetUrl;
        await fillCreateForm(popupWindow, newRecord);

        await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
          app: kintone.app.getId(),
          id: srcRecordId,
          record: {
            'R保管材ステータス': {
              value: STATUS_AFTER_COPY
            }
          }
        });

        location.reload();
      } catch (err) {
        if (popupWindow && !popupWindow.closed) {
          popupWindow.close();
        }
        console.error('コピー処理中にエラーが発生しました:', err);
        button.disabled = false;
        if (messageElement) {
          messageElement.textContent = `エラー: ${err.message || '不明なエラー'}`;
          messageElement.style.color = '#d9534f';
        }
        alert(`コピーに失敗しました。\nエラー: ${err.message || '不明なエラー'}\n詳細はコンソールをご確認ください。`);
      }
    };

    const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
    if (headerMenuSpace) {
      headerMenuSpace.appendChild(button);
    }

    return event;
  });
})();
