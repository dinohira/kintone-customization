(function() {
  'use strict';

  // --- 設定値 ---
  // 定数をコードの冒頭にまとめることで、管理しやすくなります。
  const TARGET_APP_ID = 236; // コピー先のアプリID
  const STATUS_TO_SHOW_BUTTON = '現在保管中'; // ボタンを表示するステータス
  const STATUS_AFTER_COPY = '作業中'; // コピー後のステータス
  const NEW_CHECKBOX_VALUE = '保管材からの作業'; // 追加するチェックボックスの値

  /**
   * レコード詳細画面が表示されたときのイベント
   */
  kintone.events.on('app.record.detail.show', (event) => {
    const record = event.record;

    // ステータスが「現在保管中」でない場合は、何もせずに処理を終了します。
    if (record['R保管材ステータス'].value !== STATUS_TO_SHOW_BUTTON) {
      return event;
    }

    // ボタンが既に存在する場合は、二重追加を防ぐために処理を終了します。
    if (document.getElementById('custom-copy-button-013')) {
      return event;
    }

    // ボタン要素を作成します。
    const button = document.createElement('button');
    button.id = 'custom-copy-button-013';
    button.innerText = '保管材利用案件登録';
    // ご要望に応じてクラス名を 'button013' に変更しました。
    button.className = 'button013';

    // ボタンクリック時の処理を定義します。
    button.onclick = async () => {
      try {
        // 処理中にボタンが再度押されるのを防ぐために、ボタンを無効化します。
        button.disabled = true;

        const srcRecordId = kintone.app.record.getId();
        if (!srcRecordId) {
          throw new Error('レコード番号が取得できませんでした。');
        }

        // --- コピーするレコードデータの作成 ---
        const newRecord = {};
        // #動作・条件追加1: "分納品残数"をコピー対象に追加
        const copyFields = [
          'L客先選択', 'カードNo', '社内鋼種', '溶解番号', '屑分類',
          '品名寸法', 'Lポール', 'L作業種別', 'L素材中分類', 'L素材小分類',
          '受入日', 'R形状選択', '保管材管理番号', '分納品残数'
        ];

        copyFields.forEach(fieldCode => {
          // フィールドが存在し、かつ値がある場合のみコピー対象とします。
          if (record[fieldCode] && typeof record[fieldCode].value !== 'undefined') {
            newRecord[fieldCode] = { value: record[fieldCode].value };
          }
        });

        // チェックボックスに固定値を追加します。
        newRecord['C作業付帯情報2'] = { value: [NEW_CHECKBOX_VALUE] };

        // #動作・条件追加2: 特定の条件でコピー先の値を上書きする
        if (record['D保管材種別'] && record['D保管材種別'].value === '(大同)スタート板専用ポール') {
          // 1. "L作業種別"の値を'スタート板採取'に設定
          newRecord['L作業種別'] = { value: 'スタート板採取' };
          // 2. チェックボックス"C分納"の'分納'にチェック
          newRecord['C分納'] = { value: ['分納'] };
          // 3. ラジオボタン"R形状選択"の値を'ポール'に設定
          newRecord['R形状選択'] = { value: 'ポール' };
        }

        // --- コピー先アプリへのレコード登録 ---
        const createResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
          app: TARGET_APP_ID,
          record: newRecord
        });
        const createdRecordId = createResp.id;

        // --- コピー元レコードのステータス更新 ---
        // エラー報告に基づき、プロセス管理が無効なアプリでも動作するよう、
        // 通常のレコード更新APIでラジオボタンフィールドの値を直接更新します。
        await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
          app: kintone.app.getId(),
          id: srcRecordId,
          record: {
            'R保管材ステータス': {
              value: STATUS_AFTER_COPY
            }
          }
        });

        // --- 画面遷移 ---
        // 新しいタブでコピー先レコードの編集画面を開きます。
        const recordUrl = `/k/${TARGET_APP_ID}/show#record=${createdRecordId}&mode=edit`;
        window.open(recordUrl, '_blank');
        
        // 元の画面をリロードして、ステータスの変更を反映させます。
        location.reload();

      } catch (err) {
        console.error('コピー処理中にエラーが発生しました:', err);
        // エラーが発生した場合、ボタンを再度有効化します。
        button.disabled = false;
        // alertはユーザーの操作を妨げるため、より詳細なエラーメッセージを推奨します。
        // ここでは元の実装を踏襲しますが、kintoneの通知機能なども検討できます。
        alert(`コピーに失敗しました。\nエラー: ${err.message || '不明なエラー'}\n詳細はコンソールをご確認ください。`);
      }
    };

    // kintoneのヘッダーメニューにボタンを配置します。
    // getElementsByClassNameよりもkintoneのUI変更に強い公式APIです。
    const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
    if (headerMenuSpace) {
      headerMenuSpace.appendChild(button);
    }

    return event;
  });

})();
