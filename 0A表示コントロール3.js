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
