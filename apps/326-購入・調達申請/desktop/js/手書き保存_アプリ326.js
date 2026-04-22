(function() {
    'use strict';

    // 適用するアプリID
    const TARGET_APP_ID = 326;
    
    // 対象の添付ファイルフィールドのフィールドコード（「手書き入力」または「手書き保存」など、Kintoneの設定に合わせて変更してください）
    const ATTACHMENT_FIELD_CODE = '手書き保存'; 

    // アップロードした手書き画像のfileKeyを一時保持する配列
    let tempUploadedKeys = [];

    // ==========================================
    // 画面表示時のUI構築処理
    // ==========================================
    const showEvents = [
        'app.record.create.show',
        'app.record.edit.show'
    ];

    kintone.events.on(showEvents, function(event) {
        if (event.appId !== TARGET_APP_ID) return event;

        // 画面表示時にリセット
        tempUploadedKeys = [];

        // スペース要素を取得
        const spaceElement = kintone.app.record.getSpaceElement('tegaki1');
        if (!spaceElement) {
            console.error('スペース「tegaki1」が見つかりません。');
            return event;
        }

        // 重複生成防止
        if (document.getElementById('tegaki-canvas-container')) {
            return event;
        }

        // コンテナの作成
        const container = document.createElement('div');
        container.id = 'tegaki-canvas-container';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-start';
        container.style.gap = '10px';
        container.style.padding = '10px';
        container.style.border = '1px solid #ddd';
        container.style.backgroundColor = '#fafafa';

        // キャンバスの作成
        const canvas = document.createElement('canvas');
        canvas.id = 'tegaki-canvas';
        canvas.style.touchAction = 'none'; // iPad等でスワイプスクロールを防ぐ
        canvas.style.border = '1px solid #999';
        canvas.style.backgroundColor = '#fff';
        canvas.style.cursor = 'crosshair';
        
        // スペース要素のサイズを取得してキャンバスサイズに適用
        // ※ 万が一取得できない場合のフォールバックとしてデフォルト値を設定
        const spaceWidth = spaceElement.offsetWidth;
        const spaceHeight = spaceElement.offsetHeight;
        canvas.width = spaceWidth > 0 ? spaceWidth : 750;
        canvas.height = spaceHeight > 0 ? spaceHeight : 225;

        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '15px';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.padding = '8px 24px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.backgroundColor = '#3498db';
        saveBtn.style.color = '#fff';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '4px';

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'キャンセル (消去)';
        clearBtn.style.padding = '8px 24px';
        clearBtn.style.cursor = 'pointer';
        clearBtn.style.backgroundColor = '#e74c3c';
        clearBtn.style.color = '#fff';
        clearBtn.style.border = 'none';
        clearBtn.style.borderRadius = '4px';

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(clearBtn);

        container.appendChild(canvas);
        container.appendChild(buttonContainer);
        spaceElement.appendChild(container);

        // 描画ロジック
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        function startPosition(e) {
            e.preventDefault();
            isDrawing = true;
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
        }

        function endPosition(e) {
            e.preventDefault();
            if (!isDrawing) return;
            isDrawing = false;
            ctx.beginPath();
        }

        function draw(e) {
            e.preventDefault();
            if (!isDrawing) return;

            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            lastX = pos.x;
            lastY = pos.y;
        }

        canvas.addEventListener('pointerdown', startPosition);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', endPosition);
        canvas.addEventListener('pointercancel', endPosition);
        canvas.addEventListener('pointerout', endPosition);

        // キャンセル処理
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        // 描画内容の一時保存アップロード処理
        saveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.textContent = '一時保存中...';

            canvas.toBlob(function(blob) {
                if (!blob) {
                    alert('画像の生成に失敗しました。');
                    resetSaveBtn();
                    return;
                }

                const formData = new FormData();
                formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
                const filename = 'tegaki_' + new Date().getTime() + '.png';
                formData.append('file', blob, filename);

                fetch('/k/v1/file.json', {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(json => { throw json; });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.fileKey) {
                        // Kintoneの制約により、編集中にkintone.app.record.set()で添付ファイルを書き換えることはできません。
                        // そのためREST API実行用にfileKeyを一時保持します。
                        tempUploadedKeys.push(data.fileKey);
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        alert('手書き画像を一時保存しました。\n画面左上の標準「保存」ボタンでKintoneのレコードを保存した際に、自動で添付されます。');
                    }
                    resetSaveBtn();
                })
                .catch(error => {
                    console.error('ファイルアップロードエラー:', error);
                    alert('アップロードに失敗しました。コンソールを確認してください。');
                    resetSaveBtn();
                });

            }, 'image/png');
        });

        function resetSaveBtn() {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存';
        }

        // ==========================================
        // カメラボタンUIの構築処理 (camera1 スペース) - WebRTC版
        // ==========================================
        const cameraSpace = kintone.app.record.getSpaceElement('camera1');
        if (cameraSpace && !document.getElementById('camera-button-container')) {
            const cameraContainer = document.createElement('div');
            cameraContainer.id = 'camera-button-container';
            cameraContainer.style.width = '150px';
            cameraContainer.style.height = '150px';
            cameraContainer.style.backgroundColor = '#2c3e50';
            cameraContainer.style.borderRadius = '12px';
            cameraContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            cameraContainer.style.display = 'flex';
            cameraContainer.style.justifyContent = 'center';
            cameraContainer.style.alignItems = 'center';
            cameraContainer.style.cursor = 'pointer';
            
            const iconWrapper = document.createElement('div');
            iconWrapper.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#ecf0f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                </svg>
            `;
            
            const textWrapper = document.createElement('div');
            textWrapper.textContent = '送信中...';
            textWrapper.style.color = '#ecf0f1';
            textWrapper.style.fontWeight = 'bold';
            textWrapper.style.fontSize = '16px';
            textWrapper.style.display = 'none';

            cameraContainer.appendChild(iconWrapper);
            cameraContainer.appendChild(textWrapper);
            cameraSpace.appendChild(cameraContainer);

            // カメラ用モーダルの作成関数
            function openCameraModal() {
                const modalOverlay = document.createElement('div');
                modalOverlay.id = 'custom-camera-modal';
                modalOverlay.style.position = 'fixed';
                modalOverlay.style.top = '0';
                modalOverlay.style.left = '0';
                modalOverlay.style.width = '100vw';
                modalOverlay.style.height = '100vh';
                modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                modalOverlay.style.zIndex = '9999';
                modalOverlay.style.display = 'flex';
                modalOverlay.style.flexDirection = 'column';
                modalOverlay.style.justifyContent = 'center';
                modalOverlay.style.alignItems = 'center';

                const videoPreview = document.createElement('video');
                videoPreview.setAttribute('autoplay', '');
                videoPreview.setAttribute('playsinline', '');
                videoPreview.style.width = '90%';
                videoPreview.style.maxWidth = '600px';
                videoPreview.style.backgroundColor = '#000';
                videoPreview.style.borderRadius = '8px';

                // カメラ切り替え用フラグ（複数カメラ対応用）
                let useFacingBack = true; 
                let currentStream = null;

                const startCamera = () => {
                    const constraints = {
                        video: {
                            facingMode: useFacingBack ? 'environment' : 'user', // 背面優先
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    };

                    navigator.mediaDevices.getUserMedia(constraints)
                        .then(stream => {
                            currentStream = stream;
                            videoPreview.srcObject = stream;
                        })
                        .catch(err => {
                            console.error('カメラの起動に失敗しました。', err);
                            // 背面カメラ要求で失敗した場合は、インカメラを試行（Chromebook等へのフェールセーフ）
                            if (useFacingBack) {
                                useFacingBack = false;
                                startCamera();
                            } else {
                                alert('カメラへのアクセスが拒否されたか、利用できません。\nブラウザの設定でカメラを許可してください。');
                                closeModal();
                            }
                        });
                };

                const controls = document.createElement('div');
                controls.style.display = 'flex';
                controls.style.gap = '20px';
                controls.style.marginTop = '20px';

                const captureBtn = document.createElement('button');
                captureBtn.textContent = '📸 撮影する';
                captureBtn.style.padding = '12px 24px';
                captureBtn.style.fontSize = '18px';
                captureBtn.style.backgroundColor = '#27ae60';
                captureBtn.style.color = '#fff';
                captureBtn.style.border = 'none';
                captureBtn.style.borderRadius = '8px';
                captureBtn.style.cursor = 'pointer';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'キャンセル';
                cancelBtn.style.padding = '12px 24px';
                cancelBtn.style.fontSize = '18px';
                cancelBtn.style.backgroundColor = '#e74c3c';
                cancelBtn.style.color = '#fff';
                cancelBtn.style.border = 'none';
                cancelBtn.style.borderRadius = '8px';
                cancelBtn.style.cursor = 'pointer';

                controls.appendChild(captureBtn);
                controls.appendChild(cancelBtn);

                modalOverlay.appendChild(videoPreview);
                modalOverlay.appendChild(controls);
                document.body.appendChild(modalOverlay);

                startCamera();

                const closeModal = () => {
                    if (currentStream) {
                        currentStream.getTracks().forEach(track => track.stop());
                    }
                    if (document.getElementById('custom-camera-modal')) {
                        document.body.removeChild(modalOverlay);
                    }
                };

                cancelBtn.addEventListener('click', closeModal);

                captureBtn.addEventListener('click', () => {
                    // 撮影処理
                    const canvas = document.createElement('canvas');
                    canvas.width = videoPreview.videoWidth;
                    canvas.height = videoPreview.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
                    
                    closeModal(); // カメラモーダルを閉じる

                    // UIを送信中状態に変更
                    iconWrapper.style.display = 'none';
                    textWrapper.style.display = 'block';
                    cameraContainer.style.pointerEvents = 'none';

                    // Blobに変換してアップロード
                    canvas.toBlob(function(blob) {
                        if (!blob) {
                            alert('写真の生成に失敗しました。');
                            resetCameraUI();
                            return;
                        }

                        const formData = new FormData();
                        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
                        const filename = 'photo_' + new Date().getTime() + '.png';
                        formData.append('file', blob, filename);

                        fetch('/k/v1/file.json', {
                            method: 'POST',
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: formData
                        })
                        .then(response => {
                            if (!response.ok) {
                                return response.json().then(json => { throw json; });
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data && data.fileKey) {
                                tempUploadedKeys.push(data.fileKey);
                                alert('カメラ画像を一時保存しました。\n画面左上の標準「保存」ボタンでレコードを保存した際に、自動で添付されます。');
                            }
                            resetCameraUI();
                        })
                        .catch(error => {
                            console.error('カメラ画像アップロードエラー:', error);
                            alert('画像のアップロードに失敗しました。');
                            resetCameraUI();
                        });
                    }, 'image/png');
                });
            }

            cameraContainer.addEventListener('click', function() {
                // まずWebRTCが使えるかチェック
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    openCameraModal();
                } else {
                    alert('お使いのブラウザは直接のカメラ機能（getUserMedia）をサポートしていません。');
                }
            });

            function resetCameraUI() {
                iconWrapper.style.display = 'block';
                textWrapper.style.display = 'none';
                cameraContainer.style.pointerEvents = 'auto';
            }
        }

        return event;
    });

    // ==========================================
    // レコード保存完了時のREST API更新処理
    // ==========================================
    const submitSuccessEvents = [
        'app.record.create.submit.success',
        'app.record.edit.submit.success'
    ];

    kintone.events.on(submitSuccessEvents, function(event) {
        if (event.appId !== TARGET_APP_ID) return event;
        const record = event.record;
        
        // 追加された手書き画像がなければそのまま終了
        if (tempUploadedKeys.length === 0) {
            return event;
        }

        // kintone.Promiseを返すことで処理完了まで画面遷移を待機させる
        return new kintone.Promise(function(resolve, reject) {
            
            // 対象フィールドの既存ファイルの確認
            const attachmentField = record[ATTACHMENT_FIELD_CODE];
            if (!attachmentField) {
                alert('フィールド「' + ATTACHMENT_FIELD_CODE + '」が見つかりません。フィールドコードを確認してください。');
                resolve(event);
                return;
            }

            const existingFiles = attachmentField.value || [];
            
            // 既存ファイルがある場合、Kintoneの仕様上再度ダウンロードしてアップロードして
            // 新しいfileKeyを取得し直さなければ、既存ファイルが消えてしまいます。
            const reuploadPromises = existingFiles.map(function(file) {
                return fetch('/k/v1/file.json?fileKey=' + file.fileKey, {
                    method: 'GET',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                })
                .then(response => response.blob())
                .then(blob => {
                    const formData = new FormData();
                    formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
                    formData.append('file', blob, file.name);
                    return fetch('/k/v1/file.json', {
                        method: 'POST',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                        body: formData
                    });
                })
                .then(response => response.json())
                .then(data => data.fileKey);
            });

            // 既存ファイルの処理が全て終わったらレコード更新
            Promise.all(reuploadPromises).then(function(newExistingKeys) {
                // 既存ファイルの新しいキーと、手書きで追加した一時キーを結合
                const allKeys = newExistingKeys.concat(tempUploadedKeys);
                const updateValue = allKeys.map(function(key) {
                    return { fileKey: key };
                });

                // レコード更新用APIを実行
                const body = {
                    app: TARGET_APP_ID,
                    id: event.recordId,
                    record: {
                        [ATTACHMENT_FIELD_CODE]: {
                            value: updateValue
                        }
                    }
                };

                kintone.api(kintone.api.url('/k/v1/record.json', true), 'PUT', body, function(resp) {
                    // 更新成功したら一時配列をクリア
                    tempUploadedKeys = [];
                    resolve(event); 
                }, function(error) {
                    console.error('レコード更新エラー:', error);
                    alert('添付ファイルの保存に失敗しました。');
                    reject(error);
                });
            }).catch(function(error) {
                console.error('既存ファイルの再アップロードエラー:', error);
                alert('既存ファイルの処理中にエラーが発生しました。');
                reject(error);
            });
        });
    });

})();
