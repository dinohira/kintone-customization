(function () {
    'use strict';

    // =================================================================
    // 設定
    // =================================================================
    // コピー元アプリID
    const SOURCE_APP_ID = 225;
    // コピー先アプリID
    const DEST_APP_ID = 246;
    // レコードを紐付けるためのキーとなるフィールドコード
    const RECORD_KEY = '明細ID';

    // コピー対象のフィールド対応リスト {コピー元フィールドコード, コピー先フィールドコード}
    const COPY_MAP = [
        { from: '採用作業価格', to: '採用作業価格2' },
        { from: '総消耗品計算', to: '総消耗品計算2' },
        { from: '総輸送費計算', to: '総輸送費計算2' }
    ];

    // コピー元アプリのステータスに関する設定
    const SOURCE_STATUS_FIELD = 'R見積状態'; // ステータス管理フィールド
    const SOURCE_STATUS_BEFORE = '後見積作成中'; // 処理前のステータス
    const SOURCE_STATUS_AFTER = '後見積明細転記済'; // 処理後のステータス

    // コピー先アプリのステータスに関する設定
    const DEST_STATUS_FIELD = 'F後見積済'; // 更新するフィールド
    const DEST_STATUS_AFTER = '1'; // 設定する値

    // =================================================================
    // イベントハンドラ
    // =================================================================
    kintone.events.on('app.record.detail.show', function (event) {
        const record = event.record;

        // ボタンが既に存在する場合は何もしない
        if (document.getElementById('copy-to-dest-app-btn')) return;

        // R見積状態が「後見積作成中」でない場合はボタンを表示しない
        if (!record[SOURCE_STATUS_FIELD] || record[SOURCE_STATUS_FIELD].value !== SOURCE_STATUS_BEFORE) {
            return;
        }
        
        // ★改善点: kintone.app.record.getHeaderMenuSpaceElement() を使い、安定した要素取得を行う
        const headerSpace = kintone.app.record.getHeaderMenuSpaceElement();
        if (!headerSpace) {
            console.warn('ヘッダースペース要素が見つかりませんでした。');
            return;
        }

        // ボタンを作成
        const copyButton = document.createElement('button');
        copyButton.id = 'copy-to-dest-app-btn';
        copyButton.innerText = '後見積明細転記';
        // ★変更点: classをbutton013に変更
        copyButton.className = 'button013'; // 013.cssのスタイルを適用

        // ボタンクリック時の処理
        copyButton.onclick = async () => {
            copyButton.disabled = true;

            try {
                // ★改善点: イベントオブジェクトのレコードを利用するため、APIでの再取得は不要
                const srcRecord = event.record;
                const uniqueId = srcRecord[RECORD_KEY].value;

                // 採用作業価格が'0'の場合は処理を中断
                if (srcRecord['採用作業価格'] && srcRecord['採用作業価格'].value === '0') {
                    alert('「時間/面積選択」ラジオボタンが選択されていません。確認してください。');
                    copyButton.disabled = false;
                    return;
                }

                // --- 1. コピー先アプリで対象レコードを検索 ---
                const query = `${RECORD_KEY} = "${uniqueId}"`;
                const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                    app: DEST_APP_ID,
                    query: query
                });

                if (!resp.records || resp.records.length === 0) {
                    alert('コピー先に一致する明細IDのレコードが見つかりません。');
                    copyButton.disabled = false;
                    return;
                }
                
                if (resp.records.length > 1) {
                    // 念のため、ユニークであるはずのIDで複数件ヒットした場合の考慮
                    console.warn(`コピー先で明細ID「${uniqueId}」のレコードが複数件見つかりました。最初の1件を更新します。`);
                }

                const destRecord = resp.records[0];
                const destRecordId = destRecord.$id.value;

                // --- 2. コピー先レコードの更新データを作成 ---
                const updatePayload = {
                    app: DEST_APP_ID,
                    id: destRecordId,
                    record: {}
                };

                // マッピングに基づいて更新データを作成
                for (const map of COPY_MAP) {
                    // コピー元に値がある場合のみ更新対象に含める
                    if (srcRecord[map.from] && typeof srcRecord[map.from].value !== 'undefined') {
                        updatePayload.record[map.to] = { value: srcRecord[map.from].value };
                    }
                }
                // ステータスフィールドを更新
                updatePayload.record[DEST_STATUS_FIELD] = { value: DEST_STATUS_AFTER };

                // --- 3. コピー先レコードを更新 ---
                await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updatePayload);

                // --- 4. コピー元レコードのステータスを更新 ---
                await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                    app: SOURCE_APP_ID,
                    id: kintone.app.record.getId(),
                    record: {
                        [SOURCE_STATUS_FIELD]: { value: SOURCE_STATUS_AFTER }
                    }
                });

                // --- 5. 処理完了後、画面を遷移 ---
                alert('明細の転記が完了しました。');
                
                // コピー先のレコード詳細画面を新しいタブで開く
                const destRecordUrl = `/k/${DEST_APP_ID}/show#record=${destRecordId}`;
                window.open(destRecordUrl, '_blank');

                // 現在の画面をリロードしてステータスの変更を反映する
                location.reload();
                
                // ※ window.close() はブラウザ設定により動作しないことがあるため、リロードや別画面への遷移がより確実な挙動です。

            } catch (e) {
                // ★改善点: kintone APIエラーの場合、より詳細なメッセージを表示
                let errorMessage = '処理中にエラーが発生しました。';
                if (e.errors) {
                    errorMessage += '\n' + Object.values(e.errors).map(err => err.messages.join(', ')).join('\n');
                } else {
                    errorMessage += '\n' + (e.message || e);
                }
                alert(errorMessage);
                copyButton.disabled = false;
            }
        };

        // ボタンをヘッダースペースに設置
        headerSpace.appendChild(copyButton);
    });
})();
