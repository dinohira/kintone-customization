/**
 * カスケードルックアップ連携ヘルパー — アプリ195 MA客先詳細
 *
 * 機能:
 * 1. 他のアプリ（225, 236, 240, 196）のカスケードルックアップの「新規」ボタンから
 *    195の新規登録画面を開いた際に、客先名IDを自動的にL客先名ルックアップに
 *    セットし、「取得」を自動実行する。
 * 2. L客先名ルックアップ取得後、同一客先名IDの既存レコードから部門個人番号の
 *    最大値を取得し、+1した値を自動入力する。
 *    （通常手動取得 / カスケード新規 どちらにも対応）
 *
 * URL例: /k/195/edit?cascadeLookupId=123
 *
 * @version 2.1.0
 * @date 2026-04-11
 */
(function () {
    'use strict';

    const APP_ID = 195;

    /**
     * URLから指定パラメータを取得
     */
    function getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    /**
     * 同一客先名IDの既存レコードから部門個人番号の最大値を取得し +1 を返す
     * レコードがない場合は 1 を返す
     */
    async function getNextBumonNumber(customerNameId) {
        if (!customerNameId) return 1;

        try {
            const query = `客先名ID = ${customerNameId} order by 部門個人番号 desc limit 1`;
            const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: APP_ID,
                query: query,
                fields: ['部門個人番号']
            });

            if (resp.records.length > 0) {
                const maxNum = parseInt(resp.records[0]['部門個人番号'].value, 10);
                if (!isNaN(maxNum)) {
                    console.log('[CascadeHelper] 既存最大部門個人番号:', maxNum, '→ 新番号:', maxNum + 1);
                    return maxNum + 1;
                }
            }
            console.log('[CascadeHelper] 同一客先名IDのレコードなし → デフォルト 1');
            return 1;
        } catch (e) {
            console.error('[CascadeHelper] 部門個人番号取得エラー:', e);
            return 1;
        }
    }

    /**
     * 部門個人番号フィールドに値をセット
     */
    function setBumonNumber(value) {
        try {
            const rec = kintone.app.record.get();
            rec.record['部門個人番号'].value = value;
            kintone.app.record.set(rec);
            console.log('[CascadeHelper] 部門個人番号を', value, 'にセットしました');
        } catch (e) {
            console.error('[CascadeHelper] 部門個人番号セットエラー:', e);
        }
    }

    /**
     * ルックアップの「取得」ボタンをDOMから探して自動クリック
     */
    function clickLookupButton(fieldCode, maxRetries) {
        let retries = 0;
        const interval = setInterval(() => {
            retries++;
            const labels = document.querySelectorAll('.control-label-text-gaia');
            for (const label of labels) {
                const labelText = label.textContent.trim();
                if (labelText === '客先名(選択)' || labelText === fieldCode) {
                    const fieldEl = label.closest('.control-gaia');
                    if (fieldEl) {
                        const fetchBtn = fieldEl.querySelector('.input-lookup-gaia');
                        if (fetchBtn) {
                            clearInterval(interval);
                            fetchBtn.click();
                            console.log('[CascadeHelper] L客先名 ルックアップ「取得」を自動クリックしました');
                            return;
                        }
                    }
                }
            }
            if (retries >= maxRetries) {
                clearInterval(interval);
                console.warn('[CascadeHelper] ルックアップ「取得」ボタンが見つかりませんでした');
            }
        }, 300);
    }

    /**
     * ルックアップ取得成功を検知するDOM監視
     * 成功メッセージの表示 or 客先名IDフィールドの値変更を検知
     */
    function observeLookupCompletion() {
        let lastCustomerNameId = null;

        const checkForLookup = setInterval(async () => {
            try {
                const rec = kintone.app.record.get();
                const currentId = rec.record['客先名ID']?.value;

                // 客先名IDが新たにセットされた場合（前回と変わった場合）
                if (currentId && currentId !== lastCustomerNameId) {
                    lastCustomerNameId = currentId;
                    console.log('[CascadeHelper] ルックアップ取得検知: 客先名ID =', currentId);
                    const nextNum = await getNextBumonNumber(currentId);
                    setBumonNumber(nextNum);
                }
            } catch (e) {
                // record.get() 失敗時は無視
            }
        }, 800);

        // ページ離脱時に監視を停止
        window.addEventListener('beforeunload', () => {
            clearInterval(checkForLookup);
        });

        return checkForLookup;
    }

    // =====================================================
    // イベントハンドラ
    // =====================================================

    // 新規レコード作成画面表示時
    kintone.events.on('app.record.create.show', (event) => {
        const cascadeId = getUrlParam('cascadeLookupId');

        if (cascadeId) {
            // カスケードルックアップからの遷移: L客先名に値をセットし自動取得
            event.record['L客先名'].value = cascadeId;
            console.log('[CascadeHelper] L客先名 に客先名ID=' + cascadeId + ' をセットしました');

            // DOMレンダリングを待ってからルックアップ「取得」を自動クリック
            setTimeout(() => {
                clickLookupButton('L客先名', 10);
            }, 500);
        }

        // ルックアップ取得完了を監視して部門個人番号を自動採番
        // （カスケード新規 / 通常手動取得 両方に対応）
        setTimeout(() => {
            observeLookupCompletion();
        }, 300);

        return event;
    });

})();
