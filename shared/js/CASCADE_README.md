# CascadeEngine — カスケードルックアップエンジン

kintone の参照先アプリを、ドロップダウンで段階的に絞り込んでレコードを選択し、フィールドを自動コピーする再利用可能なライブラリです。

## 機能

- **フィルタードロップダウン排他制御**: 複数のフィルター用ドロップダウンを定義でき、一方を選択すると他方が自動的に無効化
- **カスケード段階選択**: 参照先アプリのフィールドで段階的に絞り込み（例: 客先名 → 部署 → 担当者）
- **フィールド自動コピー**: 最終選択時にマッピング定義に従ってフィールド値をコピー
- **ネイティブルックアップ取得トリガー**: kintoneの保存バリデーションを通過させるため、ネイティブの「取得」ボタンをプログラム的にクリック
- **リセット・新規ボタン**: カスケードのリセットと参照先アプリの新規レコード作成
- **タブ復帰時自動リフレッシュ**: 別タブから戻った際にカスケードの状態を自動復元
- **他アプリからのハンドオーバー対応**: IDによる自動コピー

## ファイル構成

```
shared/js/cascade-engine.js          ← エンジン（ライブラリ）
apps/XXX/desktop/js/appXXX_cascade_config.js  ← アプリ別設定
```

## 使い方

### 1. customize-manifest.json に追加

```json
{
    "app": "225",
    "desktop": {
        "js": [
            "../../shared/js/cascade-engine.js",
            "desktop/js/app225_cascade_config.js"
        ]
    }
}
```

> ⚠️ `cascade-engine.js` を設定ファイルより**先に**読み込むこと

### 2. 設定ファイルを作成

```javascript
(function () {
    'use strict';

    var CASCADE_CONFIG = {
        // 参照先アプリID
        sourceAppId: 195,

        // フィルター用ドロップダウン定義（排他制御付き）
        filters: [
            {
                fieldCode:   'Dフィルター1',      // 自アプリのフィールドコード
                label:       'フィルター1',        // フォーム上のラベル名
                sourceField: 'フィルター先フィールド'  // 参照先アプリのフィールド名
            },
            {
                fieldCode:   'Dフィルター2',
                label:       'フィルター2',
                sourceField: 'フィルター先フィールド2'
            }
        ],

        // カスケード段階定義
        cascadeLevels: [
            { field: '客先名',   label: '客先名' },
            { field: '所属部署', label: '所属部署' },
            { field: '担当者名', label: '担当者名' }
        ],

        // フィールドコピーマッピング（自アプリ ← 参照先アプリ）
        copyMap: [
            { to: 'L客先選択', from: '客先詳細ID' },
            { to: '客先名',   from: '客先名' }
        ],

        // ルックアップ取得トリガー（保存バリデーション対策）
        lookupTrigger: {
            label:     '客先選択',     // ルックアップのラベル名
            fieldCode: 'L客先選択'     // ルックアップのフィールドコード
        },

        // カスケードUI配置先のスペース要素ID
        spaceId: 'cascade-lookup-space',

        // 自動コピー設定（省略可）
        autoPopulate: {
            fieldCode:   '客先詳細ID',
            sourceField: '客先詳細ID'
        },

        // 新規レコードボタン設定（省略可）
        newRecordFields: {
            idField:   '客先名ID',
            paramName: 'cascadeLookupId'
        },

        // プレースホルダーテキスト（省略可）
        placeholderText: '--- 選択してください ---'
    };

    // 表示イベント
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show'
    ], function (event) {
        CascadeEngine.init(CASCADE_CONFIG, event);
        return event;
    });

    // フィルター変更イベント（各フィルターごとに登録）
    kintone.events.on([
        'app.record.create.change.Dフィルター1',
        'app.record.edit.change.Dフィルター1'
    ], function (event) {
        var value = event.record['Dフィルター1'].value;
        event.record['Dフィルター2'].value = '';
        CascadeEngine.onFilterChange('フィルター先フィールド', value, 'Dフィルター1');
        return event;
    });

    kintone.events.on([
        'app.record.create.change.Dフィルター2',
        'app.record.edit.change.Dフィルター2'
    ], function (event) {
        var value = event.record['Dフィルター2'].value;
        event.record['Dフィルター1'].value = '';
        CascadeEngine.onFilterChange('フィルター先フィールド2', value, 'Dフィルター2');
        return event;
    });

})();
```

## AIへの指示テンプレート

新しいアプリにカスケードルックアップを適用する際の指示テンプレート：

```
[アプリXXX] にカスケードルックアップを適用してください。
CascadeEngine（shared/js/cascade-engine.js）を使用してください。

■ 参照先アプリ
  - アプリID: XXX
  - アプリ名: ○○○

■ フィルター用ドロップダウン
  - フィルター1: フィールドコード「Dフィルター1」、ラベル「フィルター1」、参照先「フィルター先フィールド」
  - フィルター2: フィールドコード「Dフィルター2」、ラベル「フィルター2」、参照先「フィルター先フィールド2」

■ カスケード段階
  1. 客先名（参照先フィールド: 客先名）
  2. 所属部署（参照先フィールド: 所属部署）

■ コピーマッピング
  - 自アプリ「客先名」← 参照先「客先名」
  - 自アプリ「L客先選択」← 参照先「客先詳細ID」

■ ルックアップフィールド
  - ラベル: 客先選択
  - フィールドコード: L客先選択

■ スペースID: cascade-lookup-space
```

## 設定プロパティ一覧

| プロパティ | 必須 | 説明 |
|---|---|---|
| `sourceAppId` | ✅ | 参照先アプリID |
| `filters` | ✅ | フィルター用ドロップダウン配列 |
| `filters[].fieldCode` | ✅ | 自アプリのフィールドコード |
| `filters[].label` | ✅ | フォーム上のラベル名 |
| `filters[].sourceField` | ✅ | 参照先アプリのフィルター用フィールド |
| `cascadeLevels` | ✅ | カスケード段階定義配列 |
| `cascadeLevels[].field` | ✅ | 参照先アプリのフィールド名 |
| `copyMap` | ✅ | フィールドコピーマッピング配列 |
| `lookupTrigger` | - | ルックアップ取得トリガー設定 |
| `lookupTrigger.label` | - | ルックアップのラベル名 |
| `lookupTrigger.fieldCode` | - | ルックアップのフィールドコード |
| `spaceId` | ✅ | UIを配置するスペース要素ID |
| `autoPopulate` | - | ハンドオーバー自動コピー設定 |
| `newRecordFields` | - | 新規ボタンのURL設定 |
| `placeholderText` | - | プレースホルダーテキスト（デフォルト: 「--- 選択してください ---」） |
