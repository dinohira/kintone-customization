(function() {
  'use strict';
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {
    // 独自のURLパラメータ「initialValues」を取得
    var params = new URLSearchParams(window.location.search);
    var initialValuesStr = params.get('initialValues');
    
    if (initialValuesStr) {
      try {
        // JSON文字列をオブジェクトに変換
        var initialValues = JSON.parse(initialValuesStr);
        
        // 渡されたフィールドの値をセット
        Object.keys(initialValues).forEach(function(fieldCode) {
          if (event.record[fieldCode]) {
            event.record[fieldCode].value = initialValues[fieldCode].value;
            
            // ルックアップ対象フィールドの場合は自動取得フラグを立てる
            if (fieldCode === 'L素材大分類' || fieldCode === '素材中分類') {
              event.record[fieldCode].lookup = true;
            }
          }
        });
      } catch (e) {
        console.error('初期値のパースに失敗しました', e);
      }
    }
    return event;
  });
})();
