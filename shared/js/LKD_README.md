# LKD Engine — ルックアップ→ドロップダウン変換ライブラリ

## 概要
kintoneのルックアップフィールドを、フィルター連動のカスタムドロップダウンに変換する共有ライブラリ。

## ファイル構成
```
shared/js/lkd-engine.js           ← エンジン本体（全アプリ共通）
apps/XXX/desktop/js/appXXX_lkd_config.js  ← アプリ別設定ファイル
```

## 機能
- ルートフィールド / サブテーブル内フィールド 両方対応
- フィルター値の変更をポーリングで検知し、自動でドロップダウンを更新
- 親フィールドリセット時の連鎖クリア
- ホバーツールチップ（`tooltipField` 指定時）
- サブテーブルの行追加にも自動対応
- **リセットボタン** （`enableReset` 指定時）— ルックアップ選択をクリア
- **新規作成ボタン** （`enableNewRecord` 指定時）— 参照先アプリの新規作成画面を別タブで開き、戻ったらデータ自動再取得

## 設定ファイルの書き方

```javascript
(function () {
    'use strict';
    var LOOKUP_DEFS = {
        'Lフィールドコード': {           // 自アプリのルックアップフィールドコード
            label:          'ラベル名',   // フォーム上の表示ラベル（完全一致）
            location:       'root',       // 'root' or 'subtable'
            subtable:       'Tテーブル名', // location='subtable' の場合のみ必須
            refApp:         123,          // 参照先アプリID
            refKeyField:    'キーフィールド',    // 参照先のキーフィールド
            displayField:   '表示フィールド',    // ドロップダウンに表示するフィールド
            filterField:    'フィルター元',      // 自アプリのフィルター条件フィールド
            filterFieldRef: 'フィルター先',      // 参照先アプリの対応フィールド
            emptyMessage:   '○○を選択してください',
            tooltipField:   'メモ',              // 省略可。ホバー時に表示するフィールド
            enableReset:    true,              // 省略可。リセットボタンを表示
            enableNewRecord: true,             // 省略可。新規作成ボタンを表示（別タブで参照先アプリを開く）
            fieldMappings:  [                    // ルックアップで自動コピーされるフィールドの対応
                { to: '自アプリ側フィールド', from: '参照先フィールド' }
            ]
        }
    };
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], function (event) {
        LkdEngine.init(LOOKUP_DEFS);
        return event;
    });
})();
```

## customize-manifest.json の設定
```json
{
    "app": "XXX",
    "scope": "ALL",
    "desktop": {
        "js": [
            "../../shared/js/lkd-engine.js",
            "desktop/js/appXXX_lkd_config.js"
        ]
    }
}
```
**注意**: `lkd-engine.js` は設定ファイルの **前** に記述すること。

## 適用実績
- アプリ225（見積登録・作成）— 4つのルックアップを変換

---

## AIへの指示テンプレート

以下をコピペして使用してください：

---

### パターン1: ルックアップフィールドが分かっている場合

```
アプリ○○○に LKD Engine（shared/js/lkd-engine.js）を適用してください。

対象ルックアップ:
- Lフィールド名1: 参照先アプリXXX、フィルター条件は「自アプリのAフィールド = 参照先のBフィールド」
- Lフィールド名2: （同様に記載）

ツールチップ: Lフィールド名1のホバー時に「メモ」フィールドを表示したい
```

### パターン2: ルックアップフィールドを調査してほしい場合

```
アプリ○○○のルックアップフィールドを確認し、LKD Engine（shared/js/lkd-engine.js）で
ドロップダウン化してください。対象フィールドの特定はブラウザから行ってください。
```

### パターン3: 最小指示

```
アプリ○○○にLKDエンジンを適用して。
```
（※ この場合、AIがブラウザでフォームを開いてルックアップフィールドを自動特定します）
