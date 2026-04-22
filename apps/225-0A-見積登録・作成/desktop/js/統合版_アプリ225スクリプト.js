/**
 * =========================================================
 * 統合版_アプリ225スクリプト.js
 * 複数の機能を1ファイルに統合
 * =========================================================
 */

// =========================================================
// 機能: 案件登録.js
// =========================================================
// このカスタマイズではSweetAlert2ライブラリを使用します。
// kintoneの「JavaScript / CSSでカスタマイズ」設定で、
// 以下のURLをこのファイルより「先」に追加してください。
// https://cdn.jsdelivr.net/npm/sweetalert2@11

// 即時関数で全体を囲み、グローバルスコープの汚染を防ぎます。
(function() {
    'use strict';

    const hasSwal = () =>
        typeof Swal !== 'undefined' && Swal && typeof Swal.fire === 'function';

    const showLoading = (title = '処理中...', text = 'ステータスを更新しています') => {
        if (hasSwal()) {
            Swal.fire({
                title,
                text,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }
    };

    const showSuccessToast = async (title = '更新しました') => {
        if (hasSwal()) {
            await Swal.fire({
                icon: 'success',
                title,
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            alert(title);
        }
    };

    const showWarn = async (title, text) => {
        if (hasSwal()) {
            await Swal.fire({
                icon: 'warning',
                title,
                text
            });
        } else {
            alert([title, text].filter(Boolean).join('\n'));
        }
    };

    const showErrorDialog = async (title, htmlOrText) => {
        if (hasSwal()) {
            await Swal.fire({
                icon: 'error',
                title,
                html: htmlOrText
            });
        } else {
            const plain =
                typeof htmlOrText === 'string'
                    ? htmlOrText.replace(/<[^>]*>/g, '')
                    : '';
            alert([title, plain].filter(Boolean).join('\n'));
        }
    };

    const closeSwal = () => {
        if (hasSwal()) {
            Swal.close();
        }
    };

    const setSuccessAfterReload = (message = '更新しました') => {
        try {
            sessionStorage.setItem('showProcessSuccess', message);
        } catch (error) {
            // sessionStorage が利用できない場合は何もしない
        }
    };

    const showSuccessMessageAfterReload = () => {
        try {
            const message = sessionStorage.getItem('showProcessSuccess');
            if (message && hasSwal()) {
                sessionStorage.removeItem('showProcessSuccess');
                showSuccessToast(message);
            }
        } catch (error) {
            console.error('SweetAlertの再表示に失敗しました:', error);
        }
    };

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
            'L作業種別', 'L素材中分類'
        ]
    };

    /**
     * kintone APIを呼び出すラッパー関数
     * @param {string} path - APIパス (例: '/k/v1/record')
     * @param {string} method - HTTPメソッド ('GET', 'POST', 'PUT')
     * @param {object} params - APIに渡すパラメータ
     * @returns {Promise<object>} APIのレスポンス
     */
    const kintoneApi = (path, method, params) => {
        return kintone.api(kintone.api.url(path, true), method, params);
    };

    /**
     * レコードのステータスを更新します。
     * @param {string|number} recordId - レコードID
     * @param {string} newStatus - 新しいステータス
     * @returns {Promise}
     */
    const updateRecordStatus = (recordId, newStatus) => {
        return kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
            app: kintone.app.getId(),
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
            await showWarn('コピー処理スキップ', '見積IDが空のため、案件アプリへのコピーはスキップされました。');
            return;
        }

        try {
            const query = `${CONFIG.FIELDS.ESTIMATE_ID} = "${estimateID}"`;
            const getRes = await kintoneApi('/k/v1/records', 'GET', {
                app: CONFIG.TARGET_APP_ID,
                query: query
            });

            const recordToUpsert = CONFIG.FIELDS_TO_COPY.reduce((acc, fieldCode) => {
                const field = sourceRecord[fieldCode];
                if (field?.value != null) {
                    const isDateField = CONFIG.DATE_FIELDS_TO_FORMAT.includes(fieldCode);
                    acc[fieldCode] = {
                        value: isDateField ? field.value.split('T')[0] : field.value
                    };
                }
                return acc;
            }, {});

            // L輸送方法（文字列） → 236側の「納品方法_見積から」にコピー
            if (sourceRecord['L輸送方法']?.value != null) {
                recordToUpsert['納品方法_見積から'] = { value: sourceRecord['L輸送方法'].value };
            }

            let targetRecordId;
            let apiMethod, apiParams;

            if (getRes.records.length > 0) {
                targetRecordId = getRes.records[0].$id.value;
                apiMethod = 'PUT';
                apiParams = { app: CONFIG.TARGET_APP_ID, id: targetRecordId, record: recordToUpsert };
            } else {
                apiMethod = 'POST';
                apiParams = { app: CONFIG.TARGET_APP_ID, record: recordToUpsert };
            }

            const upsertRes = await kintoneApi('/k/v1/record', apiMethod, apiParams);
            targetRecordId = targetRecordId || upsertRes.id;

            if (targetRecordId) {
                window.open(`/k/${CONFIG.TARGET_APP_ID}/show#record=${targetRecordId}`, '_blank');
            }
        } catch (error) {
            const errorDetails = JSON.stringify(error.errors || error.message, null, 2);
            console.error('レコードコピーエラー詳細:', error);
            closeSwal();
            await showErrorDialog('レコードコピー失敗', `レコードのコピーに失敗しました。<br>詳細はコンソールを確認してください。<pre style="text-align: left; background-color: #f3f3f3; padding: 1em; white-space: pre-wrap; word-break: break-all;">${errorDetails}</pre>`);
            throw error;
        }
    };

    // --- メイン処理 ---
    kintone.events.on('app.record.detail.show', (event) => {
        showSuccessMessageAfterReload();

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
            buttonSubmit.disabled = true;
            buttonReject.disabled = true;

            showLoading('処理中...', 'ステータスを更新しています');

            try {
                const newStatus = getNewStatusFunc(currentStatus);
                await updateRecordStatus(event.recordId, newStatus);

                if (shouldCopy && newStatus === CONFIG.STATUS.ACCEPTED) {
                    await copyRecordToTargetApp(record);
                }

                setSuccessAfterReload('更新しました');
                closeSwal();
                location.reload();

            } catch (error) {
                console.error('処理中にエラーが発生しました:', error);
                closeSwal();
                await showErrorDialog('処理エラー', 'エラーが発生しました。詳細はコンソールを確認してください。');
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


// =========================================================
// 機能: 後見積明細転記.js
// =========================================================
(function () {
    'use strict';

    // SweetAlert2 ヘルパー（案件登録セクションと同様）
    const hasSwal = () =>
        typeof Swal !== 'undefined' && Swal && typeof Swal.fire === 'function';

    const showAlert = async (icon, title, text) => {
        if (hasSwal()) {
            await Swal.fire({ icon, title, text });
        } else {
            alert([title, text].filter(Boolean).join('\n'));
        }
    };

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
                    await showAlert('warning', '入力不足', '「時間/面積選択」ラジオボタンが選択されていません。確認してください。');
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
                    await showAlert('warning', '対象レコードなし', 'コピー先に一致する明細IDのレコードが見つかりません。');
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
                await showAlert('success', '転記完了', '明細の転記が完了しました。');
                
                // コピー先のレコード詳細画面を新しいタブで開く
                const destRecordUrl = `/k/${DEST_APP_ID}/show#record=${destRecordId}`;
                window.open(destRecordUrl, '_blank');

                // 現在の画面をリロードしてステータスの変更を反映する
                location.reload();
                
                // ※ window.close() はブラウザ設定により動作しないことがあるため、リロードや別画面への遷移がより確実な挙動です。

            } catch (e) {
                console.error('後見積明細転記エラー:', e);
                let errorDetail = '';
                if (e.errors) {
                    errorDetail = Object.values(e.errors).map(err => err.messages.join(', ')).join('\n');
                } else {
                    errorDetail = e.message || JSON.stringify(e);
                }
                await showAlert('error', '転記エラー', '処理中にエラーが発生しました。\n' + errorDetail);
                copyButton.disabled = false;
            }
        };

        // ボタンをヘッダースペースに設置
        headerSpace.appendChild(copyButton);
    });
})();


// =========================================================
// 機能: 行内容コピー_0.js
// =========================================================
/**
 * kintone テーブルの上行コピー・スクリプト Ver.1.1
 *
 * 機能:
 * - テーブル内の指定したフィールドでダブルクリックすると、一つ上の行の同じ列の値をコピーします。
 * - テーブルに行が動的に追加された場合でも自動で対応します。
 *
 * 更新履歴:
 * Ver.1.1 (2025-08-11): デバッグ用のコンソール出力を削除。
 * Ver.1 (2025-08-11): 初版リリース。
 */
(function() {
  'use strict';

  // =================================================================
  // 設定項目
  // =================================================================

  /**
   * @const {string[]} TARGET_INPUT_SELECTORS
   * ダブルクリックの対象としたい入力欄のCSSセレクタを配列で指定します。
   * 複数指定することで、異なるフィールドを一度に設定できます。
   */
  const TARGET_INPUT_SELECTORS = [
    // 既存のフィールド
    '.field-8244828 .input-text-cybozu',
    '.field-8244833 .input-text-cybozu',
    // 追加されたフィールド
    '.field-8242548 .input-text-cybozu',
    '.field-8242550 .input-text-cybozu',
    '.field-8242552 .input-text-cybozu',
    '.field-8242553 .input-text-cybozu',
    '.field-8242554 .input-text-cybozu',
    '.field-8242568 .input-text-cybozu',
    '.field-8242569 .input-text-cybozu',
    '.field-8242611 .input-text-cybozu',
    '.field-8242613 .input-text-cybozu',
    '.field-8242614 .input-text-cybozu',
    '.field-8242556 .input-text-cybozu',
    '.field-8242558 .input-text-cybozu',
    '.field-8242570 .input-text-cybozu',
    '.field-8242571 .input-text-cybozu',
    '.field-8242572 .input-text-cybozu',
    '.field-8242573 .input-text-cybozu',
    '.field-8242574 .input-text-cybozu',
    '.field-8242625 .input-text-cybozu',
    '.field-8242626 .input-text-cybozu'
  ];

  // =================================================================
  // メイン処理
  // =================================================================

  // レコード作成画面と編集画面が表示されたときに処理を実行
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {

    /**
     * 対象の入力欄にダブルクリックイベントを設定する関数
     */
    function bindDblClickToInputs() {
      // 設定されたすべてのセレクタに一致する要素を取得
      const allTargetInputs = document.querySelectorAll(TARGET_INPUT_SELECTORS.join(','));

      allTargetInputs.forEach(input => {
        // すでにイベントが設定済みの場合は何もしない（二重登録を防止）
        if (input.dataset.dblBound) {
          return;
        }
        // イベントが未設定である印を付ける
        input.dataset.dblBound = 'true';

        // ダブルクリックイベントを設定
        input.addEventListener('dblclick', (e) => {
          copyValueFromPreviousRow(e.target);
        });
      });
    }

    /**
     * ダブルクリックされた入力欄の、一つ上の行の同じ列から値を取得してコピーする関数
     * @param {HTMLInputElement} targetInput - ダブルクリックされたinput要素
     */
    function copyValueFromPreviousRow(targetInput) {
      const tr = targetInput.closest('tr');
      const prevTr = tr.previousElementSibling;

      if (!prevTr) {
        return;
      }

      const td = targetInput.closest('td');
      const colIndex = Array.from(tr.children).indexOf(td);
      if (colIndex === -1) return;

      const prevCell = prevTr.children[colIndex];
      if (!prevCell) return;

      const prevInput = prevCell.querySelector('input');
      if (!prevInput) return;

      targetInput.value = prevInput.value;
      
      const changeEvent = new Event('change', { bubbles: true });
      targetInput.dispatchEvent(changeEvent);
    }

    // --- 初期表示時のイベント設定 ---
    bindDblClickToInputs();

    // --- DOMの変更を監視し、動的に追加された行にも対応 ---
    const observer = new MutationObserver(() => {
      // DOMに変更があった場合、再度イベント設定関数を呼び出す
      // datasetでチェックしているので、既存の要素に二重で設定されることはない
      bindDblClickToInputs();
    });

    // 監視を開始
    observer.observe(document.body, {
      childList: true, // 子要素（行の追加・削除など）の変更を監視
      subtree: true   // すべての子孫要素を監視対象に
    });

    return event;
  });
})();


// =========================================================
// 機能: 表示コントロール.js
// =========================================================
(function() {
    'use strict';

    // 対象アプリのイベント
    const events = [
        'app.record.create.change.R計算方式1',  // 新規作成時、R計算方式1の変更時
        'app.record.edit.change.R計算方式1',    // 編集時、R計算方式1の変更時
        'app.record.create.show',              // 新規作成画面の表示時
        'app.record.edit.show',                // 編集画面の表示時
        'app.record.detail.show',              // 詳細画面の表示時
        'app.record.create.change.T時間計算',  // テーブル行追加時（新規作成）
        'app.record.edit.change.T時間計算'     // テーブル行追加時（編集）
    ];

    // フィールド初期化関数
    function initializeFieldsForRow(row) {
        if (row.value['径1']) row.value['径1'].disabled = true;
        if (row.value['縦1']) row.value['縦1'].disabled = true;
        if (row.value['横1']) row.value['横1'].disabled = true;
        if (row.value['時間指定1']) row.value['時間指定1'].disabled = true;
        if (row.value['金額指定1']) row.value['金額指定1'].disabled = true;
    }

    // 表示制御の関数
    function toggleFields(event) {
        const record = event.record;
        const tableRows = record['T時間計算'] ? record['T時間計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            // 各フィールドコードが存在するか確認
            const calculationMethod = row.value['R計算方式1'] ? row.value['R計算方式1'].value : null;
            initializeFieldsForRow(row); // 初期化

            // 表示制御: R計算方式1の値による
            if (calculationMethod === '円形') {
                if (row.value['径1']) row.value['径1'].disabled = false;
            } else if (calculationMethod === '方形') {
                if (row.value['縦1']) row.value['縦1'].disabled = false;
                if (row.value['横1']) row.value['横1'].disabled = false;
            } else if (calculationMethod === '時間指定') {
                if (row.value['時間指定1']) row.value['時間指定1'].disabled = false;
            } else if (calculationMethod === '金額指定') {
                if (row.value['金額指定1']) row.value['金額指定1'].disabled = false;
            }
            // "-" またはその他の場合は全て非表示 (初期化済み)
        });

        return event;
    }

    // レコード読み込み時に初期化
    function initializeFields(event) {
        const record = event.record;
        const tableRows = record['T時間計算'] ? record['T時間計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            initializeFieldsForRow(row);
        });

        return event;
    }

    // 行追加時の初期化処理
    function handleRowAddition(event) {
        const record = event.record;
        const tableRows = record['T時間計算'] ? record['T時間計算'].value : []; // テーブルが空の場合対応
        const newRow = tableRows[tableRows.length - 1]; // 最後に追加された行

        if (newRow) {
            initializeFieldsForRow(newRow);
        }

        return event;
    }

    // イベント登録
    kintone.events.on(['app.record.create.show', 'app.record.edit.show'], initializeFields);
    kintone.events.on(events, toggleFields);

    // 行追加時のイベント
    kintone.events.on(['app.record.create.change.T時間計算', 'app.record.edit.change.T時間計算'], handleRowAddition);
})();
(function() {
    'use strict';

    // 対象アプリのイベント
    const events = [
        'app.record.create.change.R計算方式2',  // 新規作成時、R計算方式2の変更時
        'app.record.edit.change.R計算方式2',    // 編集時、R計算方式2の変更時
        'app.record.create.show',              // 新規作成画面の表示時
        'app.record.edit.show',                // 編集画面の表示時
        'app.record.detail.show',              // 詳細画面の表示時
        'app.record.create.change.T面積計算',  // テーブル行追加時（新規作成）
        'app.record.edit.change.T面積計算'     // テーブル行追加時（編集）
    ];

    // フィールド初期化関数
    function initializeFieldsForRow(row) {
        if (row.value['径2']) row.value['径2'].disabled = true;
        if (row.value['縦2']) row.value['縦2'].disabled = true;
        if (row.value['横2']) row.value['横2'].disabled = true;
        if (row.value['面積指定2']) row.value['面積指定2'].disabled = true;
        if (row.value['金額指定2']) row.value['金額指定2'].disabled = true;
    }

    // 表示制御の関数
    function toggleFields(event) {
        const record = event.record;
        const tableRows = record['T面積計算'] ? record['T面積計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            // 各フィールドコードが存在するか確認
            const calculationMethod = row.value['R計算方式2'] ? row.value['R計算方式2'].value : null;
            initializeFieldsForRow(row); // 初期化

            // 表示制御: R計算方式2の値による
            if (calculationMethod === '円形') {
                if (row.value['径2']) row.value['径2'].disabled = false;
            } else if (calculationMethod === '方形') {
                if (row.value['縦2']) row.value['縦2'].disabled = false;
                if (row.value['横2']) row.value['横2'].disabled = false;
            } else if (calculationMethod === '面積指定') {
                if (row.value['面積指定2']) row.value['面積指定2'].disabled = false;
            } else if (calculationMethod === '金額指定') {
                if (row.value['金額指定2']) row.value['金額指定2'].disabled = false;
            }
            // "-" またはその他の場合は全て非表示 (初期化済み)
        });

        return event;
    }

    // レコード読み込み時に初期化
    function initializeFields(event) {
        const record = event.record;
        const tableRows = record['T面積計算'] ? record['T面積計算'].value : []; // テーブルが空の場合対応

        tableRows.forEach((row) => {
            initializeFieldsForRow(row);
        });

        return event;
    }

    // 行追加時の初期化処理
    function handleRowAddition(event) {
        const record = event.record;
        const tableRows = record['T面積計算'] ? record['T面積計算'].value : []; // テーブルが空の場合対応
        const newRow = tableRows[tableRows.length - 1]; // 最後に追加された行

        if (newRow) {
            initializeFieldsForRow(newRow);
        }

        return event;
    }

    // イベント登録
    kintone.events.on(['app.record.create.show', 'app.record.edit.show'], initializeFields);
    kintone.events.on(events, toggleFields);

    // 行追加時のイベント
    kintone.events.on(['app.record.create.change.T面積計算', 'app.record.edit.change.T面積計算'], handleRowAddition);
})();
(function() {
    "use strict";

    // フィールドコード
    const radioField = "R形状選択";
    const freeInputField = "寸法自由入力"; // 追加された自由入力フィールド
    const fieldsToControl = {
        "外形寸法": ["円柱", "リング・パイプ"],
        "内径寸法": ["リング・パイプ"],
        "縦寸法": ["角材"],
        "横寸法": ["角材"],
        "長寸法": ["円柱", "角材", "リング・パイプ"]
    };

    /**
     * 編集可否の設定（レコード開くとき用）
     * 値はクリアせず、編集可否のみ設定
     * @param {Object} event - Kintoneイベントオブジェクト
     */
    function setFieldPermissions(event) {
        const record = event.record;
        const selectedValue = record[radioField].value;

        // すべての数値フィールド & '寸法自由入力' を一旦編集不可
        Object.keys(fieldsToControl).forEach(field => {
            record[field].disabled = true;
        });
        record[freeInputField].disabled = true;

        // "-" の場合、すべて編集不可のまま
        if (selectedValue === "-") {
            return event;
        }

        // "異形その他" の場合は '寸法自由入力' を編集可
        if (selectedValue === "異形その他") {
            record[freeInputField].disabled = false;
            return event;
        }

        // 定義された編集可のフィールドを有効化
        Object.entries(fieldsToControl).forEach(([field, allowedValues]) => {
            if (allowedValues.includes(selectedValue)) {
                record[field].disabled = false;
            }
        });

        return event;
    }

    /**
     * 編集可否の設定 & フィールドクリア（ラジオボタン変更時用）
     * @param {Object} event - Kintoneイベントオブジェクト
     */
    function updateFieldPermissions(event) {
        const record = event.record;
        const selectedValue = record[radioField].value;

        // すべての数値フィールド & '寸法自由入力' を一旦編集不可 & 値クリア
        Object.keys(fieldsToControl).forEach(field => {
            record[field].disabled = true;
            record[field].value = ""; // ラジオボタン変更時のみ値をクリア
        });
        record[freeInputField].disabled = true;
        record[freeInputField].value = ""; // ラジオボタン変更時のみ値をクリア

        // "-" の場合、すべて編集不可のまま
        if (selectedValue === "-") {
            return event;
        }

        // "異形その他" の場合は '寸法自由入力' を編集可
        if (selectedValue === "異形その他") {
            record[freeInputField].disabled = false;
            return event;
        }

        // 定義された編集可のフィールドを有効化
        Object.entries(fieldsToControl).forEach(([field, allowedValues]) => {
            if (allowedValues.includes(selectedValue)) {
                record[field].disabled = false;
            }
        });

        return event;
    }

    // イベント登録
    kintone.events.on(["app.record.create.show", "app.record.edit.show"], setFieldPermissions);
    kintone.events.on(["app.record.create.change." + radioField, "app.record.edit.change." + radioField], updateFieldPermissions);

})();


