// このカスタマイズではSweetAlert2ライブラリを使用します。
// kintoneの「JavaScript / CSSでカスタマイズ」設定で、
// 以下のURLをこのファイルより「先」に追加してください。
// https://cdn.jsdelivr.net/npm/sweetalert2@11

// 即時関数で全体を囲み、グローバルスコープの汚染を防ぎます。
(function() {
    'use strict';

    // --- 設定値 ---
    // kintoneのフィールド設定と完全に一致しているかご確認ください。
    const CONFIG = {
        SOURCE_APP_ID: 225,
        TARGET_APP_ID: 236,
        FIELDS: {
            STATUS: 'R見積状態',
            ESTIMATE_TYPE: 'R見積種類',
            ATTACHMENT: '見積書',
            ESTIMATE_ID: '見積ID',
        },
        BUTTON_LABELS: {
            SUBMIT: '→　見積提出',
            REJECT: '→　辞退',
            ACCEPT: '→　受注済/案件登録',
            LOST: '→　失注',
        },
        STATUS: {
            CREATING: '受付・見積作成中',
            SUBMITTED: '見積提出済',
            ACCEPTED: '受注',
            REJECTED: '辞退',
            LOST: '失注'
        },
        DATE_FIELDS_TO_FORMAT: ['納期', '受入日', '登録日'],
        TARGET_ESTIMATE_TYPES: ['先見積(大同以外)'],
        TARGET_STATUSES_FOR_BUTTONS: ['受付・見積作成中', '見積提出済'],
        FIELDS_TO_COPY: [
            '登録日', '重量', '受入日', '納期', 'R納期種別', 'カードNo', '数量',
            '図番その他', '鋼種', 'R形状選択', '品名寸法', 'C作業付帯情報1',
            'R残材', 'R切断屑', '見積ID', 'R見積種類', 'L客先選択',
            'L作業種別', 'L素材中分類', 'L輸送方法'
        ]
    };

    /**
     * レコードのステータスを更新します。
     * @param {string|number} recordId - レコードID
     * @param {string} newStatus - 新しいステータス
     * @returns {Promise}
     */
    const updateRecordStatus = (recordId, newStatus) => {
        return kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
            app: CONFIG.SOURCE_APP_ID,
            id: recordId,
            record: {
                [CONFIG.FIELDS.STATUS]: { value: newStatus }
            }
        });
    };

    /**
     * レコードを別アプリにコピー（または更新）します。
     * @param {object} sourceRecord - コピー元のレコードオブジェクト
     */
    const copyRecordToTargetApp = async (sourceRecord) => {
        const estimateID = sourceRecord[CONFIG.FIELDS.ESTIMATE_ID]?.value;
        if (!estimateID) {
            Swal.fire({
                icon: 'warning',
                title: 'コピー処理スキップ',
                text: '見積IDが空のため、案件アプリへのコピーはスキップされました。',
            });
            return;
        }

        try {
            const query = `${CONFIG.FIELDS.ESTIMATE_ID} = "${estimateID}"`;
            const getRes = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.TARGET_APP_ID,
                query: query
            });

            const recordToUpsert = {};
            CONFIG.FIELDS_TO_COPY.forEach(fieldCode => {
                if (sourceRecord[fieldCode]?.value != null) {
                    if (CONFIG.DATE_FIELDS_TO_FORMAT.includes(fieldCode)) {
                        const dateValue = sourceRecord[fieldCode].value;
                        if (dateValue) {
                           recordToUpsert[fieldCode] = {
                               value: dateValue.split('T')[0]
                           };
                        }
                    } else {
                        recordToUpsert[fieldCode] = sourceRecord[fieldCode];
                    }
                }
            });

            let targetRecordId;
            if (getRes.records.length > 0) {
                targetRecordId = getRes.records[0].$id.value;
                await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                    app: CONFIG.TARGET_APP_ID,
                    id: targetRecordId,
                    record: recordToUpsert
                });
            } else {
                const postRes = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
                    app: CONFIG.TARGET_APP_ID,
                    record: recordToUpsert
                });
                targetRecordId = postRes.id;
            }

            if (targetRecordId) {
                window.open(`/k/${CONFIG.TARGET_APP_ID}/show#record=${targetRecordId}`, '_blank');
            }
        } catch (error) {
            const errorDetails = JSON.stringify(error.errors, null, 2);
            console.error('レコードコピーエラー詳細:', errorDetails);
            Swal.fire({
                icon: 'error',
                title: 'レコードコピー失敗',
                html: `レコードのコピーに失敗しました。<br>詳細はコンソールを確認してください。<pre style="text-align: left; background-color: #f3f3f3; padding: 1em;">${errorDetails}</pre>`,
            });
        }
    };

    // --- メイン処理 ---
    kintone.events.on('app.record.detail.show', (event) => {
        const { record } = event;
        const currentStatus = record[CONFIG.FIELDS.STATUS].value;
        const estimateType = record[CONFIG.FIELDS.ESTIMATE_TYPE].value;

        // --- 条件チェック ---
        if (!CONFIG.TARGET_ESTIMATE_TYPES.includes(estimateType)) {
            return event;
        }
        if (document.getElementById('custom-submit-button')) {
            return event;
        }
        if (!CONFIG.TARGET_STATUSES_FOR_BUTTONS.includes(currentStatus)) {
            return event;
        }

        // --- ボタン作成 ---
        const buttonSubmit = document.createElement('button');
        buttonSubmit.id = 'custom-submit-button';
        buttonSubmit.className = 'button013';

        const buttonReject = document.createElement('button');
        buttonReject.id = 'custom-reject-button';
        buttonReject.className = 'button013';

        // --- ボタンの状態設定 ---
        if (currentStatus === CONFIG.STATUS.CREATING) {
            buttonSubmit.textContent = CONFIG.BUTTON_LABELS.SUBMIT;
            buttonReject.textContent = CONFIG.BUTTON_LABELS.REJECT;
            buttonSubmit.disabled = record[CONFIG.FIELDS.ATTACHMENT].value.length === 0;
            buttonReject.classList.add('button013-monochrome');
        } else if (currentStatus === CONFIG.STATUS.SUBMITTED) {
            buttonSubmit.textContent = CONFIG.BUTTON_LABELS.ACCEPT;
            buttonReject.textContent = CONFIG.BUTTON_LABELS.LOST;
            buttonReject.classList.add('button013-monochrome');
        }

        // --- クリックイベント設定 ---
        const handleProcess = async (getNewStatusFunc, shouldCopy) => {
            try {
                buttonSubmit.disabled = true;
                buttonReject.disabled = true;

                Swal.fire({
                    title: '処理中...',
                    text: 'ステータスを更新しています。',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const newStatus = getNewStatusFunc(currentStatus);
                await updateRecordStatus(event.recordId, newStatus);

                if (shouldCopy && newStatus === CONFIG.STATUS.ACCEPTED) {
                    await copyRecordToTargetApp(record);
                }

                // ★修正1: 更新成功後にメッセージを表示し、ページをリロード
                Swal.fire({
                    icon: 'success',
                    title: '更新しました',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    location.reload();
                });

            } catch (error) {
                console.error('処理中にエラーが発生しました:', error);
                Swal.fire({
                    icon: 'error',
                    title: '処理エラー',
                    text: 'エラーが発生しました。詳細はコンソールを確認してください。'
                });
                buttonSubmit.disabled = false;
                buttonReject.disabled = false;
            }
        };

        buttonSubmit.onclick = () => handleProcess(
            status => (status === CONFIG.STATUS.CREATING ? CONFIG.STATUS.SUBMITTED : CONFIG.STATUS.ACCEPTED),
            true
        );

        buttonReject.onclick = () => handleProcess(
            status => (status === CONFIG.STATUS.CREATING ? CONFIG.STATUS.REJECTED : CONFIG.STATUS.LOST),
            false
        );

        // --- ボタン配置 ---
        const headerSpace = kintone.app.record.getHeaderMenuSpaceElement();
        const buttonContainer = document.createElement('div');

        // ★修正2: ボタンを横一列に配置し、間隔を空ける
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '50px'; // ボタン間のスペース
        buttonContainer.style.alignItems = 'center';

        buttonContainer.appendChild(buttonSubmit);
        buttonContainer.appendChild(buttonReject);
        headerSpace.appendChild(buttonContainer);

        return event;
    });
})();

