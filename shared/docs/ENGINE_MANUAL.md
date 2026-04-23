# ルックアップエンジン 取扱説明書

> 本ドキュメントは Cascade Engine / LKD Engine / TRD Engine の設定方法と必要フィールドをまとめたリファレンスです。

---

## 目次

1. [エンジン比較表](#エンジン比較表)
2. [Cascade Engine（カスケードルックアップ）](#1-cascade-engine)
3. [LKD Engine（Lookup-to-Dropdown）](#2-lkd-engine)
4. [TRD Engine（Table Row Dropdown）](#3-trd-engine)
5. [ファイル構成と読み込み順序](#ファイル構成と読み込み順序)
6. [新規アプリへの導入手順](#新規アプリへの導入手順)

---

## エンジン比較表

| 項目 | Cascade | LKD | TRD |
|------|---------|-----|-----|
| **主な用途** | 多段階の絞り込み選択 | ルックアップ→ドロップダウン変換 | テーブル内の値をドロップダウン表示 |
| **UI表示場所** | スペース要素 | ルックアップフィールド上 | スペース要素 |
| **フィルター** | ドロップダウン（排他制御付き） | 自アプリ内フィールド値 | ルックアップ取得値 |
| **データ取得元** | 参照先アプリのレコード群 | 参照先アプリのレコード群 | 参照先アプリの**サブテーブル内**カラム |
| **多段選択** | ✅（2〜N段） | ❌（1段） | ❌（1段） |
| **検索機能** | ❌ | ✅（`searchable: true`） | ❌ |
| **ネイティブ取得連動** | ✅ | ✅ | ❌ |
| **サブテーブル対応** | ❌ | ✅ | ❌ |
| **リセットボタン** | ✅（常時） | ✅（オプション） | ✅（オプション） |
| **新規レコードボタン** | ✅（常時） | ✅（オプション） | ✅（編集ボタン） |
| **共有ファイル** | `cascade-engine.js` | `lkd-engine.js` | `trd-engine.js` |

---

## 1. Cascade Engine

### 概要
参照先アプリ（例: MA客先詳細）のレコードを、フィルタードロップダウンで絞り込んだ後、段階的に選択（客先名 → 部署 → 担当者）してフィールドを自動コピーする。

### kintone側の必要フィールド

#### 自アプリ
| 種別 | フィールド例 | 説明 |
|------|-------------|------|
| **ドロップダウン** | `Dよみ先頭文字`, `D客先グループ` | フィルター条件。アプリ設定画面で選択肢を定義 |
| **ルックアップ** | `L客先選択` | ネイティブ保存用。cascade-engine が値を自動入力 |
| **コピー先フィールド** | `客先名`, `電話番号` 等 | `copyMap` で指定。ルックアップの「他のフィールドのコピー」と同等 |
| **スペース要素** | `cascade-lookup-space` | カスケードUIを配置するスペース |

#### 参照先アプリ
| 種別 | フィールド例 | 説明 |
|------|-------------|------|
| **フィルター対象** | `よみ先頭文字`, `客先グループ` | 絞り込み条件に使うフィールド |
| **カスケード段階** | `客先名`, `所属部署`, `担当者名` | 段階的に絞り込むフィールド |
| **コピー元** | `客先詳細ID`, `郵便番号` 等 | `copyMap` の `from` に指定 |

### config定義

```javascript
var CASCADE_CONFIG = {
    sourceAppId: 195,   // 参照先アプリID

    // --- フィルター定義 ---
    // 排他制御: 一方を選択すると他方が自動で無効化
    filters: [
        {
            fieldCode:   'Dよみ先頭文字',   // 自アプリのドロップダウンフィールドコード
            label:       'よみ先頭文字',     // フォーム上のラベル名（DOM検索用）
            sourceField: 'よみ先頭文字'      // 参照先アプリのフィールド名
        },
        {
            fieldCode:   'D客先グループ',
            label:       '客先グループ',
            sourceField: '客先グループ'
        }
    ],

    // --- カスケード段階定義 ---
    // 配列順に段階的に選択。値が1つしかない段階は自動スキップ
    cascadeLevels: [
        { field: '客先名',   label: '客先名' },
        { field: '所属部署', label: '所属部署' },
        { field: '担当者名', label: '担当者名' }
    ],

    // --- フィールドコピーマッピング ---
    // to: 自アプリフィールドコード, from: 参照先フィールドコード
    copyMap: [
        { to: 'L客先選択',  from: '客先詳細ID' },
        { to: '客先名',     from: '客先名' },
        { to: '電話番号',   from: '電話番号' }
        // ... 必要なだけ追加
    ],

    // --- ネイティブルックアップ取得トリガー ---
    // 保存時バリデーション対策。カスケードで値セット後にルックアップの
    // 「取得」ボタンを自動クリックして「取得済み」状態にする
    lookupTrigger: {
        label:     '客先選択',    // フォーム上のルックアップラベル名
        fieldCode: 'L客先選択'    // ルックアップフィールドコード
    },

    spaceId: 'cascade-lookup-space',  // スペース要素ID

    // --- 自動コピー（省略可）---
    // 他アプリからの遷移時に、値が既にあればレコード取得してコピー
    autoPopulate: {
        fieldCode:   '客先詳細ID',
        sourceField: '客先詳細ID'
    },

    // --- 新規レコードボタン設定（省略可）---
    newRecordFields: {
        idField:   '客先名ID',
        paramName: 'cascadeLookupId'
    }
};
```

### イベント登録（configファイルに記述）

```javascript
// 表示イベント
kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show'
], function (event) {
    CascadeEngine.init(CASCADE_CONFIG, event);
    return event;
});

// フィルタードロップダウンの変更イベント（各フィルターごとに必要）
kintone.events.on([
    'app.record.create.change.Dよみ先頭文字',
    'app.record.edit.change.Dよみ先頭文字'
], function (event) {
    var value = event.record['Dよみ先頭文字'].value;
    event.record['D客先グループ'].value = '';  // 他のフィルターをクリア
    CascadeEngine.onFilterChange('よみ先頭文字', value, 'Dよみ先頭文字');
    return event;
});
```

### 適用中のアプリ
- App 225（見積登録・作成）
- App 236（案件登録）
- App 240（MA保管材）
- App 196（M素材中分類）

---

## 2. LKD Engine

### 概要
kintone のルックアップフィールドのUIを非表示にし、代わりにフィルター連動のカスタムドロップダウンを表示する。選択時にネイティブルックアップの「取得」を自動トリガーして保存バリデーションにも対応。

### kintone側の必要フィールド

#### 自アプリ
| 種別 | フィールド例 | 説明 |
|------|-------------|------|
| **ルックアップ** | `L屑分類` | 変換元のルックアップフィールド。ラベルがDOM検索に使用される |
| **フィルターフィールド** | `客先種別ID` | 参照先を絞り込む条件値を持つフィールド |
| **コピー先フィールド** | `屑分類`, `素材大分類` 等 | `fieldMappings` で指定 |

#### 参照先アプリ
| 種別 | フィールド例 | 説明 |
|------|-------------|------|
| **キーフィールド** | `屑分類` | ドロップダウン選択時の値 (`refKeyField`) |
| **表示フィールド** | `屑分類` | ドロップダウンに表示するテキスト (`displayField`) |
| **フィルターフィールド** | `客先種別ID` | 絞り込み条件の照合先 (`filterFieldRef`) |
| **ツールチップフィールド** | `メモ` | ホバー時に表示（省略可 `tooltipField`） |

### config定義

```javascript
var LOOKUP_DEFS = {
    // キー = 自アプリのルックアップフィールドコード
    'L屑分類': {
        label:          '屑分類検索',         // フォーム上のラベル名（DOM検索用）
        location:       'root',              // 'root' or 'subtable'
        // subtable:    'Tサブテーブル',      // location='subtable' の場合のみ必須
        refApp:         251,                 // 参照先アプリID
        refKeyField:    '屑分類',             // 参照先のキーフィールド
        displayField:   '屑分類',             // ドロップダウンに表示するフィールド
        filterField:    '客先種別ID',         // 自アプリのフィルター条件フィールド
        filterFieldRef: '客先種別ID',         // 参照先アプリのフィルター条件フィールド
        emptyMessage:   '客先を選択してください', // フィルター未設定時のメッセージ
        searchable:     true,                // 省略可: 検索入力欄を表示
        tooltipField:   'メモ',               // 省略可: ホバーツールチップ表示
        enableReset:    true,                // 省略可: リセットボタン表示
        enableNewRecord: true,               // 省略可: 新規レコードボタン表示
        fieldMappings: [                     // フィールドコピーマッピング
            { to: '屑分類',              from: '屑分類' },
            { to: '素材大分類_屑選択用_', from: '素材大分類' }
        ],
        onChange: function(fieldCode, value, record) {
            // 省略可: 値変更時のコールバック
        }
    }
};
```

### configプロパティ一覧

| プロパティ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `label` | string | ✅ | フォーム上のルックアップフィールドのラベル名 |
| `location` | string | ✅ | `'root'`（通常フィールド）or `'subtable'`（サブテーブル内） |
| `subtable` | string | △ | `location='subtable'` の場合のサブテーブルフィールドコード |
| `refApp` | number | ✅ | 参照先アプリID |
| `refKeyField` | string | ✅ | 参照先アプリのキーフィールド（ドロップダウンの value に使用） |
| `displayField` | string | ✅ | ドロップダウンに表示するフィールド名 |
| `filterField` | string | ✅ | 自アプリ側のフィルター条件フィールドコード |
| `filterFieldRef` | string | ✅ | 参照先アプリ側のフィルター照合フィールド |
| `emptyMessage` | string | ✅ | フィルター未設定時のプレースホルダー |
| `fieldMappings` | array | ✅ | `[{ to, from }]` 形式のフィールドコピー定義 |
| `searchable` | boolean | - | `true` でドロップダウン内に検索入力欄を表示 |
| `tooltipField` | string | - | ホバー時にツールチップで表示するフィールド名 |
| `enableReset` | boolean | - | リセットボタン表示 |
| `enableNewRecord` | boolean | - | 新規レコード追加ボタン表示 |
| `onChange` | function | - | 値変更時コールバック `function(fieldCode, value, record)` |

### イベント登録（configファイルに記述）

```javascript
kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show'
], function (event) {
    LkdEngine.init(LOOKUP_DEFS);
    return event;
});
```

> **注意**: CascadeやTRDと違い、changeイベントの登録は不要。LKDエンジン内部でフィルター値の変化をポーリング（500ms間隔）で監視している。

### 適用中のアプリ
- App 225（見積登録・作成）
- App 236（案件登録）
- App 240（MA保管材）
- App 196, 197, 198, 199（マスター系）

---

## 3. TRD Engine

### 概要
参照先アプリのレコード内にあるサブテーブルの特定カラムの値を取得し、それをスペース要素にドロップダウンとして表示する。例: 「屑分類」が選択されたら、その屑分類レコード内の「T社内鋼種」テーブルから「社内鋼種」の選択肢を表示。

### kintone側の必要フィールド

#### 自アプリ
| 種別 | フィールド例 | 説明 |
|------|-------------|------|
| **トリガーフィールド** | `CC屑分類` | ルックアップやフィールドコピーで値が入るフィールド。この値の変化を監視 |
| **保存先フィールド** | `社内鋼種` | ドロップダウンで選択した値の保存先 |
| **スペース要素** | `Dsyanaikousyu` | ドロップダウンUIを配置するスペース |

#### 参照先アプリ
| 種別 | フィールド例 | 説明 |
|------|-------------|------|
| **検索条件フィールド** | `屑分類` | トリガー値と照合するフィールド (`queryField`) |
| **サブテーブル** | `T社内鋼種` | 選択肢データを含むサブテーブル (`tableField`) |
| **カラムフィールド** | `社内鋼種` | テーブル内の選択肢となるカラム (`columnField`) |

### config定義

```javascript
TrdEngine.init([
    {
        sourceApp:      251,              // 参照先アプリID
        queryField:     '屑分類',          // 参照先の検索条件フィールド
        tableField:     'T社内鋼種',       // 参照先のサブテーブルフィールド
        columnField:    '社内鋼種',        // テーブル内の選択肢カラム
        triggerField:   'CC屑分類',        // 自アプリのトリガーフィールド（値変化を監視）
        targetField:    '社内鋼種',        // 自アプリの保存先フィールド
        spaceId:        'Dsyanaikousyu',   // スペース要素ID
        label:          '社内鋼種選択',     // ドロップダウンラベル
        readonlyFields: ['屑分類', '社内鋼種'],  // 省略可: 編集不可にするフィールド
        enableReset:    true,              // 省略可: リセットボタン
        enableEdit:     true,              // 省略可: 参照先レコード編集ボタン
        editParams: {                      // 省略可: 編集画面に渡すパラメータ
            fields: [
                { param: 'L素材大分類', from: '素材大分類_屑選択用' }
            ]
        }
    }
    // 複数定義可能（配列）
]);
```

### configプロパティ一覧

| プロパティ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `sourceApp` | number | ✅ | 参照先アプリID |
| `queryField` | string | ✅ | 参照先アプリでの検索条件フィールド |
| `tableField` | string | ✅ | 参照先アプリのサブテーブルフィールドコード |
| `columnField` | string | ✅ | サブテーブル内の選択肢カラム |
| `triggerField` | string | ✅ | 自アプリ内のトリガーフィールド（値変化で再描画） |
| `targetField` | string | ✅ | 選択値の保存先フィールドコード |
| `spaceId` | string | ✅ | ドロップダウンを配置するスペース要素ID |
| `label` | string | - | ドロップダウンのラベル（デフォルト: `'テーブル選択'`） |
| `readonlyFields` | array | - | 編集不可にするフィールドコード配列 |
| `enableReset` | boolean | - | リセットボタン表示 |
| `enableEdit` | boolean | - | 参照先レコード編集ボタン表示 |
| `editParams` | object | - | 編集ボタンで遷移時に渡すパラメータ |

### イベント登録

```javascript
// TrdEngine.init() 内部で自動的にイベント登録される
// configファイルでは TrdEngine.init([...]) を呼ぶだけでOK
(function () {
    'use strict';
    TrdEngine.init([{ /* config */ }]);
})();
```

> **注意**: Cascade/LKDと異なり、kintone.events.on の記述は不要。`TrdEngine.init()` 内部で show/submit/cancel イベントを自動登録する。トリガーフィールドの値変化はポーリング（500ms間隔）で監視。

### 適用中のアプリ
- App 236（案件登録）
- App 240（MA保管材）

---

## ファイル構成と読み込み順序

```
shared/js/
├── cascade-engine.js    ← エンジン本体（先に読み込む）
├── lkd-engine.js        ← エンジン本体（先に読み込む）
└── trd-engine.js        ← エンジン本体（先に読み込む）

apps/<appId>/
├── customize-manifest.json  ← デプロイ設定
└── desktop/js/
    ├── app<ID>_cascade_config.js  ← アプリ固有設定
    ├── app<ID>_lkd_config.js
    └── app<ID>_trd_config.js
```

### customize-manifest.json の読み込み順序（重要）

```json
{
    "desktop": {
        "js": [
            "../../shared/js/cascade-engine.js",
            "desktop/js/app225_cascade_config.js",
            "../../shared/js/lkd-engine.js",
            "desktop/js/app225_lkd_config.js",
            "../../shared/js/trd-engine.js",
            "desktop/js/app236_trd_config.js"
        ]
    }
}
```

> ⚠️ **エンジンファイルは必ずconfigファイルより前に配置すること**

---

## 新規アプリへの導入手順

### Step 1: アプリディレクトリ作成
```
apps/<appId>-<名前>/
├── customize-manifest.json
└── desktop/
    ├── js/
    │   └── app<ID>_<engine>_config.js
    └── css/
```

### Step 2: kintoneアプリ側の準備
- **Cascade**: スペース要素を追加、フィルター用ドロップダウンフィールドを追加
- **LKD**: ルックアップフィールドが既に存在すること
- **TRD**: スペース要素を追加、トリガーフィールドと保存先フィールドを準備

### Step 3: configファイル作成
上記の各エンジンのconfig定義を参考に、アプリ固有の設定ファイルを作成。

### Step 4: customize-manifest.json 更新
エンジンJSファイルとconfigファイルの読み込み順序を正しく設定。

### Step 5: デプロイ
```bash
cd apps/<appId>-<名前>
npx @kintone/customize-uploader customize-manifest.json
```

### Step 6: git管理
```bash
git add -A
git commit -m "feat: add <engine> to app <appId>"
git push
```