// =========================================================
// 機能: テーブル折り返し.js
// =========================================================
(function() {
  'use strict';

  // ラベルを設定する処理を関数化
  function setTableLabels(tableFieldCode, tableSelector) {
    // ヘッダー情報を取得
    var headers = document.querySelectorAll(tableSelector + ' .subtable-header-gaia th');
    if (headers.length === 0) {
      return; // ヘッダーが見つからなければ何もしない
    }

    var headerLabels = {};
    headers.forEach(function(th) {
      var labelClass = th.className.match(/label-\d+/);
      if (labelClass) {
        var fieldId = labelClass[0].split('-')[1];
        var labelText = (th.textContent || th.innerText || '').trim().replace(/\s+/g, ' '); // 複数行のラベルを1行に
        headerLabels[fieldId] = labelText;
      }
    });

    // 各行の各セルにラベルを設定
    var rows = document.querySelectorAll(tableSelector + ' tbody tr');
    rows.forEach(function(row) {
      var cells = row.querySelectorAll('td');
      cells.forEach(function(cell) {
        var fieldDiv = cell.querySelector('[class*="field-"]');
        if (fieldDiv) {
          var fieldClass = fieldDiv.className.match(/field-\d+/);
          if (fieldClass) {
            var fieldId = fieldClass[0].split('-')[1];
            if (headerLabels[fieldId]) {
              // data-label属性にフィールド名を設定
              fieldDiv.setAttribute('data-label', headerLabels[fieldId]);
            }
          }
        }
      });
    });
  }

  // 実行するイベントの種類
  var events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show',
    'app.record.create.change.T時間計算', // T時間計算テーブルの変更イベント
    'app.record.edit.change.T時間計算',
    'app.record.create.change.T面積計算', // T面積計算テーブルの変更イベント
    'app.record.edit.change.T面積計算'
  ];

  // イベントが発火したときの処理
  kintone.events.on(events, function(event) {
    // T時間計算テーブルのラベルを設定
    setTableLabels('T時間計算', '.subtable-8242560');

    // T面積計算テーブルのラベルを設定
    setTableLabels('T面積計算', '.subtable-8242561');

    return event;
  });

})();

