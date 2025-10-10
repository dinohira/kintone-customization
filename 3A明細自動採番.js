(function() {
  'use strict';

  const FIELD_PAGECOUNT = 'Tページカウント';
  const FIELD_PAGE = 'ページ';
  const FIELD_SHORIYM = '処理年月';

  // ページフィールドを編集不可にする
  function setPageFieldReadOnly(record) {
    record[FIELD_PAGE].disabled = true;
  }

  // 新規・編集画面表示時、「ページ」フィールドを編集不可
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {
    setPageFieldReadOnly(event.record);
    return event;
  });

  // 保存時にカウント自動採番
  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], async function(event) {
    const value = event.record[FIELD_PAGECOUNT].value;
    if (!value) {
      event.record[FIELD_PAGE].value = '';
      setPageFieldReadOnly(event.record);
      return event;
    }

    // 「処理年月」で降順に取得（同じTページカウント内で一番新しいものを見つける）
    const query = `${FIELD_PAGECOUNT} = "${value}" order by ${FIELD_SHORIYM} desc limit 1`;
    const params = {
      app: kintone.app.getId(),
      query: query,
      fields: [FIELD_PAGE]
    };

    try {
      const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params);
      let newPage = 1;
      if (resp.records && resp.records.length > 0 && resp.records[0][FIELD_PAGE].value) {
        newPage = Number(resp.records[0][FIELD_PAGE].value) + 1;
      }
      event.record[FIELD_PAGE].value = newPage;
      setPageFieldReadOnly(event.record);
      return event;
    } catch (err) {
      event.record[FIELD_PAGE].value = 1;
      setPageFieldReadOnly(event.record);
      return event;
    }
  });

})();
