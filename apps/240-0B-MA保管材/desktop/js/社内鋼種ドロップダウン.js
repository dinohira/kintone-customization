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

  // ⑤ 適用先アプリ（このJSを設定する側）の、処理のきっかけとなるフィールドコード（新規ルックアップ）
  const TRIGGER_FIELD_CODE = 'L屑分類';

  // ⑥ 適用先アプリの、ドロップダウンを表示するスペース要素のID
  const SPACE_ELEMENT_ID = 'Dsyanaikousyu';

  // ⑦ 適用先アプリの、ドロップダウンで選択した値を保存するフィールドコード（既存フィールド）
  const TARGET_FIELD_CODE = '社内鋼種';
  
  // ⑧ 編集不可にする既存のフィールドコード
  const READONLY_FIELD_CODES = ['屑分類', '社内鋼種'];

  // ----------------------------------------------------------------
  // ▲▲▲ 設定ここまで ▲▲▲
  // ----------------------------------------------------------------

  // 既存フィールドを編集不可にする
  const showEvents = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show'
  ];

  let lastTriggerValue = null;
  let pollInterval = null;

  kintone.events.on(showEvents, (event) => {
    READONLY_FIELD_CODES.forEach(fieldCode => {
      if (event.record[fieldCode]) {
        event.record[fieldCode].disabled = true;
      }
    });

    if (event.type !== 'app.record.detail.show') {
       const initialVal = event.record[TRIGGER_FIELD_CODE] && event.record[TRIGGER_FIELD_CODE].value ? event.record[TRIGGER_FIELD_CODE].value : null;
       lastTriggerValue = initialVal;
       
       if (initialVal) {
         renderDropdown(initialVal, event.record[TARGET_FIELD_CODE].value);
       }

       // 変更イベントがルックアップの「取得」「選択」で発火しないためのポーリング監視
       if (pollInterval) clearInterval(pollInterval);
       pollInterval = setInterval(() => {
         const currentRecord = kintone.app.record.get();
         if (!currentRecord || !currentRecord.record) return;
         
         const currentTriggerValue = currentRecord.record[TRIGGER_FIELD_CODE].value;
         if (currentTriggerValue !== lastTriggerValue) {
           console.log(`「${TRIGGER_FIELD_CODE}」フィールドが変更されました。(${lastTriggerValue} -> ${currentTriggerValue})`);
           lastTriggerValue = currentTriggerValue;
           
           const spaceElement = kintone.app.record.getSpaceElement(SPACE_ELEMENT_ID);
           if (spaceElement) spaceElement.innerHTML = '';
           currentRecord.record[TARGET_FIELD_CODE].value = '';
           kintone.app.record.set(currentRecord);

           if (currentTriggerValue) {
             renderDropdown(currentTriggerValue, '');
           }
         }
       }, 500);
    }

    return event;
  });

  // クリーンアップ
  const teardownEvents = [
    'app.record.create.submit', 'app.record.create.submit.success', 'app.record.create.cancel',
    'app.record.edit.submit', 'app.record.edit.submit.success', 'app.record.edit.cancel'
  ];
  kintone.events.on(teardownEvents, (event) => {
    if (pollInterval) clearInterval(pollInterval);
    return event;
  });

  function renderDropdown(triggerValue, initialTargetValue) {
    const spaceElement = kintone.app.record.getSpaceElement(SPACE_ELEMENT_ID);
    if (!spaceElement) return;
    
    // API通信とUI作成を非同期で実行
    (async () => {
      try {
        // kintone REST APIで参照先アプリから関連レコードを取得
        const escapedTriggerValue = triggerValue.replace(/"/g, '\\"');
        const params = {
          app: APP_ID_DATA_SOURCE,
          query: `${QUERY_FIELD_CODE} = "${escapedTriggerValue}" limit 1`,
          fields: ['$id', TABLE_FIELD_CODE]
        };
        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params);

        // スペース内をクリア
        spaceElement.innerHTML = '';

        // レコードが見つからない、またはテーブルが空の場合の処理
        if (!resp.records || resp.records.length === 0) {
          spaceElement.innerText = '関連する詳細データが見つかりません。';
          return;
        }
        const recordId = resp.records[0].$id.value;
        const tableData = resp.records[0][TABLE_FIELD_CODE].value;
        if (!tableData || tableData.length === 0) {
          spaceElement.innerText = '詳細データが登録されていません。';
          return;
        }

        // --- ▼▼▼ UI作成処理 ▼▼▼ ---
        // スタイルの注入
        const styleId = 'syanaikousyu-btn-styles';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            .cascade-action-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border: 1px solid #e3e7e8;
                border-radius: 4px;
                background-color: #fff;
                color: #666;
                cursor: pointer;
                flex-shrink: 0;
                transition: background-color 0.2s, border-color 0.2s, color 0.2s;
                padding: 0;
                line-height: 1;
                margin-left: 6px;
                vertical-align: top;
            }
            .cascade-action-btn:hover {
                background-color: #f0f4f8;
                border-color: #b0b6b8;
                color: #333;
            }
            .cascade-action-btn .material-symbols-outlined {
                font-size: 20px;
            }
            .cascade-action-btn.cascade-btn-reset:hover {
                background-color: #fff3e0;
                border-color: #ff9800;
                color: #e65100;
            }
            .cascade-action-btn.cascade-btn-new:hover {
                background-color: #e3f2fd;
                border-color: #2196f3;
                color: #0d47a1;
            }
            .syanaikousyu-container {
                display: flex;
                align-items: center;
            }
            .syanaikousyu-space-root {
                margin-top: 8px;
            }
            .syanaikousyu-container .kintoneplugin-select-outer {
                height: 32px;
            }
            .syanaikousyu-container .kintoneplugin-select {
                height: 32px;
                min-height: 32px;
            }
            .syanaikousyu-container .kintoneplugin-select select {
                height: 30px;
                padding: 0 8px;
                font-size: 14px;
            }
          `;
          document.head.appendChild(style);
        }

        // スペース要素のルートラッパー（上部マージンで被りを防止）
        const spaceRoot = document.createElement('div');
        spaceRoot.className = 'syanaikousyu-space-root';

        const label = document.createElement('div');
        label.textContent = '社内鋼種選択';
        label.classList.add('kintoneplugin-label');
        label.style.fontWeight = 'normal';
        label.style.marginBottom = '4px';

        const dropdown = document.createElement('select');
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = '--- 選択してください ---';
        dropdown.appendChild(defaultOption);

        let hasMatchedInitialValue = false;

        tableData.forEach(row => {
          if (row.value && row.value[TABLE_COLUMN_CODE] && row.value[TABLE_COLUMN_CODE].value) {
            const option = document.createElement('option');
            const detailValue = row.value[TABLE_COLUMN_CODE].value;
            option.value = detailValue;
            option.text = detailValue;
            if (initialTargetValue === detailValue) {
                option.selected = true;
                hasMatchedInitialValue = true;
            }
            dropdown.appendChild(option);
          }
        });

        if (initialTargetValue && !hasMatchedInitialValue) {
            const legacyOption = document.createElement('option');
            legacyOption.value = initialTargetValue;
            legacyOption.text = initialTargetValue + " (設定外)";
            legacyOption.selected = true;
            dropdown.appendChild(legacyOption);
        }

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

        const container = document.createElement('div');
        container.className = 'syanaikousyu-container';
        container.appendChild(selectOuter);

        // 内容クリアボタン
        const resetBtn = document.createElement('button');
        resetBtn.className = 'cascade-action-btn cascade-btn-reset';
        resetBtn.title = '選択をリセット';
        resetBtn.type = 'button';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">clear_all</span>';
        resetBtn.onclick = (e) => {
            e.preventDefault();
            const rec = kintone.app.record.get();
            rec.record[TRIGGER_FIELD_CODE].value = '';
            READONLY_FIELD_CODES.forEach(code => {
               if (rec.record[code]) rec.record[code].value = '';
            });
            if (rec.record[TARGET_FIELD_CODE]) rec.record[TARGET_FIELD_CODE].value = '';
            kintone.app.record.set(rec);
            
            spaceElement.innerHTML = ''; // UIクリア
            lastTriggerValue = ''; // ポーリング状態もリセット
        };

        // 詳細編集ボタン（新規追加と同じアイコンだが、既存レコードを編集モードで開く）
        const newBtn = document.createElement('button');
        newBtn.className = 'cascade-action-btn cascade-btn-new';
        newBtn.title = '詳細編集';
        newBtn.type = 'button';
        newBtn.innerHTML = '<span class="material-symbols-outlined">new_window</span>';
        newBtn.onclick = (e) => {
            e.preventDefault();
            const rec = kintone.app.record.get();
            const currentTrigger = rec.record[TRIGGER_FIELD_CODE].value || '';
            const dai = rec.record['素材大分類_屑選択用'] ? rec.record['素材大分類_屑選択用'].value : '';
            const chu = rec.record['素材中分類_屑選択用'] ? rec.record['素材中分類_屑選択用'].value : '';
            
            if (!currentTrigger) return; // 値が空の場合は何もしない

            const urlParams = {};
            if (dai) urlParams['L素材大分類'] = { value: dai };
            if (chu) urlParams['素材中分類'] = { value: chu };

            // 既存レコードの編集画面を開くURLを生成（例: /k/251/show?record=123&mode=edit）
            let url = `/k/${APP_ID_DATA_SOURCE}/show?record=${recordId}&mode=edit`;
            if (Object.keys(urlParams).length > 0) {
                url += `&initialValues=${encodeURIComponent(JSON.stringify(urlParams))}`;
            }
            window.open(url, '_blank');
        };

        container.appendChild(resetBtn);
        container.appendChild(newBtn);

        spaceRoot.appendChild(label);
        spaceRoot.appendChild(container);
        spaceElement.appendChild(spaceRoot);
        // --- ▲▲▲ UI作成処理 ▲▲▲ ---

      } catch (error) {
        spaceElement.innerText = 'データ取得中にエラーが発生しました。';
        console.error(`アプリ「${APP_ID_DATA_SOURCE}」からのデータ取得に失敗しました。`, error);
      }
    })();
  }

})();
