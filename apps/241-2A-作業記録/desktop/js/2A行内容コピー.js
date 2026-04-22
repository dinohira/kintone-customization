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
    '.field-8245622 .input-text-cybozu',
    '.field-8245627 .input-text-cybozu',
    '.field-8245628 .input-text-cybozu',
    '.field-8245629 .input-text-cybozu',
    '.field-8245630 .input-text-cybozu',
    '.field-6448245 .input-text-cybozu'
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
