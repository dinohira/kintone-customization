(function () {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  var CONFIG = {
    MATERIAL_APP_ID: 331,
    FIELDS: {
      HEADER_MID_CLASS: 'L素材中分類',
      HEADER_GRAVITY: '簡易比重',
      TABLE_AREA: 'T面積計算',
      TABLE_SMALL_CLASS: 'L小分類',
      TABLE_CALC_PRICE: '計算単価'
    }
  };

  // ============================================================
  // データキャッシュ
  // ============================================================
  var materialCache = null;
  var midClassMap = null;    // { midName: { gravity, bigClass } }
  var smallClassMap = null;  // { smallName: { calcPrice, midClass } }
  var observer = null;

  /**
   * アプリ331から全レコードを取得してキャッシュ
   */
  function fetchMaterialData() {
    if (materialCache) return Promise.resolve(materialCache);

    var allRecords = [];

    function fetchPage(offset) {
      return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
        app: CONFIG.MATERIAL_APP_ID,
        query: 'order by 素材大分類 asc, 素材中分類 asc, 素材小分類 asc limit 500 offset ' + offset,
        fields: [
          '素材コード', '素材大分類', '素材中分類', '素材小分類',
          'R対象顧客区分', '客先名', 'R単価種類',
          '面積単価', '既定単価', '重量単価', '一式単価', '計算単価',
          '簡易比重', '屑分類', '屑分類区分', '単位'
        ]
      }).then(function (resp) {
        allRecords = allRecords.concat(resp.records);
        if (resp.records.length < 500) return allRecords;
        return fetchPage(offset + 500);
      });
    }

    return fetchPage(0).then(function (records) {
      materialCache = records;

      midClassMap = {};
      records.forEach(function (r) {
        var mid = r['素材中分類'].value;
        if (!midClassMap[mid]) {
          midClassMap[mid] = {
            gravity: r['簡易比重'].value || '',
            bigClass: r['素材大分類'].value || ''
          };
        }
      });

      smallClassMap = {};
      records.forEach(function (r) {
        var small = r['素材小分類'].value;
        if (small) {
          smallClassMap[small] = {
            calcPrice: r['計算単価'].value || '',
            midClass: r['素材中分類'].value || '',
            areaPrice: r['面積単価'].value || '',
            fixedPrice: r['既定単価'].value || '',
            weightPrice: r['重量単価'].value || ''
          };
        }
      });

      return records;
    });
  }

  // ============================================================
  // DOM操作ヘルパー
  // ============================================================

  function findFieldByLabel(labelText) {
    var labels = document.querySelectorAll('.control-label-text-gaia');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.trim() === labelText) {
        return labels[i].closest('.control-gaia');
      }
    }
    return null;
  }

  /**
   * 現在選択中の素材中分類を取得
   */
  function getCurrentMidClass() {
    try {
      var rec = kintone.app.record.get();
      return rec.record[CONFIG.FIELDS.HEADER_MID_CLASS].value || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 指定中分類でフィルタされた小分類リストを取得
   */
  function getFilteredSmallClasses(midClass) {
    if (!materialCache) return [];
    var seen = {};
    var result = [];
    materialCache.forEach(function (r) {
      var small = r['素材小分類'].value;
      var mid = r['素材中分類'].value;
      if (small && !seen[small] && (!midClass || mid === midClass)) {
        seen[small] = true;
        result.push({
          name: small,
          midClass: mid,
          calcPrice: r['計算単価'].value || ''
        });
      }
    });
    result.sort(function (a, b) { return a.name.localeCompare(b.name, 'ja'); });
    return result;
  }

  // ============================================================
  // 共通スタイルファクトリ
  // ============================================================
  var STYLES = {
    headerBar: [
      'display:inline-flex', 'align-items:center', 'gap:12px',
      'padding:8px 16px',
      'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      'border-radius:8px', 'margin:8px 0 4px 0',
      'box-shadow:0 2px 8px rgba(102,126,234,0.3)'
    ].join(';'),
    tableBar: [
      'display:inline-flex', 'align-items:center', 'gap:8px',
      'padding:4px 10px',
      'background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%)',
      'border-radius:6px', 'margin:2px 0',
      'box-shadow:0 2px 6px rgba(17,153,142,0.25)'
    ].join(';'),
    label: 'color:#fff;font-weight:600;font-size:13px;white-space:nowrap',
    select: [
      'min-width:200px', 'padding:6px 10px',
      'border:2px solid rgba(255,255,255,0.3)',
      'border-radius:5px', 'background:rgba(255,255,255,0.95)',
      'font-size:13px', 'cursor:pointer', 'outline:none'
    ].join(';'),
    clearBtn: [
      'background:rgba(255,255,255,0.2)',
      'border:1px solid rgba(255,255,255,0.4)',
      'color:#fff', 'border-radius:4px',
      'padding:4px 8px', 'cursor:pointer', 'font-size:13px'
    ].join(';')
  };

  // ============================================================
  // ヘッダー: 素材中分類ドロップダウン
  // ============================================================

  function createMidClassDropdown(currentValue) {
    var container = document.createElement('div');
    container.id = 'material-selector-container';
    container.style.cssText = STYLES.headerBar;

    var label = document.createElement('span');
    label.innerHTML = '&#x1F4E6; 素材中分類';
    label.style.cssText = STYLES.label;

    var select = document.createElement('select');
    select.id = 'material-mid-class-select';
    select.style.cssText = STYLES.select;
    select.style.minWidth = '320px';

    var defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- 素材中分類を選択 --';
    select.appendChild(defaultOpt);

    if (midClassMap) {
      var grouped = {};
      Object.keys(midClassMap).forEach(function (mid) {
        var big = midClassMap[mid].bigClass || '(未分類)';
        if (!grouped[big]) grouped[big] = [];
        grouped[big].push(mid);
      });

      Object.keys(grouped).sort(function (a, b) {
        return a.localeCompare(b, 'ja');
      }).forEach(function (big) {
        var optgroup = document.createElement('optgroup');
        optgroup.label = '【' + big + '】';
        grouped[big].sort(function (a, b) {
          return a.localeCompare(b, 'ja');
        }).forEach(function (mid) {
          var opt = document.createElement('option');
          opt.value = mid;
          opt.textContent = mid;
          if (mid === currentValue) opt.selected = true;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });
    }

    select.addEventListener('change', function () {
      handleMidClassChange(this.value);
      // 中分類変更時にテーブル内ドロップダウンも更新
      setTimeout(refreshAllSmallClassDropdowns, 100);
    });

    container.appendChild(label);
    container.appendChild(select);

    var clearBtn = document.createElement('button');
    clearBtn.textContent = '\u2715';
    clearBtn.title = 'クリア';
    clearBtn.style.cssText = STYLES.clearBtn;
    clearBtn.addEventListener('click', function () {
      select.value = '';
      handleMidClassChange('');
      setTimeout(refreshAllSmallClassDropdowns, 100);
    });
    container.appendChild(clearBtn);

    return container;
  }

  function handleMidClassChange(val) {
    var rec = kintone.app.record.get();
    if (val && midClassMap[val]) {
      rec.record[CONFIG.FIELDS.HEADER_MID_CLASS].value = val;
      rec.record[CONFIG.FIELDS.HEADER_GRAVITY].value = midClassMap[val].gravity;
    } else {
      rec.record[CONFIG.FIELDS.HEADER_MID_CLASS].value = '';
      rec.record[CONFIG.FIELDS.HEADER_GRAVITY].value = '';
    }
    kintone.app.record.set(rec);
  }

  function insertMidClassDropdown(record) {
    var existing = document.getElementById('material-selector-container');
    if (existing) existing.remove();

    var currentValue = record[CONFIG.FIELDS.HEADER_MID_CLASS].value || '';
    var fieldRow = findFieldByLabel('素材中分類');

    if (fieldRow) {
      var dropdown = createMidClassDropdown(currentValue);
      fieldRow.parentNode.insertBefore(dropdown, fieldRow);
    }
  }

  // ============================================================
  // サブテーブル: L小分類ドロップダウン
  // ============================================================

  /**
   * サブテーブルの特定行にドロップダウンを挿入
   */
  function insertSmallClassDropdownInRow(row, rowIndex) {
    // 既にドロップダウンがあればスキップ
    if (row.querySelector('.small-class-dropdown-container')) return;

    // L小分類のセルを探す（ラベル「小分類」を持つセル）
    var labels = row.querySelectorAll('.control-label-text-gaia');
    var targetCell = null;
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.trim() === '小分類') {
        targetCell = labels[i].closest('.control-gaia');
        break;
      }
    }
    if (!targetCell) return;

    // 現在の値を取得
    var currentValue = '';
    try {
      var rec = kintone.app.record.get();
      var table = rec.record[CONFIG.FIELDS.TABLE_AREA].value;
      if (table[rowIndex]) {
        currentValue = table[rowIndex].value[CONFIG.FIELDS.TABLE_SMALL_CLASS].value || '';
      }
    } catch (e) { /* ignore */ }

    var midClass = getCurrentMidClass();
    var smallClasses = getFilteredSmallClasses(midClass);

    var container = document.createElement('div');
    container.className = 'small-class-dropdown-container';
    container.style.cssText = STYLES.tableBar;

    var label = document.createElement('span');
    label.innerHTML = '&#x1F527; 小分類';
    label.style.cssText = STYLES.label;
    label.style.fontSize = '12px';

    var select = document.createElement('select');
    select.className = 'small-class-select';
    select.setAttribute('data-row-index', rowIndex);
    select.style.cssText = STYLES.select;
    select.style.minWidth = '180px';
    select.style.fontSize = '12px';

    populateSmallClassOptions(select, smallClasses, currentValue);

    select.addEventListener('change', function () {
      var idx = parseInt(this.getAttribute('data-row-index'), 10);
      handleSmallClassChange(this.value, idx);
    });

    container.appendChild(label);
    container.appendChild(select);

    // クリアボタン
    var clearBtn = document.createElement('button');
    clearBtn.textContent = '\u2715';
    clearBtn.style.cssText = STYLES.clearBtn;
    clearBtn.style.padding = '3px 6px';
    clearBtn.style.fontSize = '12px';
    clearBtn.addEventListener('click', function () {
      select.value = '';
      var idx = parseInt(select.getAttribute('data-row-index'), 10);
      handleSmallClassChange('', idx);
    });
    container.appendChild(clearBtn);

    targetCell.parentNode.insertBefore(container, targetCell);
  }

  /**
   * select要素に小分類オプションを設定
   */
  function populateSmallClassOptions(select, smallClasses, currentValue) {
    // 既存のオプションをクリア
    select.innerHTML = '';

    var defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- 小分類を選択 --';
    select.appendChild(defaultOpt);

    // 中分類でグルーピング
    var grouped = {};
    smallClasses.forEach(function (sc) {
      var mid = sc.midClass || '(未分類)';
      if (!grouped[mid]) grouped[mid] = [];
      grouped[mid].push(sc);
    });

    var midKeys = Object.keys(grouped).sort(function (a, b) {
      return a.localeCompare(b, 'ja');
    });

    if (midKeys.length === 1) {
      // 1つの中分類のみ → グループなし
      grouped[midKeys[0]].forEach(function (sc) {
        var opt = document.createElement('option');
        opt.value = sc.name;
        opt.textContent = sc.name + (sc.calcPrice ? ' (¥' + Number(sc.calcPrice).toLocaleString() + ')' : '');
        if (sc.name === currentValue) opt.selected = true;
        select.appendChild(opt);
      });
    } else {
      // 複数中分類 → optgroupで分類
      midKeys.forEach(function (mid) {
        var optgroup = document.createElement('optgroup');
        optgroup.label = mid;
        grouped[mid].forEach(function (sc) {
          var opt = document.createElement('option');
          opt.value = sc.name;
          opt.textContent = sc.name + (sc.calcPrice ? ' (¥' + Number(sc.calcPrice).toLocaleString() + ')' : '');
          if (sc.name === currentValue) opt.selected = true;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });
    }
  }

  /**
   * 小分類選択変更ハンドラ
   */
  function handleSmallClassChange(val, rowIndex) {
    var rec = kintone.app.record.get();
    var table = rec.record[CONFIG.FIELDS.TABLE_AREA].value;

    if (!table[rowIndex]) return;

    if (val && smallClassMap && smallClassMap[val]) {
      table[rowIndex].value[CONFIG.FIELDS.TABLE_SMALL_CLASS].value = val;
      table[rowIndex].value[CONFIG.FIELDS.TABLE_CALC_PRICE].value = smallClassMap[val].calcPrice;
    } else {
      table[rowIndex].value[CONFIG.FIELDS.TABLE_SMALL_CLASS].value = '';
      table[rowIndex].value[CONFIG.FIELDS.TABLE_CALC_PRICE].value = '';
    }

    kintone.app.record.set(rec);
  }

  /**
   * 全サブテーブル行のドロップダウンを挿入/更新
   */
  function refreshAllSmallClassDropdowns() {
    var subtable = document.querySelector('.subtable-gaia[data-subtable-field-code="' + CONFIG.FIELDS.TABLE_AREA + '"]');
    if (!subtable) {
      // data-subtable-field-codeが使えない場合、ラベルから探す
      var allSubtables = document.querySelectorAll('.subtable-gaia');
      for (var s = 0; s < allSubtables.length; s++) {
        var headerLabels = allSubtables[s].querySelectorAll('.subtable-label-gaia');
        for (var h = 0; h < headerLabels.length; h++) {
          if (headerLabels[h].textContent.includes('面積計算')) {
            subtable = allSubtables[s];
            break;
          }
        }
        if (subtable) break;
      }
    }

    if (!subtable) {
      // フォールバック: 小分類ラベルを含むsubtable行を探す
      var allRows = document.querySelectorAll('.subtable-row-gaia');
      allRows.forEach(function (row, idx) {
        var hasSmallClass = false;
        var labels = row.querySelectorAll('.control-label-text-gaia');
        for (var l = 0; l < labels.length; l++) {
          if (labels[l].textContent.trim() === '小分類') {
            hasSmallClass = true;
            break;
          }
        }
        if (hasSmallClass) {
          insertSmallClassDropdownInRow(row, idx);
        }
      });
      return;
    }

    var rows = subtable.querySelectorAll('.subtable-row-gaia');
    var midClass = getCurrentMidClass();
    var smallClasses = getFilteredSmallClasses(midClass);

    rows.forEach(function (row, idx) {
      var existingDropdown = row.querySelector('.small-class-dropdown-container');
      if (existingDropdown) {
        // 既存ドロップダウンのオプションを更新
        var select = existingDropdown.querySelector('.small-class-select');
        if (select) {
          var currentVal = select.value;
          select.setAttribute('data-row-index', idx);
          populateSmallClassOptions(select, smallClasses, currentVal);
        }
      } else {
        insertSmallClassDropdownInRow(row, idx);
      }
    });
  }

  // ============================================================
  // MutationObserver: 行追加を検知
  // ============================================================

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(function (mutations) {
      var needsRefresh = false;
      mutations.forEach(function (m) {
        if (m.addedNodes.length > 0) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var node = m.addedNodes[i];
            if (node.nodeType === 1 && (
              node.classList.contains('subtable-row-gaia') ||
              node.querySelector && node.querySelector('.subtable-row-gaia')
            )) {
              needsRefresh = true;
            }
          }
        }
      });
      if (needsRefresh) {
        setTimeout(refreshAllSmallClassDropdowns, 200);
      }
    });

    var formEl = document.querySelector('.gaia-argoui-app-edit-pane') ||
                 document.querySelector('.gaia-argoui-app') ||
                 document.body;
    observer.observe(formEl, { childList: true, subtree: true });
  }

  // ============================================================
  // イベント登録
  // ============================================================

  kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show'
  ], function (event) {
    fetchMaterialData().then(function () {
      // ヘッダー: 素材中分類ドロップダウン
      insertMidClassDropdown(event.record);
      // サブテーブル: L小分類ドロップダウン
      setTimeout(refreshAllSmallClassDropdowns, 300);
      // 行追加監視
      startObserver();
    }).catch(function (e) {
      console.error('[material-selector] データ取得エラー:', e);
    });
    return event;
  });

  // L素材中分類変更イベント → 簡易比重 + ドロップダウン同期
  kintone.events.on([
    'app.record.create.change.' + CONFIG.FIELDS.HEADER_MID_CLASS,
    'app.record.edit.change.' + CONFIG.FIELDS.HEADER_MID_CLASS
  ], function (event) {
    var mid = event.record[CONFIG.FIELDS.HEADER_MID_CLASS].value;
    if (mid && midClassMap && midClassMap[mid]) {
      event.record[CONFIG.FIELDS.HEADER_GRAVITY].value = midClassMap[mid].gravity;
    }
    var sel = document.getElementById('material-mid-class-select');
    if (sel) sel.value = mid || '';
    // 小分類ドロップダウンをフィルタ更新
    setTimeout(refreshAllSmallClassDropdowns, 100);
    return event;
  });

  // L小分類変更イベント（ルックアップ経由の場合） → 計算単価連動
  kintone.events.on([
    'app.record.create.change.' + CONFIG.FIELDS.TABLE_SMALL_CLASS,
    'app.record.edit.change.' + CONFIG.FIELDS.TABLE_SMALL_CLASS
  ], function (event) {
    var row = event.changes.row;
    if (!row) return event;
    var small = row.value[CONFIG.FIELDS.TABLE_SMALL_CLASS].value;
    if (small && smallClassMap && smallClassMap[small]) {
      row.value[CONFIG.FIELDS.TABLE_CALC_PRICE].value = smallClassMap[small].calcPrice;
    }
    return event;
  });

})();
