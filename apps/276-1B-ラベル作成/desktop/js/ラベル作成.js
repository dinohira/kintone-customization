/*
 * Copyright (c) 2024 Your Company Name
 *
 * This program is not free software.
 * You can't redistribute it and/or modify it.
 */

(function() {
  'use strict';

  // レコード詳細画面が表示されたときのイベント
  kintone.events.on('app.record.detail.show', function(event) {
    // ボタンが既に存在する場合は、重複して作成しないように処理を中断
    if (document.getElementById('create_label_csv_button') !== null) {
      return event;
    }

    const record = event.record;

    // ヘッダースペースを取得
    const headerSpace = kintone.app.record.getHeaderMenuSpaceElement();

    // 「ラベル作成」ボタンを作成
    const createButton = document.createElement('button');
    createButton.id = 'create_label_csv_button';
    createButton.innerText = 'ラベル作成';
    createButton.className = 'button013';
    createButton.style.marginLeft = '10px';

    // --- ▼▼▼ 追加部分 ▼▼▼ ---
    
    /**
     * すべての必須チェックボックスがチェックされているか検証する関数
     * @returns {boolean} すべてチェック済みならtrue、そうでなければfalse
     */
    const validateAllChecks = function() {
      const targetValue = '内容確認';

      // レコード上部のチェックボックスを確認
      const isChk1Checked = record.chk1.value.includes(targetValue);
      const isChk2Checked = record.chk2.value.includes(targetValue);
      const isChk3Checked = record.chk3.value.includes(targetValue);

      if (!isChk1Checked || !isChk2Checked || !isChk3Checked) {
        return false;
      }

      // テーブル内のチェックボックスをすべて確認
      const tableData = record.T切断明細.value;
      
      // everyは配列のすべての要素が条件を満たす場合にtrueを返す
      const areTableChecksOk = tableData.every(function(row) {
        const isChk4Checked = row.value.chk4.value.includes(targetValue);
        const isChk5Checked = row.value.chk5.value.includes(targetValue);
        // 1行でもチェック漏れがあれば、その時点でeveryはfalseを返す
        return isChk4Checked && isChk5Checked;
      });

      // テーブルのチェックがOKの場合のみtrueを返す
      return areTableChecksOk;
    };

    // 検証結果に基づいてボタンの状態を更新
    if (validateAllChecks()) {
      // すべてチェック済みの場合：ボタンを有効化
      createButton.disabled = false;
      createButton.removeAttribute('title');
    } else {
      // チェック漏れがある場合：ボタンを無効化し、マウスオーバーでメッセージを表示
      createButton.disabled = true;
      createButton.title = '項目を確認してチェックボタンを押してください';
    }
    
    // --- ▲▲▲ 追加部分 ▲▲▲ ---

    // ボタンがクリックされたときの処理
    createButton.onclick = function() {
      // 処理中にボタンを連打できないように無効化
      createButton.disabled = true;
      createButton.innerText = 'CSV作成中...';

      try {
        // 現在のレコード情報を取得 (クリック時点の最新情報を取得するため再取得)
        const currentRecord = kintone.app.record.get().record;

        // --- 1. CSVデータの生成 ---
        const cardNo = currentRecord['カードNo'].value || '';
        const meltNo = currentRecord['溶解番号'].value || '';
        const steelType = currentRecord['社内鋼種'].value || '';
        const tableData = currentRecord['T切断明細'].value;

        // まず、すべてのデータブロックをフラットなリストとして生成する
        const allBlocks = [];
        tableData.forEach(function(row) {
            const kouban = row.value['引当工番'].value || '';
            const start = parseInt(row.value['連番_開始'].value, 10);
            const end = parseInt(row.value['連番_終了'].value, 10);

            if (isNaN(start) || isNaN(end)) {
                return;
            }

            for (let i = start; i <= end; i++) {
                allBlocks.push([cardNo, meltNo, steelType, kouban, i]);
            }
        });

        if (allBlocks.length === 0) {
          alert('CSVに出力するデータがありません。テーブルの内容を確認してください。');
          createButton.disabled = false;
          createButton.innerText = 'ラベル作成';
          return;
        }

        const MAX_VERTICAL_BLOCKS = 5;
        const totalBlocks = allBlocks.length;
        const numCols = Math.ceil(totalBlocks / MAX_VERTICAL_BLOCKS);
        const numRows = (totalBlocks > 0) ? (Math.min(totalBlocks, MAX_VERTICAL_BLOCKS) * 5) : 0;

        const outputCsvRows = [];
        for (let i = 0; i < numRows; i++) {
            const rowData = [];
            const itemIndex = i % 5;
            const verticalBlockIndex = Math.floor(i / 5);

            for (let j = 0; j < numCols; j++) {
                const blockIndex = j * MAX_VERTICAL_BLOCKS + verticalBlockIndex;
                if (blockIndex < totalBlocks) {
                    rowData.push(allBlocks[blockIndex][itemIndex]);
                } else {
                    rowData.push('');
                }
            }
            outputCsvRows.push(rowData.join(','));
        }

        const csvString = outputCsvRows.join('\n');

        // --- 2. ファイルのアップロードとレコード更新 ---
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], { type: 'text/csv' });
        const formData = new FormData();
        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
        
        const fileName = `${cardNo}ラベル.csv`;
        formData.append('file', blob, fileName);

        const uploadPromise = new Promise(function(resolve, reject) {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', kintone.api.url('/k/v1/file', true));
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          xhr.onload = function() {
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(JSON.parse(xhr.responseText));
            }
          };
          xhr.onerror = function() {
            reject(xhr.statusText);
          };
          xhr.send(formData);
        });

        uploadPromise
          .then(function(resp) {
            const fileKey = resp.fileKey;
            const params = {
              app: kintone.app.getId(),
              id: event.recordId,
              record: {
                'ラベルファイル': { value: [{ fileKey: fileKey }] }
              }
            };
            return kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', params);
          })
          .then(function() {
            alert('ラベルファイルの作成と添付が完了しました。');
            location.reload();
          })
          .catch(function(error) {
            console.error(error);
            alert('エラーが発生しました。\n詳細はデベロッパーツールのコンソールを確認してください。');
            createButton.disabled = false;
            createButton.innerText = 'ラベル作成';
          });

      } catch (e) {
        console.error(e);
        alert('予期せぬエラーが発生しました。\n詳細はデベロッパーツールのコンソールを確認してください。');
        createButton.disabled = false;
        createButton.innerText = 'ラベル作成';
      }
    };

    // 作成したボタンをヘッダースペースに追加
    headerSpace.appendChild(createButton);

    return event;
  });
})();

