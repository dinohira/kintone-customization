/**
 * @license
 * Copyright 2025 (c) <Your Name or Company>. All Rights Reserved.
 *
 * kintone アプリのレコード詳細画面にボタンを設置し、
 * 連携する別アプリのレコードを作成・更新するカスタマイズです。
 */
(function() {
    'use strict';

    // =================================================================
    // 設定項目
    // アプリIDやフィールドコードなど、変更の可能性がある値をここで一元管理します。
    // =================================================================
    const CONFIG = {
        // 連携先アプリ（作業ログアプリなど）
        TARGET_APP: {
            ID: 241, // 連携先のアプリID
            FIELD_CODE: {
                LOOKUP_KEY: 'L案件ID',    // 案件IDを格納するルックアップまたは文字列フィールド
                UPDATE_TARGET: 'R現況' // 更新対象のフィールド
            }
        },
        // このカスタマイズを適用するアプリ（案件管理アプリなど）
        SOURCE_APP: {
            // 現在のアプリIDはkintone.app.getId()で自動取得するため不要
            FIELD_CODE: {
                LOOKUP_SOURCE: '案件ID',      // 連携キーとなる案件IDフィールド
                STATUS: 'R作業登録状態',    // ボタンの表示名や処理の条件に使うステータスフィールド
                CONDITION: 'R素材受入'     // 連携先に渡す値の条件分岐に使うフィールド
            }
        }
    };

    /**
     * ボタンの表示テキストを決定します。
     * @param {object} record - kintoneのレコードオブジェクト
     * @returns {string} ボタンに表示するテキスト
     */
    function getButtonText(record) {
        const status = record[CONFIG.SOURCE_APP.FIELD_CODE.STATUS].value;
        return status === '作業登録済' ? '→ 情報更新' : '→ 作業登録';
    }

    /**
     * 連携先アプリのレコードを更新または作成します（Upsert処理）。
     * @param {string} ankenId - 検索キーとなる案件ID
     * @param {object} sourceRecord - 操作の元となるレコードオブジェクト
     * @returns {Promise<string>} 作成/更新されたレコードのID
     */
    async function upsertTargetRecord(ankenId, sourceRecord) {
        // 1. 連携先アプリから案件IDでレコードを検索
        const query = `${CONFIG.TARGET_APP.FIELD_CODE.LOOKUP_KEY} = "${ankenId}"`;
        const getResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: CONFIG.TARGET_APP.ID,
            query: query
        });

        // 2. 連携先に渡す値を決定
        const genkyoValue = sourceRecord[CONFIG.SOURCE_APP.FIELD_CODE.CONDITION].value === '未受入' ? '未受入 →' : '受入済 →';
        const recordPayload = {
            [CONFIG.TARGET_APP.FIELD_CODE.LOOKUP_KEY]: { value: ankenId },
            [CONFIG.TARGET_APP.FIELD_CODE.UPDATE_TARGET]: { value: genkyoValue }
        };

        if (getResp.records.length > 0) {
            // 3a. レコードが存在する場合：更新処理
            const targetRecord = getResp.records[0];
            const updatePayload = {
                app: CONFIG.TARGET_APP.ID,
                id: targetRecord.$id.value,
                record: recordPayload
            };
            await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updatePayload);
            return targetRecord.$id.value; // 更新したレコードのIDを返す
        } else {
            // 3b. レコードが存在しない場合：作成処理
            const createPayload = {
                app: CONFIG.TARGET_APP.ID,
                record: recordPayload
            };
            const createResp = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', createPayload);
            return createResp.id; // 作成したレコードのIDを返す
        }
    }

    /**
     * 操作元のレコードのステータスを「作業登録済」に更新します。
     * @param {string} sourceRecordId - 操作元レコードのID
     */
    async function updateSourceRecordStatus(sourceRecordId) {
        const payload = {
            app: kintone.app.getId(), // 現在のアプリIDを動的に取得
            id: sourceRecordId,
            record: {
                [CONFIG.SOURCE_APP.FIELD_CODE.STATUS]: { value: '作業登録済' }
            }
        };
        await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', payload);
    }


    // =================================================================
    // メイン処理：レコード詳細画面が表示されたときのイベント
    // =================================================================
    kintone.events.on('app.record.detail.show', function(event) {
        const record = event.record;

        // 【改善点1】ボタン設置には公式APIを使用し、将来のkintoneアップデートに対応
        const headerSpace = kintone.app.record.getHeaderMenuSpaceElement();
        if (!headerSpace) {
            console.warn('ヘッダースペースの取得に失敗しました。');
            return;
        }

        // 画面リロード時にボタンが重複しないように、既存のボタンがあれば削除
        const oldButton = document.getElementById('my-custom-process-button');
        if (oldButton) {
            oldButton.remove();
        }

        // ボタン要素を作成
        const button = document.createElement('button');
        button.id = 'my-custom-process-button';
        // ★修正点：クラス名を button013 に変更
        button.className = 'button013';
        button.innerText = getButtonText(record);
        headerSpace.appendChild(button);

        // ボタンクリック時の処理
        button.onclick = async () => {
            const ankenId = record[CONFIG.SOURCE_APP.FIELD_CODE.LOOKUP_SOURCE].value;
            if (!ankenId) {
                alert('案件IDが設定されていません。');
                return;
            }

            // 【改善点2】ユーザーへのフィードバックを強化
            // 処理中はボタンを無効化し、二重クリックを防止
            button.disabled = true;
            button.innerText = '処理中...';

            try {
                // 処理1：連携先アプリのレコードを更新または作成
                const targetRecordId = await upsertTargetRecord(ankenId, record);

                // 処理2：このアプリのレコードのステータスを更新
                await updateSourceRecordStatus(record.$id.value);

                // 処理3：完了後、連携先のレコードを新しいタブで開く
                const newTabURL = `/k/${CONFIG.TARGET_APP.ID}/show#record=${targetRecordId}`;
                window.open(newTabURL, '_blank');

                // 処理成功をユーザーに通知し、画面をリロードして変更を反映
                alert('処理が完了しました。画面を更新します。');
                location.reload();

            } catch (error) {
                console.error('処理中にエラーが発生しました:', error);
                alert('エラーが発生しました。システム管理者にご連絡ください。');
                
                // エラー発生時はボタンの状態を元に戻す
                button.disabled = false;
                button.innerText = getButtonText(record);
            }
        };
    });
})();