// =========================================================
// 機能: L輸送方法 自動連結（T輸送計算 → L輸送方法）
// =========================================================
/**
 * T輸送計算テーブル内の「L輸送方法2」の値を集約し、
 * ルートフィールド「L輸送方法」（文字列）に自動セットする。
 *
 * ルール:
 *   - 値がある行が 0行 → '未設定'
 *   - 1行 → その値をそのまま
 *   - 2行以上 → '/' で連結（例: チャーター便/混載便）
 *
 * L輸送方法は編集不可（disabled）に設定し、ユーザー手入力を防止。
 */
(function () {
    'use strict';

    /**
     * T輸送計算テーブルのL輸送方法2を連結してL輸送方法にセットする
     * @param {object} record - kintone レコードオブジェクト
     */
    function updateTransportMethod(record) {
        if (!record['L輸送方法'] || !record['T輸送計算']) return;

        var table = record['T輸送計算'].value || [];
        var methods = [];

        for (var i = 0; i < table.length; i++) {
            var val = table[i].value['L輸送方法2'] && table[i].value['L輸送方法2'].value;
            if (val && val !== '') {
                methods.push(val);
            }
        }

        if (methods.length === 0) {
            record['L輸送方法'].value = '未設定';
        } else if (methods.length === 1) {
            record['L輸送方法'].value = methods[0];
        } else {
            record['L輸送方法'].value = methods.join('/');
        }
    }

    // --- 表示時: 読み取り専用にし、初期値を反映 ---
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], function (event) {
        event.record['L輸送方法'].disabled = true;
        updateTransportMethod(event.record);
        return event;
    });

    // --- テーブル行の追加・削除時 ---
    kintone.events.on([
        'app.record.create.change.T輸送計算',
        'app.record.edit.change.T輸送計算'
    ], function (event) {
        updateTransportMethod(event.record);
        return event;
    });

    // --- L輸送方法2 の値変更時（LKDドロップダウン選択時にも対応） ---
    kintone.events.on([
        'app.record.create.change.L輸送方法2',
        'app.record.edit.change.L輸送方法2'
    ], function (event) {
        updateTransportMethod(event.record);
        return event;
    });

    // --- 保存時: 最終確定 ---
    kintone.events.on([
        'app.record.create.submit',
        'app.record.edit.submit'
    ], function (event) {
        updateTransportMethod(event.record);
        return event;
    });
})();