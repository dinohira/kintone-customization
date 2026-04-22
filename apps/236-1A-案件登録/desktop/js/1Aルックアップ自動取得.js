(function() {
  'use strict';

  const TARGET_APP_ID = 236;
  const LOOKUP_FIELD_CODES = [
    'L客先選択',
    'L作業種別',
    'Lポール',
    'L素材中分類',
    'L素材小分類',
    'L輸送方法',
    '屑分類'
  ];

  const triggeredLookups = new Set();

  const isEmptyValue = (value) => {
    if (value === null || typeof value === 'undefined') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'string') {
      return value === '';
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  };

  /** カスケードルックアップが完了済みかどうか判定 */
  const isCascadeCompleted = () => {
    try { return sessionStorage.getItem('cascadeLookupCompleted_236') === 'true'; } catch(e) { return false; }
  };

  const enableLookupFetch = (record, fieldCode) => {
    const field = record[fieldCode];
    if (!field || isEmptyValue(field.value) || triggeredLookups.has(fieldCode)) {
      return;
    }
    // カスケードルックアップでL客先選択のコピーフィールドが既に埋まっている場合はスキップ
    if (fieldCode === 'L客先選択' && isCascadeCompleted()) {
      triggeredLookups.add(fieldCode);
      return;
    }
    field.lookup = true;
    triggeredLookups.add(fieldCode);
  };

  const isTargetApp = () => {
    const appId = kintone.app && kintone.app.getId && Number(kintone.app.getId());
    return appId === TARGET_APP_ID;
  };

  let lookupMonitorTimer = null;

  const stopLookupMonitor = () => {
    if (lookupMonitorTimer) {
      clearInterval(lookupMonitorTimer);
      lookupMonitorTimer = null;
    }
  };

  const monitorLookupFields = () => {
    stopLookupMonitor();
    const start = Date.now();
    const timeout = 10000;
    const intervalMs = 300;

    lookupMonitorTimer = setInterval(() => {
      const wrapper = kintone.app && kintone.app.record && kintone.app.record.get && kintone.app.record.get();
      if (!wrapper || !wrapper.record) {
        if (Date.now() - start > timeout) {
          stopLookupMonitor();
        }
        return;
      }

      const record = wrapper.record;
      let updated = false;

      LOOKUP_FIELD_CODES.forEach((code) => {
        const field = record[code];
        if (!field || isEmptyValue(field.value) || triggeredLookups.has(code)) {
          return;
        }
        // カスケードルックアップ完了済みならL客先選択のlookup取得をスキップ
        if (code === 'L客先選択' && isCascadeCompleted()) {
          triggeredLookups.add(code);
          return;
        }
        field.lookup = true;
        triggeredLookups.add(code);
        updated = true;
      });

      if (updated) {
        kintone.app.record.set({ record });
      }

      const shouldContinue = LOOKUP_FIELD_CODES.some((code) => {
        const field = record[code];
        if (!field || isEmptyValue(field.value)) {
          return false;
        }
        return !triggeredLookups.has(code);
      });

      if (!shouldContinue || Date.now() - start > timeout) {
        stopLookupMonitor();
      }
    }, intervalMs);
  };

  const formEvents = ['app.record.create.show', 'app.record.edit.show'];
  kintone.events.on(formEvents, (event) => {
    if (!isTargetApp()) {
      return event;
    }
    triggeredLookups.clear();
    const record = event.record;
    LOOKUP_FIELD_CODES.forEach((code) => enableLookupFetch(record, code));
    monitorLookupFields();
    return event;
  });

  const changeEvents = LOOKUP_FIELD_CODES.map((code) => `app.record.change.${code}`);
  kintone.events.on(changeEvents, (event) => {
    if (!isTargetApp()) {
      return event;
    }
    if (!event.changes || !event.changes.field || !event.changes.field.code) {
      return event;
    }
    const code = event.changes.field.code;
    triggeredLookups.delete(code);
    enableLookupFetch(event.record, code);
    return event;
  });

  const teardownEvents = [
    'app.record.create.submit',
    'app.record.create.submit.success',
    'app.record.create.cancel',
    'app.record.edit.submit',
    'app.record.edit.submit.success',
    'app.record.edit.cancel'
  ];
  kintone.events.on(teardownEvents, (event) => {
    if (isTargetApp()) {
      stopLookupMonitor();
      triggeredLookups.clear();
    }
    return event;
  });
})();
