(function() {
  'use strict';

  // ----------------------------------------------------------------
  // ▼▼▼ 設定箇所 ▼▼▼
  // ----------------------------------------------------------------

  // ① 参照先アプリ（データを取得してくる側）のアプリID
  const APP_ID_DATA_SOURCE = 251;

  // ② 参照先アプリの検索条件に使うフィールドコード
  const QUERY_FIELD_CODE = '屑分類';

  // ③ 参照先アプリのテーブルのフィールドコード
  const TABLE_FIELD_CODE = 'T社内鋼種';

  // ④ 参照先アプリのテーブル内の、選択肢にしたい値が入っているフィールドコード
  const TABLE_COLUMN_CODE = '社内鋼種';

  // ⑤ 適用先アプリ（このJSを設定する側）の、処理のきっかけとなるフィールドコード
  const TRIGGER_FIELD_CODE = 'CC屑分類';

  // ⑥ 適用先アプリの、ドロップダウンを表示するスペース要素のID
  const SPACE_ELEMENT_ID = 'Dsyanaikousyu';

  // ⑦ 適用先アプリの、ドロップダウンで選択した値を保存するフィールドコード
  const TARGET_FIELD_CODE = '社内鋼種';

  // ----------------------------------------------------------------
  // ▲▲▲ 設定ここまで ▲▲▲
  // ----------------------------------------------------------------


  // 設定されたトリガーフィールドの変更イベントを監視
  const events = [
    `app.record.create.change.${TRIGGER_FIELD_CODE}`,
    `app.record.edit.change.${TRIGGER_FIELD_CODE}`
  ];

  kintone.events.on(events, (event) => {
    console.log(`「${TRIGGER_FIELD_CODE}」フィールドが変更されました。`);

    const record = event.record;
    const triggerValue = record[TRIGGER_FIELD_CODE].value;

    // スペース要素を取得
    const spaceElement = kintone.app.record.getSpaceElement(SPACE_ELEMENT_ID);
    if (!spaceElement) {
      console.error(`エラー: スペース要素 "${SPACE_ELEMENT_ID}" が見つかりません。`);
      return event;
    }

    // 処理開始前に、スペース内と対象フィールドを初期化
    spaceElement.innerHTML = '';
    record[TARGET_FIELD_CODE].value = '';

    // トリガーフィールドが空の場合は処理を終了
    if (!triggerValue) {
      return event;
    }

    // API通信とUI作成を非同期で実行
    (async () => {
      try {
        // kintone REST APIで参照先アプリから関連レコードを取得
        const escapedTriggerValue = triggerValue.replace(/"/g, '\\"');
        const params = {
          app: APP_ID_DATA_SOURCE,
          query: `${QUERY_FIELD_CODE} = "${escapedTriggerValue}" limit 1`,
          fields: [TABLE_FIELD_CODE]
        };
        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params);

        // レコードが見つからない、またはテーブルが空の場合の処理
        if (!resp.records || resp.records.length === 0) {
          spaceElement.innerText = '関連する詳細データが見つかりません。';
          return;
        }
        const tableData = resp.records[0][TABLE_FIELD_CODE].value;
        if (!tableData || tableData.length === 0) {
          spaceElement.innerText = '詳細データが登録されていません。';
          return;
        }

        // --- ▼▼▼ UI作成処理 ▼▼▼ ---
        const label = document.createElement('div');
        label.textContent = '社内鋼種選択';
        label.classList.add('kintoneplugin-label');
        label.style.fontWeight = 'normal'; // ←【追加】この行で文字を通常の太さにします

        const dropdown = document.createElement('select');
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = '--- 選択してください ---';
        dropdown.appendChild(defaultOption);

        tableData.forEach(row => {
          if (row.value && row.value[TABLE_COLUMN_CODE] && row.value[TABLE_COLUMN_CODE].value) {
            const option = document.createElement('option');
            const detailValue = row.value[TABLE_COLUMN_CODE].value;
            option.value = detailValue;
            option.text = detailValue;
            dropdown.appendChild(option);
          }
        });

        dropdown.addEventListener('change', (e) => {
          const currentRecord = kintone.app.record.get();
          currentRecord.record[TARGET_FIELD_CODE].value = e.target.value;
          kintone.app.record.set(currentRecord);
        });

        const selectOuter = document.createElement('div');
        selectOuter.classList.add('kintoneplugin-select-outer');
        const selectWrapper = document.createElement('div');
        selectWrapper.classList.add('kintoneplugin-select');

        selectWrapper.appendChild(dropdown);
        selectOuter.appendChild(selectWrapper);

        spaceElement.appendChild(label);
        spaceElement.appendChild(selectOuter);
        // --- ▲▲▲ UI作成処理 ▲▲▲ ---

      } catch (error) {
        spaceElement.innerText = 'データ取得中にエラーが発生しました。';
        console.error(`アプリ「${APP_ID_DATA_SOURCE}」からのデータ取得に失敗しました。`, error);
      }
    })();

    return event;
  });

})();

