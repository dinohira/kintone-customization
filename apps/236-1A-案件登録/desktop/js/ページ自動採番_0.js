(function() {
  'use strict';

  const FIELD_PAGECOUNT = 'Tページカウント';
  const FIELD_PAGE = 'ページ';
  const FIELD_MANAGE_NO = '案件管理番号';
  const FIELD_ESTIMATE_NO = '見積管理番号';
  const FIELD_SHORTNAME = '略称';
  const FIELD_DATE = '登録日';

  function setPageFieldReadOnly(record) {
    record[FIELD_PAGE].disabled = true;
  }

  // 日付を"YYYYMMdd"形式に変換
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}${m}${d}`;
  }

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {
    setPageFieldReadOnly(event.record);
    return event;
  });

  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], async function(event) {
    const value = event.record[FIELD_PAGECOUNT].value;
    if (!value) {
      event.record[FIELD_PAGE].value = '';
      event.record[FIELD_MANAGE_NO].value = '';
      setPageFieldReadOnly(event.record);
      return event;
    }

    const query = `${FIELD_PAGECOUNT} = "${value}" order by 登録日 desc limit 1`;
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

      // 案件管理番号のロジック
      const estimateNo = event.record[FIELD_ESTIMATE_NO].value || '';
      if (estimateNo === '') {
        const shortName = event.record[FIELD_SHORTNAME].value || '';
        const dateRaw = event.record[FIELD_DATE].value || '';
        const pageNo = newPage;
        const dateStr = formatDate(dateRaw);
        event.record[FIELD_MANAGE_NO].value = `${shortName}_${dateStr}_${pageNo}`;
      } else {
        event.record[FIELD_MANAGE_NO].value = estimateNo;
      }

      setPageFieldReadOnly(event.record);
      return event;
    } catch (err) {
      event.record[FIELD_PAGE].value = 1;

      // 案件管理番号のロジック（エラー時も同様）
      const estimateNo = event.record[FIELD_ESTIMATE_NO].value || '';
      if (estimateNo === '') {
        const shortName = event.record[FIELD_SHORTNAME].value || '';
        const dateRaw = event.record[FIELD_DATE].value || '';
        const pageNo = 1;
        const dateStr = formatDate(dateRaw);
        event.record[FIELD_MANAGE_NO].value = `${shortName}_${dateStr}_${pageNo}`;
      } else {
        event.record[FIELD_MANAGE_NO].value = estimateNo;
      }

      setPageFieldReadOnly(event.record);
      return event;
    }
  });

})();
