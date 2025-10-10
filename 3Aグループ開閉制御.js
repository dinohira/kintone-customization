(function() {
  "use strict";

  // グループの表示/非表示と開閉を制御する関数
  function controlGroupVisibilityAndOpenState(record) {
    // 客先名IDフィールドの値を取得
    const customerId = record['客先名ID'].value;

    // 各グループのフィールドコード
    const groupDaidou = 'G作業後見積_大同';
    const groupDST = 'G作業後見積_DST';
    const groupShoriIppan = 'G作業後処理_一般';

    // まず、全てのグループを非表示にし、かつ折りたたむ
    kintone.app.record.setFieldShown(groupDaidou, false);
    kintone.app.record.setGroupFieldOpen(groupDaidou, false);

    kintone.app.record.setFieldShown(groupDST, false);
    kintone.app.record.setGroupFieldOpen(groupDST, false);

    kintone.app.record.setFieldShown(groupShoriIppan, false);
    kintone.app.record.setGroupFieldOpen(groupShoriIppan, false);

    switch (customerId) {
      case '1':
        // 1. 客先名IDが'1'の時
        // グループ"G作業後見積_大同"を「表示」し、「展開」する
        kintone.app.record.setFieldShown(groupDaidou, true);
        kintone.app.record.setGroupFieldOpen(groupDaidou, true);
        break;
      case '2':
        // 2. 客先名IDが'2'の時
        // グループ"G作業後見積_DST"を「表示」し、「展開」する
        kintone.app.record.setFieldShown(groupDST, true);
        kintone.app.record.setGroupFieldOpen(groupDST, true);
        break;
      default:
        // 3. 客先名IDが'1と2以外'の時
        // グループ"G作業後処理_一般"を「表示」し、「展開」する
        kintone.app.record.setFieldShown(groupShoriIppan, true);
        kintone.app.record.setGroupFieldOpen(groupShoriIppan, true);
        break;
    }
  }

  // レコードの読み込み時に実行
  kintone.events.on(['app.record.detail.show', 'app.record.create.show', 'app.record.edit.show'], function(event) {
    controlGroupVisibilityAndOpenState(event.record);
    return event;
  });

  // "客先名ID"が変更されたときに実行
  kintone.events.on(['app.record.create.change.客先名ID', 'app.record.edit.change.客先名ID'], function(event) {
    controlGroupVisibilityAndOpenState(event.record);
    return event;
  });

})();