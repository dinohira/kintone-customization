/**
 * LKD Engine 窶・Lookup-to-Dropdown 螟画鋤繧ｨ繝ｳ繧ｸ繝ｳ
 *
 * kintone 縺ｮ繝ｫ繝・け繧｢繝・・繝輔ぅ繝ｼ繝ｫ繝峨ｒ縲√ヵ繧｣繝ｫ繧ｿ繝ｼ騾｣蜍輔・繧ｫ繧ｹ繧ｿ繝繝峨Ο繝・・繝繧ｦ繝ｳ縺ｫ
 * 螟画鋤縺吶ｋ蜀榊茜逕ｨ蜿ｯ閭ｽ縺ｪ繝ｩ繧､繝悶Λ繝ｪ縲ゅΝ繝ｼ繝医ヵ繧｣繝ｼ繝ｫ繝峨・繧ｵ繝悶ユ繝ｼ繝悶Ν蜀・ヵ繧｣繝ｼ繝ｫ繝峨・
 * 荳｡譁ｹ縺ｫ蟇ｾ蠢懊＠縲√が繝励す繝ｧ繝ｳ縺ｧ繝帙ヰ繝ｼ繝・・繝ｫ繝√ャ繝励ｂ陦ｨ遉ｺ蜿ｯ閭ｽ縲・ *
 * 菴ｿ縺・婿:
 *   kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function (event) {
 *       LkdEngine.init({
 *           'LookupFieldCode': {
 *               label:          '繝輔ぅ繝ｼ繝ｫ繝峨Λ繝吶Ν',
 *               location:       'root' | 'subtable',
 *               subtable:       '繧ｵ繝悶ユ繝ｼ繝悶Ν繝輔ぅ繝ｼ繝ｫ繝峨さ繝ｼ繝・,  // location=subtable 縺ｮ蝣ｴ蜷亥ｿ・・ *               refApp:         123,                              // 蜿ら・蜈医い繝励ΜID
 *               refKeyField:    '蜿ら・蜈医く繝ｼ繝輔ぅ繝ｼ繝ｫ繝・,
 *               displayField:   '陦ｨ遉ｺ逕ｨ繝輔ぅ繝ｼ繝ｫ繝・,
 *               filterField:    '繝輔ぅ繝ｫ繧ｿ繝ｼ蜈・ヵ繧｣繝ｼ繝ｫ繝会ｼ郁・繧｢繝励Μ・・,
 *               filterFieldRef: '繝輔ぅ繝ｫ繧ｿ繝ｼ蜈医ヵ繧｣繝ｼ繝ｫ繝会ｼ亥盾辣ｧ蜈医い繝励Μ・・,
 *               emptyMessage:   '繝輔ぅ繝ｫ繧ｿ繝ｼ譛ｪ險ｭ螳壽凾縺ｮ繝｡繝・そ繝ｼ繧ｸ',
 *               tooltipField:   '繝・・繝ｫ繝√ャ繝苓｡ｨ遉ｺ繝輔ぅ繝ｼ繝ｫ繝会ｼ亥盾辣ｧ蜈医い繝励Μ・・, // 逵∫払蜿ｯ
 *               enableReset:    true,                                         // 逵∫払蜿ｯ・壹Μ繧ｻ繝・ヨ繝懊ち繝ｳ陦ｨ遉ｺ
 *               enableNewRecord: true,                                        // 逵∫払蜿ｯ・壽眠隕丈ｽ懈・繝懊ち繝ｳ陦ｨ遉ｺ
 *               fieldMappings:  [{ to: '閾ｪ繧｢繝励Μ繝輔ぅ繝ｼ繝ｫ繝・, from: '蜿ら・蜈医ヵ繧｣繝ｼ繝ｫ繝・ }],
 *               onChange:       function(fieldCode, value, record) { ... }     // 逵∫払蜿ｯ・壼､螟画峩譎ゅさ繝ｼ繝ｫ繝舌ャ繧ｯ
 *           }
 *       });
 *       return event;
 *   });
 *
 * @version 2.1.0
 * @date 2026-04-16
 */
(function () {
    'use strict';

    // =================================================================
    // CONSTANTS
    // =================================================================
    var SEL_CLS = 'lkd-select';
    var STYLE_ID = 'lkd-styles';
    var LKD_OVERLAY_ID = 'lkd-overlay-container';

    var STYLES = '\
        select.' + SEL_CLS + ' {\
            font-size: 14px;\
            padding: 4px 8px;\
            border: 1px solid #e3e7e8;\
            border-radius: 4px;\
            background-color: #fff;\
            color: #333;\
            min-width: 200px;\
            max-width: 100%;\
            height: 32px;\
            cursor: pointer;\
            outline: none;\
            transition: border-color 0.2s;\
        }\
        select.' + SEL_CLS + ':hover:not(:disabled) {\
            border-color: #b0b6b8;\
        }\
        select.' + SEL_CLS + ':focus {\
            border-color: #3498db;\
            box-shadow: 0 0 0 1px rgba(52, 152, 219, 0.3);\
        }\
        select.' + SEL_CLS + ':disabled {\
            background-color: #f5f6f6;\
            color: #999;\
            cursor: not-allowed;\
            font-style: italic;\
        }\
        .lkd-custom-wrap {\
            display: inline-block;\
            position: relative;\
            min-width: 200px;\
            max-width: 100%;\
        }\
        .lkd-trigger {\
            display: flex;\
            align-items: center;\
            justify-content: space-between;\
            padding: 4px 8px;\
            border: 1px solid #e3e7e8;\
            border-radius: 4px;\
            background-color: #fff;\
            color: #333;\
            height: 32px;\
            cursor: pointer;\
            font-size: 14px;\
            box-sizing: border-box;\
            transition: border-color 0.2s;\
            user-select: none;\
        }\
        .lkd-trigger:hover {\
            border-color: #b0b6b8;\
        }\
        .lkd-custom-wrap.lkd-open .lkd-trigger {\
            border-color: #3498db;\
            box-shadow: 0 0 0 1px rgba(52, 152, 219, 0.3);\
        }\
        .lkd-custom-wrap.lkd-disabled .lkd-trigger {\
            background-color: #f5f6f6;\
            color: #999;\
            cursor: not-allowed;\
            font-style: italic;\
        }\
        .lkd-trigger-text {\
            overflow: hidden;\
            text-overflow: ellipsis;\
            white-space: nowrap;\
            flex: 1;\
        }\
        .lkd-trigger-arrow {\
            margin-left: 8px;\
            color: #999;\
            font-size: 12px;\
            flex-shrink: 0;\
        }\
        .lkd-panel {\
            position: fixed;\
            background: #fff;\
            border: 1px solid #d0d7de;\
            border-radius: 6px;\
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);\
            max-height: 260px;\
            overflow-y: auto;\
            overscroll-behavior: contain;\
            z-index: 100000;\
        }\
        .lkd-option {\
            padding: 7px 12px;\
            cursor: pointer;\
            font-size: 14px;\
            white-space: nowrap;\
            transition: background-color 0.1s;\
        }\
        .lkd-option:hover {\
            background-color: #e8f4fd;\
        }\
        .lkd-option.lkd-option-selected {\
            background-color: #d0e6f6;\
            font-weight: 600;\
        }\
        .lkd-tooltip {\
            position: fixed;\
            background: #1a1a2e;\
            color: #e8e8e8;\
            border-radius: 8px;\
            padding: 10px 14px;\
            max-width: 320px;\
            font-size: 13px;\
            z-index: 100001;\
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);\
            pointer-events: none;\
            white-space: pre-wrap;\
            word-break: break-word;\
            line-height: 1.5;\
        }\
        .lkd-tooltip-title {\
            font-weight: 700;\
            font-size: 14px;\
            margin-bottom: 6px;\
            padding-bottom: 6px;\
            border-bottom: 1px solid rgba(255,255,255,0.15);\
            color: #7ec8e3;\
        }\
        .lkd-tooltip-content {\
            color: #d0d0d0;\
        }\
        .lkd-tooltip-empty {\
            color: #888;\
            font-style: italic;\
        }\
        .lkd-field-row {\
            display: flex;\
            align-items: center;\
            gap: 4px;\
        }\
        .lkd-action-btn {\
            display: inline-flex;\
            align-items: center;\
            justify-content: center;\
            width: 32px;\
            height: 32px;\
            border: 1px solid #e3e7e8;\
            border-radius: 4px;\
            background-color: #fff;\
            color: #666;\
            cursor: pointer;\
            flex-shrink: 0;\
            transition: background-color 0.2s, border-color 0.2s, color 0.2s;\
            padding: 0;\
            line-height: 1;\
        }\
        .lkd-action-btn:hover {\
            background-color: #f0f4f8;\
            border-color: #b0b6b8;\
            color: #333;\
        }\
        .lkd-action-btn .material-symbols-outlined {\
            font-size: 20px;\
        }\
        .lkd-action-btn.lkd-btn-reset:hover {\
            background-color: #fff3e0;\
            border-color: #ff9800;\
            color: #e65100;\
        }\
        .lkd-action-btn.lkd-btn-new:hover {\
            background-color: #e3f2fd;\
            border-color: #2196f3;\
            color: #0d47a1;\
        }\
        .lkd-search-wrap {\
            position: sticky;\
            top: 0;\
            background: #fff;\
            padding: 8px;\
            border-bottom: 1px solid #e3e7e8;\
            z-index: 1;\
        }\
        .lkd-search-input {\
            width: 100%;\
            box-sizing: border-box;\
            padding: 6px 10px 6px 30px;\
            border: 1px solid #e3e7e8;\
            border-radius: 4px;\
            font-size: 14px;\
            outline: none;\
            transition: border-color 0.2s;\
            background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%278%27/%3E%3Cline x1=%2721%27 y1=%2721%27 x2=%2716.65%27 y2=%2716.65%27/%3E%3C/svg%3E");\
            background-repeat: no-repeat;\
            background-position: 8px center;\
            background-size: 14px;\
        }\
        .lkd-search-input:focus {\
            border-color: #3498db;\
            box-shadow: 0 0 0 1px rgba(52, 152, 219, 0.3);\
        }\
        .lkd-search-input::placeholder {\
            color: #aaa;\
        }\
        .lkd-no-results {\
            padding: 12px;\
            text-align: center;\
            color: #999;\
            font-size: 13px;\
            font-style: italic;\
        }\
    ';

    // =================================================================
    // STATE・医う繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ縺斐→・・    // =================================================================
    var dataCache = {};
    var lastFilterValues = {};
    var watcherInterval = null;
    var isProcessing = false;
    var lookupDefs = {};

    // 繧ｫ繧ｹ繧ｿ繝繝峨Ο繝・・繝繧ｦ繝ｳ逕ｨ蜈ｱ譛峨が繝ｼ繝舌・繝ｬ繧､邂｡逅・
    var _lkdTooltip = null;
    var _lkdOpenPanel = null;
    var _lkdOpenWrapper = null;

    function getLkdOverlayContainer() {
        var c = document.getElementById(LKD_OVERLAY_ID);
        if (!c) {
            c = document.createElement('div');
            c.id = LKD_OVERLAY_ID;
            document.body.appendChild(c);
        }
        return c;
    }

    function getLkdTooltip() {
        if (!_lkdTooltip || !document.body.contains(_lkdTooltip)) {
            _lkdTooltip = document.createElement('div');
            _lkdTooltip.className = 'lkd-tooltip';
            _lkdTooltip.style.display = 'none';
            getLkdOverlayContainer().appendChild(_lkdTooltip);
        }
        return _lkdTooltip;
    }

    function closeLkdPanel() {
        if (_lkdOpenPanel) {
            _lkdOpenPanel.style.display = 'none';
            if (_lkdOpenWrapper) _lkdOpenWrapper.classList.remove('lkd-open');
            _lkdOpenPanel = null;
            _lkdOpenWrapper = null;
        }
        getLkdTooltip().style.display = 'none';
    }

    // 螟夜Κ繧ｯ繝ｪ繝・け縺ｧ繝代ロ繝ｫ繧帝哩縺倥ｋ
    document.addEventListener('click', function (e) {
        if (_lkdOpenPanel && _lkdOpenWrapper &&
            !_lkdOpenWrapper.contains(e.target) && !_lkdOpenPanel.contains(e.target)) {
            closeLkdPanel();
        }
    });
    // 繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺ｧ繝代ロ繝ｫ繧帝哩縺倥ｋ・医ヱ繝阪Ν蜀・Κ縺ｮ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺ｯ髯､螟厄ｼ・
    document.addEventListener('scroll', function (e) {
        if (_lkdOpenPanel && (e.target === _lkdOpenPanel || _lkdOpenPanel.contains(e.target))) return;
        closeLkdPanel();
    }, true);

    // =================================================================
    // DATA LAYER
    // =================================================================

    /** 蜿ら・蜈医い繝励Μ縺ｮ蜈ｨ繝ｬ繧ｳ繝ｼ繝峨ｒ荳諡ｬ蜿門ｾ励＠繧ｭ繝｣繝・す繝･ */
    async function fetchAllRecords(appId) {
        var allRecords = [];
        var query = 'order by $id asc limit 500';
        var lastId = 0;

        while (true) {
            var q = lastId > 0 ? '$id > ' + lastId + ' ' + query : query;
            var resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: appId,
                query: q
            });
            if (!resp.records || resp.records.length === 0) break;
            allRecords = allRecords.concat(resp.records);
            lastId = resp.records[resp.records.length - 1].$id.value;
            if (resp.records.length < 500) break;
        }
        dataCache[appId] = allRecords;
    }

    // =================================================================
    // FILTER & OPTIONS
    // =================================================================

    /** 蛟､豈碑ｼ・ｼ域枚蟄怜・縺ｨ縺励※・・*/
    function valuesMatch(a, b) {
        return String(a || '') === String(b || '');
    }

    /** 繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､縺ｫ蝓ｺ縺･縺・※蜿ら・蜈医Ξ繧ｳ繝ｼ繝峨ｒ邨槭ｊ霎ｼ縺ｿ */
    function getFilteredRecords(def, filterValue) {
        var records = dataCache[def.refApp] || [];
        if (!filterValue) return [];
        return records.filter(function (r) {
            return valuesMatch(r[def.filterFieldRef]?.value, filterValue);
        });
    }

    /** 邨槭ｊ霎ｼ縺ｿ邨先棡繧偵ラ繝ｭ繝・・繝繧ｦ繝ｳ逕ｨ縺ｮ驕ｸ謚櫁い驟榊・縺ｫ螟画鋤 */
    function buildOptions(def, filteredRecords, currentValue) {
        var options = filteredRecords.map(function (r) {
            return {
                key: String(r[def.refKeyField]?.value || ''),
                display: String(r[def.displayField]?.value || r[def.refKeyField]?.value || ''),
                tooltip: def.tooltipField ? String(r[def.tooltipField]?.value || '') : ''
            };
        });

        // 迴ｾ蝨ｨ蛟､縺後ヵ繧｣繝ｫ繧ｿ繝ｼ邨先棡縺ｫ蜷ｫ縺ｾ繧後↑縺・ｴ蜷医〒繧る∈謚櫁い縺ｨ縺励※谿九☆
        if (currentValue && !options.some(function (o) { return o.key === currentValue; })) {
            options.unshift({ key: currentValue, display: currentValue, tooltip: '' });
        }

        return options;
    }

    // =================================================================
    // DOM HELPERS
    // =================================================================

    /** 繝ｫ繝・け繧｢繝・・繝輔ぅ繝ｼ繝ｫ繝峨・DOM隕∫ｴ繧貞叙蠕暦ｼ医Λ繝吶Ν繝・く繧ｹ繝医〒讀懃ｴ｢縲√Ν繝ｼ繝医・縺ｿ・・*/
    function findLookupFieldElement(labelText) {
        var fields = document.querySelectorAll('.control-gaia');
        for (var i = 0; i < fields.length; i++) {
            var fieldEl = fields[i];
            var label = fieldEl.querySelector('.control-label-text-gaia');
            if (!label || label.textContent.trim() !== labelText) continue;
            if (fieldEl.closest('.subtable-gaia')) continue;
            var hasLookupUI = fieldEl.querySelector('.input-lookup-gaia') ||
                              fieldEl.querySelector('.component-app-lookup-inputlookup');
            var hasOurSelect = fieldEl.querySelector('.' + SEL_CLS);
            var valueArea = fieldEl.querySelector('.control-value-gaia');
            var hasButton = valueArea && valueArea.querySelector('button');
            if (hasLookupUI || hasOurSelect || hasButton) {
                return fieldEl;
            }
        }
        return null;
    }

    /**
     * 繧ｵ繝悶ユ繝ｼ繝悶Ν蜀・・謖・ｮ壹Λ繝吶Ν縺ｮ繝輔ぅ繝ｼ繝ｫ繝吋OM隕∫ｴ繧貞・縺ｦ蜿門ｾ・     * kintone縺ｮ繧ｵ繝悶ユ繝ｼ繝悶Ν縺ｧ縺ｯ繝・・繧ｿ陦後↓繝ｩ繝吶Ν縺檎┌縺・◆繧√・     * 繝倥ャ繝繝ｼ縺ｮ蛻嶺ｽ咲ｽｮ繧堤音螳壹＠縲√ョ繝ｼ繧ｿ陦後・蜷後§蛻励・繧ｻ繝ｫ繧貞叙蠕励☆繧・     */
    function findSubtableFieldElements(labelText) {
        var results = [];
        var subtables = document.querySelectorAll('.subtable-gaia');

        subtables.forEach(function (st) {
            var ths = st.querySelectorAll('thead th');
            var targetColIndex = -1;

            for (var i = 0; i < ths.length; i++) {
                var span = ths[i].querySelector('.subtable-label-inner-gaia');
                var text = span ? span.textContent.trim() : ths[i].textContent.trim();
                if (text === labelText) {
                    targetColIndex = i;
                    break;
                }
            }

            if (targetColIndex < 0) return;

            var rows = st.querySelectorAll('tbody tr');
            rows.forEach(function (row) {
                var tds = row.querySelectorAll('td');
                if (targetColIndex < tds.length) {
                    var controlEl = tds[targetColIndex].querySelector('.control-gaia');
                    if (controlEl) {
                        results.push(controlEl);
                    }
                }
            });
        });

        return results;
    }

    /** 繝ｫ繝・け繧｢繝・・縺ｮ讓呎ｺ剖I繧定ｦ冶ｦ夂噪縺ｫ髱櫁｡ｨ遉ｺ縺ｫ縺吶ｋ・・OM荳翫・谿九☆・昴・繧ｿ繝ｳ繧ｯ繝ｪ繝・け縺ｯ蜍穂ｽ懶ｼ・*/
    function hideLookupUI(fieldEl) {
        // 隕ｪ繧ｳ繝ｳ繝・リ・亥・蜉帶ｬ・ｼ九・繧ｿ繝ｳ・・    
        var lookup = fieldEl.querySelector('.component-app-lookup-inputlookup');
        if (lookup) {
            lookup.style.cssText = 'position:absolute;left:-9999px;height:0;overflow:hidden;opacity:0;pointer-events:none;';
            return;
        }
        // 蜿門ｾ励・繧ｿ繝ｳ蜊倅ｽ・    
        var lookupBtn = fieldEl.querySelector('.input-lookup-gaia');
        if (lookupBtn) {
            var parent = lookupBtn.parentElement;
            if (parent) {
                parent.style.cssText = 'position:absolute;left:-9999px;height:0;overflow:hidden;opacity:0;pointer-events:none;';
            }
        }
    }

    /**
     * 繝阪う繝・ぅ繝悶・繝ｫ繝・け繧｢繝・・縲悟叙蠕励阪ｒ繝励Ο繧ｰ繝ｩ繝逧・↓繝医Μ繧ｬ繝ｼ
     * 繧ｳ繝ｳ繝・リ繧剃ｸ譎ら噪縺ｫ陦ｨ遉ｺ縺励∝・蜉帶ｬ・↓蛟､繧偵そ繝・ヨ縺励※縲悟叙蠕励阪ｒ繧ｯ繝ｪ繝・け
     */
    function triggerNativeLookup(fieldEl, value, callback) {
        if (!value) { if (callback) callback(); return; }

        var container = fieldEl.querySelector('.component-app-lookup-inputlookup');
        if (!container) { if (callback) callback(); return; }

        var input = container.querySelector('input[type="text"]');
        var btn = container.querySelector('.input-lookup-gaia');
        if (!input || !btn) { if (callback) callback(); return; }

        // 1. 繧ｳ繝ｳ繝・リ繧剃ｸ譎ら噪縺ｫ螳悟・陦ｨ遉ｺ・医◆縺縺励Θ繝ｼ繧ｶ繝ｼ縺ｫ隕九∴縺ｪ縺・ｈ縺・ffscreen驟咲ｽｮ・・    
        var origCss = container.style.cssText;
        container.style.cssText = 'position:fixed;left:-5000px;top:0;opacity:0;pointer-events:auto;';

        // 2. 繝阪う繝・ぅ繝門・蜉帛､繧偵そ繝・ヨ
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // 3.縲悟叙蠕励阪・繧ｿ繝ｳ繧偵け繝ｪ繝・け
        setTimeout(function () {
            btn.click();
            console.log('[LKD] ネイティブルックアップ取得トリガー:', value);

            // 4. 蜿門ｾ怜ｮ御ｺ・ｒ蠕・▲縺ｦ縺九ｉ繧ｳ繝ｳ繝・リ繧貞・蠎ｦ髱櫁｡ｨ遉ｺ縺ｫ
            setTimeout(function () {
                container.style.cssText = origCss;
                if (callback) callback();
            }, 1000);
        }, 150);
    }

    /**
     * 繝阪う繝・ぅ繝悶Ν繝・け繧｢繝・・縺ｮ縲後け繝ｪ繧｢縲阪ｒ繝医Μ繧ｬ繝ｼ
     */
    function triggerNativeLookupClear(fieldEl) {
        var container = fieldEl.querySelector('.component-app-lookup-inputlookup');
        if (!container) return;

        var clearBtn = container.querySelector('.input-clear-gaia');
        if (!clearBtn) return;

        var origCss = container.style.cssText;
        container.style.cssText = 'position:fixed;left:-5000px;top:0;opacity:0;pointer-events:auto;';
        clearBtn.click();
        setTimeout(function () {
            container.style.cssText = origCss;
        }, 500);
    }

    /** 繝輔ぅ繝ｼ繝ｫ繝芽ｦ∫ｴ縺ｮ繝舌Μ繝･繝ｼ鬆伜沺繧貞叙蠕・*/
    function getValueArea(fieldEl) {
        return fieldEl.querySelector('.control-value-gaia') || fieldEl;
    }

    /** 繧ｵ繝悶ユ繝ｼ繝悶Ν陦後・繧､繝ｳ繝・ャ繧ｯ繧ｹ繧貞叙蠕・*/
    function getSubtableRowIndex(fieldEl) {
        var rowEl = fieldEl.closest('tr');
        if (!rowEl) return -1;
        var parent = rowEl.parentElement;
        if (!parent) return -1;
        var dataRows = Array.from(parent.children).filter(function (el) {
            return el.tagName === 'TR' && el.querySelector('td');
        });
        return dataRows.indexOf(rowEl);
    }

    // =================================================================
    // DROPDOWN逕滓・
    // =================================================================

    /** select隕∫ｴ縺ｾ縺溘・繧ｫ繧ｹ繧ｿ繝繝峨Ο繝・・繝繧ｦ繝ｳ繧堤函謌・*/
    function createSelect(fieldCode, options, currentValue, emptyMessage, isDisabled, tooltipField, searchable) {
        if (tooltipField || searchable) {
            return createCustomDropdown(fieldCode, options, currentValue, emptyMessage, isDisabled, searchable);
        }

        var select = document.createElement('select');
        select.className = SEL_CLS;
        select.dataset.fieldCode = fieldCode;

        if (isDisabled) {
            var opt = document.createElement('option');
            opt.value = '';
            opt.textContent = emptyMessage;
            select.appendChild(opt);
            select.disabled = true;
        } else if (options.length === 0) {
            var opt2 = document.createElement('option');
            opt2.value = '';
            opt2.textContent = '--- 選択肢がありません ---';
            select.appendChild(opt2);
            select.disabled = true;
        } else {
            var placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '--- 選択してください (' + options.length + '件) ---';
            select.appendChild(placeholder);

            options.forEach(function (item) {
                var opt3 = document.createElement('option');
                opt3.value = item.key;
                opt3.textContent = item.display;
                if (item.key === currentValue) {
                    opt3.selected = true;
                }
                select.appendChild(opt3);
            });
        }

        return select;
    }

    /** 繧ｫ繧ｹ繧ｿ繝繝峨Ο繝・・繝繧ｦ繝ｳ・医・繝舌・繝・・繝ｫ繝√ャ繝嶺ｻ倥″ / 讀懃ｴ｢莉倥″・峨ｒ逕滓・ */
    function createCustomDropdown(fieldCode, options, currentValue, emptyMessage, isDisabled, searchable) {
        var wrapper = document.createElement('div');
        wrapper.className = SEL_CLS + ' lkd-custom-wrap';
        wrapper.dataset.fieldCode = fieldCode;

        var _value = currentValue || '';
        var _disabled = isDisabled;

        Object.defineProperty(wrapper, 'value', {
            get: function () { return _value; },
            set: function (v) { _value = v || ''; updateTriggerText(); }
        });
        Object.defineProperty(wrapper, 'disabled', {
            get: function () { return _disabled; },
            set: function (v) { _disabled = v; wrapper.classList.toggle('lkd-disabled', v); }
        });

        // --- 繝医Μ繧ｬ繝ｼ繝懊ち繝ｳ ---
        var trigger = document.createElement('div');
        trigger.className = 'lkd-trigger';
        var triggerText = document.createElement('span');
        triggerText.className = 'lkd-trigger-text';
        var triggerArrow = document.createElement('span');
        triggerArrow.className = 'lkd-trigger-arrow';
        triggerArrow.textContent = '▼';
        trigger.appendChild(triggerText);
        trigger.appendChild(triggerArrow);
        wrapper.appendChild(trigger);

        // --- 繝峨Ο繝・・繝繧ｦ繝ｳ繝代ロ繝ｫ ---
        var panel = document.createElement('div');
        panel.className = 'lkd-panel';
        panel.style.display = 'none';
        getLkdOverlayContainer().appendChild(panel);
        wrapper._lkdPanel = panel;

        // --- 讀懃ｴ｢繝輔ぅ繝ｼ繝ｫ繝会ｼ・earchable譎ゅ・縺ｿ・・---
        var searchInput = null;
        var noResultsEl = null;
        if (searchable && !isDisabled && options.length > 0) {
            var searchWrap = document.createElement('div');
            searchWrap.className = 'lkd-search-wrap';
            searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'lkd-search-input';
            searchInput.placeholder = '検索...';
            searchInput.addEventListener('click', function (e) { e.stopPropagation(); });
            searchWrap.appendChild(searchInput);
            panel.appendChild(searchWrap);

            noResultsEl = document.createElement('div');
            noResultsEl.className = 'lkd-no-results';
            noResultsEl.textContent = '荳閾ｴ縺吶ｋ驕ｸ謚櫁い縺後≠繧翫∪縺帙ｓ';
            noResultsEl.style.display = 'none';
        }

        // --- 繧ｪ繝励す繝ｧ繝ｳ鬆・岼逕滓・ ---
        var emptyText = _disabled
            ? emptyMessage
            : (options.length === 0
                ? '--- 選択肢がありません ---'
                : '--- 選択してください (' + options.length + '件) ---');

        var emptyOpt = document.createElement('div');
        emptyOpt.className = 'lkd-option' + (!_value ? ' lkd-option-selected' : '');
        emptyOpt.dataset.value = '';
        emptyOpt.textContent = emptyText;
        panel.appendChild(emptyOpt);

        options.forEach(function (item) {
            var opt = document.createElement('div');
            opt.className = 'lkd-option' + (item.key === _value ? ' lkd-option-selected' : '');
            opt.dataset.value = item.key;
            opt.textContent = item.display;

            // 繝・・繝ｫ繝√ャ繝嶺ｻ倥″繝峨Ο繝・・繝繧ｦ繝ｳ縺ｧ縺ｯ蟶ｸ縺ｫ繝帙ヰ繝ｼ繧､繝吶Φ繝医ｒ險ｭ螳・
            opt.addEventListener('mouseenter', function () {
                showLkdTooltip(opt, item.tooltip, item.display);
            });
            opt.addEventListener('mouseleave', function () {
                getLkdTooltip().style.display = 'none';
            });
            panel.appendChild(opt);
        });

        function showLkdTooltip(optEl, text, title) {
            var tip = getLkdTooltip();
            tip.innerHTML = '';
            if (title) {
                var h = document.createElement('div');
                h.className = 'lkd-tooltip-title';
                h.textContent = title;
                tip.appendChild(h);
            }
            var c = document.createElement('div');
            if (text) {
                c.className = 'lkd-tooltip-content';
                c.textContent = text;
            } else {
                c.className = 'lkd-tooltip-content lkd-tooltip-empty';
                c.textContent = '（メモなし）';
            }
            tip.appendChild(c);

            var rect = optEl.getBoundingClientRect();
            tip.style.display = 'block';
            tip.style.left = (rect.right + 8) + 'px';
            tip.style.top = rect.top + 'px';

            var tipRect = tip.getBoundingClientRect();
            if (tipRect.right > window.innerWidth - 10) {
                tip.style.left = (rect.left - tipRect.width - 8) + 'px';
            }
            if (tipRect.bottom > window.innerHeight - 10) {
                tip.style.top = Math.max(10, window.innerHeight - tipRect.height - 10) + 'px';
            }
        }

        function updateTriggerText() {
            if (_disabled) {
                triggerText.textContent = emptyMessage;
                return;
            }
            if (!_value) {
                triggerText.textContent = options.length === 0
                    ? '--- 選択肢がありません ---'
                    : '--- 選択してください (' + options.length + '件) ---';
                return;
            }
            var found = options.find(function (o) { return o.key === _value; });
            triggerText.textContent = found ? found.display : _value;
        }

        // --- 讀懃ｴ｢繝輔ぅ繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ繝ｭ繧ｸ繝・け ---
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                var query = searchInput.value.toLowerCase();
                var optionEls = panel.querySelectorAll('.lkd-option');
                var visibleCount = 0;
                optionEls.forEach(function (optEl) {
                    var val = optEl.dataset.value;
                    if (val === '') {
                        // 繝励Ξ繝ｼ繧ｹ繝帙Ν繝繝ｼ縺ｯ蟶ｸ縺ｫ陦ｨ遉ｺ
                        optEl.style.display = '';
                        return;
                    }
                    var text = optEl.textContent.toLowerCase();
                    var match = !query || text.indexOf(query) !== -1;
                    optEl.style.display = match ? '' : 'none';
                    if (match) visibleCount++;
                });
                if (noResultsEl) {
                    noResultsEl.style.display = (query && visibleCount === 0) ? '' : 'none';
                }
            });
        }

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (_disabled) return;

            if (_lkdOpenPanel === panel) {
                closeLkdPanel();
                return;
            }
            closeLkdPanel();

            // 讀懃ｴ｢繝輔ぅ繝ｼ繝ｫ繝峨ｒ繝ｪ繧ｻ繝・ヨ
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }

            var rect = wrapper.getBoundingClientRect();
            panel.style.left = rect.left + 'px';
            panel.style.minWidth = rect.width + 'px';

            var spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 200) {
                panel.style.bottom = (window.innerHeight - rect.top) + 'px';
                panel.style.top = 'auto';
            } else {
                panel.style.top = rect.bottom + 'px';
                panel.style.bottom = 'auto';
            }

            panel.style.display = 'block';
            _lkdOpenPanel = panel;
            _lkdOpenWrapper = wrapper;
            wrapper.classList.add('lkd-open');

            // 讀懃ｴ｢繝輔ぅ繝ｼ繝ｫ繝峨↓繝輔か繝ｼ繧ｫ繧ｹ
            if (searchInput) {
                setTimeout(function () { searchInput.focus(); }, 50);
            }
        });

        panel.addEventListener('click', function (e) {
            var optEl = e.target.closest('.lkd-option');
            if (!optEl) return;
            _value = optEl.dataset.value;
            updateTriggerText();
            closeLkdPanel();

            panel.querySelectorAll('.lkd-option').forEach(function (o) {
                o.classList.toggle('lkd-option-selected', o.dataset.value === _value);
            });
            wrapper.dispatchEvent(new Event('change'));
        });

        // noResultsEl 繧偵ヱ繝阪Ν譛ｫ蟆ｾ縺ｫ驟咲ｽｮ
        if (noResultsEl) panel.appendChild(noResultsEl);

        updateTriggerText();
        if (isDisabled) wrapper.classList.add('lkd-disabled');

        return wrapper;
    }

    /** 繧ｫ繧ｹ繧ｿ繝繝峨Ο繝・・繝繧ｦ繝ｳ縺ｮ繝代ロ繝ｫ繧偵け繝ｪ繝ｼ繝ｳ繧｢繝・・ */
    function cleanupCustomPanel(el) {
        if (el && el._lkdPanel) {
            el._lkdPanel.remove();
            el._lkdPanel = null;
        }
    }

    // =================================================================
    // ACTION BUTTONS (RESET & NEW RECORD)
    // =================================================================

    var _visibilityHandler = null;

    /** 繝ｪ繧ｻ繝・ヨ繝懊ち繝ｳ縺ｨ譁ｰ隕丈ｽ懈・繝懊ち繝ｳ繧堤函謌・*/
    function createActionButtons(fieldCode, def, fieldEl, onResetClick) {
        var frag = document.createDocumentFragment();

        // --- 繝ｪ繧ｻ繝・ヨ繝懊ち繝ｳ ---
        if (def.enableReset) {
            var resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'lkd-action-btn lkd-btn-reset';
            resetBtn.title = '選択をリセット';
            resetBtn.innerHTML = '<span class="material-symbols-outlined">clear_all</span>';
            resetBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (onResetClick) onResetClick();
            });
            frag.appendChild(resetBtn);
        }

        // --- 譁ｰ隕丈ｽ懈・繝懊ち繝ｳ ---
        if (def.enableNewRecord) {
            var newBtn = document.createElement('button');
            newBtn.type = 'button';
            newBtn.className = 'lkd-action-btn lkd-btn-new';
            newBtn.title = '譁ｰ隕上Ξ繧ｳ繝ｼ繝峨ｒ霑ｽ蜉';
            newBtn.innerHTML = '<span class="material-symbols-outlined">new_window</span>';
            newBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                openNewRecordTab(def);
            });
            frag.appendChild(newBtn);
        }

        return frag;
    }

    /** 蜿ら・蜈医い繝励Μ縺ｮ譁ｰ隕丈ｽ懈・逕ｻ髱｢繧貞挨繧ｿ繝悶〒髢九″縲∵綾縺｣縺溘ｉrequery縺吶ｋ */
    function openNewRecordTab(def) {
        var baseUrl = location.origin;
        var url = baseUrl + '/k/' + def.refApp + '/edit';

        // 迴ｾ蝨ｨ縺ｮ繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､繧痴essionStorage縺ｫ譬ｼ邏搾ｼ亥盾辣ｧ蜈医〒prefill縺吶ｋ縺溘ａ・・    
        var rec;
        try { rec = kintone.app.record.get(); } catch (e) { /* ignore */ }
        var filterValue = rec ? (rec.record[def.filterField]?.value || '') : '';

        if (filterValue && def.filterFieldRef) {
            var prefillData = {
                appId: def.refApp,
                fields: [
                    { code: def.filterFieldRef, value: filterValue }
                ]
            };
            sessionStorage.setItem('lkd-prefill', JSON.stringify(prefillData));
            console.log('[LKD] Prefill: データ格納', prefillData);
        }

        window.open(url, '_blank');

        // visibilitychange 縺ｧ繧ｿ繝悶′謌ｻ縺｣縺溘ｉrequery
        registerRequeryHandler(def.refApp);
    }

    /** visibilitychange 繧､繝吶Φ繝医〒繝・・繧ｿ繧貞・蜿門ｾ励＠繝峨Ο繝・・繝繧ｦ繝ｳ繧呈峩譁ｰ縺吶ｋ */
    function registerRequeryHandler(refAppId) {
        // 譌｢蟄倥・繝上Φ繝峨Λ繧貞炎髯､・井ｺ碁㍾逋ｻ骭ｲ髦ｲ豁｢・・
if (_visibilityHandler) {
            document.removeEventListener('visibilitychange', _visibilityHandler);
        }

        _visibilityHandler = async function () {
            if (document.visibilityState !== 'visible') return;
            // 繝上Φ繝峨Λ繧貞叉蠎ｧ縺ｫ隗｣髯､・井ｸ蝗槭・縺ｿ螳溯｡鯉ｼ・
            document.removeEventListener('visibilitychange', _visibilityHandler);
            _visibilityHandler = null;

            console.log('[LKD] Requery: データ再取得開始 (App' + refAppId + ')');
            isProcessing = true;
            try {
                // 隧ｲ蠖薙い繝励Μ縺ｮ繝・・繧ｿ繧貞・蜿門ｾ・
                await fetchAllRecords(refAppId);
                console.log('[LKD] Requery: データ再取得完了 App' + refAppId + ': ' + (dataCache[refAppId] || []).length + '莉ｶ');
                // 蜈ｨ繝峨Ο繝・・繝繧ｦ繝ｳ繧貞・讒狗ｯ・
                refreshAllDropdowns();
            } catch (e) {
                console.error('[LKD] Requery エラー:', e);
            } finally {
                isProcessing = false;
            }
        };

        document.addEventListener('visibilitychange', _visibilityHandler);
    }

    /** select縺ｨ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝懊ち繝ｳ繧呈ｨｪ荳ｦ縺ｳ縺ｫ縺吶ｋ繧ｳ繝ｳ繝・リ繧剃ｽ懈・ */
    function wrapWithFieldRow(select, fieldCode, def, fieldEl, onResetClick) {
        if (!def.enableReset && !def.enableNewRecord) return select;

        var row = document.createElement('div');
        row.className = 'lkd-field-row';
        row.appendChild(select);
        row.appendChild(createActionButtons(fieldCode, def, fieldEl, onResetClick));
        return row;
    }

    // =================================================================
    // ROOT LOOKUP HANDLER
    // =================================================================

    function processRootLookup(fieldCode, def) {
        var fieldEl = findLookupFieldElement(def.label);
        if (!fieldEl) return;

        hideLookupUI(fieldEl);

        if (fieldEl.querySelector('.' + SEL_CLS)) return;

        var rec;
        try { rec = kintone.app.record.get(); } catch (e) { return; }
        var filterValue = rec.record[def.filterField]?.value || '';
        var currentValue = rec.record[fieldCode]?.value || '';

        var filteredRecords = getFilteredRecords(def, filterValue);
        var options = buildOptions(def, filteredRecords, currentValue);
        var isDisabled = !filterValue;

        var select = createSelect(fieldCode, options, currentValue, def.emptyMessage, isDisabled, def.tooltipField, def.searchable);
        select.addEventListener('change', function () {
            onRootSelectChange(fieldCode, def, select);
        });

        var resetFn = function () {
            select.value = '';
            select.dispatchEvent(new Event('change'));
        };
        var wrapped = wrapWithFieldRow(select, fieldCode, def, fieldEl, resetFn);
        getValueArea(fieldEl).appendChild(wrapped);
    }

    function onRootSelectChange(fieldCode, def, select) {
        var selectedKey = select.value;
        var fieldEl = findLookupFieldElement(def.label);
        if (!fieldEl) return;

        if (!selectedKey) {
            // 繧ｯ繝ｪ繧｢: 繝阪う繝・ぅ繝悶・繧ｯ繝ｪ繧｢繝懊ち繝ｳ繧剃ｽｿ逕ｨ
            triggerNativeLookupClear(fieldEl);
            // fieldMappings 繧よ焔蜍輔け繝ｪ繧｢
            var rec;
            try { rec = kintone.app.record.get(); } catch (e) { return; }
            rec.record[fieldCode].value = '';
            def.fieldMappings.forEach(function (m) {
                if (rec.record[m.to]) rec.record[m.to].value = '';
            });
            kintone.app.record.set(rec);
            if (def.onChange) def.onChange(fieldCode, '', rec.record);
            return;
        }

        // 繝阪う繝・ぅ繝悶Ν繝・け繧｢繝・・繧剃ｽｿ縺｣縺ｦ蛟､繧貞叙蠕暦ｼ・intone縺ｮ縲悟叙蠕玲ｸ医∩縲咲憾諷九↓縺吶ｋ・・        isProcessing = true;
        triggerNativeLookup(fieldEl, selectedKey, function () {
            setTimeout(function () {
                isProcessing = false;
                processRootLookup(fieldCode, def);
                if (def.onChange) {
                    var r; try { r = kintone.app.record.get(); } catch (e) { return; }
                    def.onChange(fieldCode, selectedKey, r.record);
                }
            }, 300);
        });
    }

    function refreshRootDropdown(fieldCode, def) {
        var fieldEl = findLookupFieldElement(def.label);
        if (!fieldEl) return;

        // 譌｢蟄倥・select縺ｾ縺溘・lkd-field-row繧呈､懃ｴ｢
        var oldRow = fieldEl.querySelector('.lkd-field-row');
        var oldSelect = oldRow ? oldRow.querySelector('.' + SEL_CLS) : fieldEl.querySelector('.' + SEL_CLS);

        var rec;
        try { rec = kintone.app.record.get(); } catch (e) { return; }
        var filterValue = rec.record[def.filterField]?.value || '';
        var currentValue = rec.record[fieldCode]?.value || '';

        var filteredRecords = getFilteredRecords(def, filterValue);
        var options = buildOptions(def, filteredRecords, currentValue);
        var isDisabled = !filterValue;

        var newSelect = createSelect(fieldCode, options, currentValue, def.emptyMessage, isDisabled, def.tooltipField, def.searchable);
        newSelect.addEventListener('change', function () {
            onRootSelectChange(fieldCode, def, newSelect);
        });

        var resetFn = function () {
            newSelect.value = '';
            newSelect.dispatchEvent(new Event('change'));
        };
        var newWrapped = wrapWithFieldRow(newSelect, fieldCode, def, fieldEl, resetFn);

        hideLookupUI(fieldEl);

        // 譌｢蟄倥・陦後ｒ鄂ｮ謠帙∪縺溘・譁ｰ隕剰ｿｽ蜉
        var oldElement = oldRow || oldSelect;
        if (oldElement) {
            if (oldSelect) cleanupCustomPanel(oldSelect);
            oldElement.replaceWith(newWrapped);
        } else {
            getValueArea(fieldEl).appendChild(newWrapped);
        }

        // 繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､縺檎ｩｺ縺ｫ縺ｪ縺｣縺溷ｴ蜷医√∪縺溘・迴ｾ蝨ｨ蛟､縺後ヵ繧｣繝ｫ繧ｿ繝ｼ邨先棡縺ｫ蜷ｫ縺ｾ繧後↑縺・ｴ蜷医・蛟､繧偵け繝ｪ繧｢
        if (currentValue && (!filterValue || !filteredRecords.some(function (r) {
            return valuesMatch(r[def.refKeyField]?.value, currentValue);
        }))) {
            newSelect.value = '';
            var rec2;
            try { rec2 = kintone.app.record.get(); } catch (e) { return; }
            rec2.record[fieldCode].value = '';
            def.fieldMappings.forEach(function (m) {
                if (rec2.record[m.to]) rec2.record[m.to].value = '';
            });
            isProcessing = true;
            kintone.app.record.set(rec2);
            setTimeout(function () { isProcessing = false; }, 300);
        }
    }

    // =================================================================
    // SUBTABLE LOOKUP HANDLER
    // =================================================================

    function processSubtableLookups(fieldCode, def) {
        var fieldEls = findSubtableFieldElements(def.label);

        fieldEls.forEach(function (fieldEl) {
            hideLookupUI(fieldEl);

            if (fieldEl.querySelector('.' + SEL_CLS)) return;

            var rowIndex = getSubtableRowIndex(fieldEl);
            if (rowIndex < 0) return;

            var rec;
            try { rec = kintone.app.record.get(); } catch (e) { return; }
            var filterValue = rec.record[def.filterField]?.value || '';

            var currentValue = '';
            var subtableRows = rec.record[def.subtable]?.value || [];
            if (rowIndex < subtableRows.length) {
                currentValue = subtableRows[rowIndex].value[fieldCode]?.value || '';
            }

            var filteredRecords = getFilteredRecords(def, filterValue);
            var options = buildOptions(def, filteredRecords, currentValue);
            var isDisabled = !filterValue;

            var select = createSelect(fieldCode, options, currentValue, def.emptyMessage, isDisabled, def.tooltipField);
            select.addEventListener('change', function () {
                onSubtableSelectChange(fieldCode, def, select, fieldEl);
            });

            var resetFn = function () {
                select.value = '';
                select.dispatchEvent(new Event('change'));
            };
            var wrapped = wrapWithFieldRow(select, fieldCode, def, fieldEl, resetFn);
            getValueArea(fieldEl).appendChild(wrapped);
        });
    }

    function onSubtableSelectChange(fieldCode, def, select, fieldEl) {
        var selectedKey = select.value;

        if (!selectedKey) {
            // 繧ｯ繝ｪ繧｢: 繝阪う繝・ぅ繝悶・繧ｯ繝ｪ繧｢繝懊ち繝ｳ繧剃ｽｿ逕ｨ
            triggerNativeLookupClear(fieldEl);
            // fieldMappings 繧よ焔蜍輔け繝ｪ繧｢
            var rowIndex = getSubtableRowIndex(fieldEl);
            if (rowIndex < 0) return;
            var rec;
            try { rec = kintone.app.record.get(); } catch (e) { return; }
            var subtableRows = rec.record[def.subtable]?.value || [];
            if (rowIndex >= subtableRows.length) return;
            var row = subtableRows[rowIndex];
            row.value[fieldCode].value = '';
            def.fieldMappings.forEach(function (m) {
                if (row.value[m.to]) row.value[m.to].value = '';
            });
            kintone.app.record.set(rec);
            if (def.onChange) def.onChange(fieldCode, '', rec.record);
            return;
        }

        // 繝阪う繝・ぅ繝悶Ν繝・け繧｢繝・・繧剃ｽｿ縺｣縺ｦ蛟､繧貞叙蠕暦ｼ・intone縺ｮ縲悟叙蠕玲ｸ医∩縲咲憾諷九↓縺吶ｋ・・        isProcessing = true;
        triggerNativeLookup(fieldEl, selectedKey, function () {
            setTimeout(function () {
                isProcessing = false;
                processSubtableLookups(fieldCode, def);
                if (def.onChange) {
                    var r; try { r = kintone.app.record.get(); } catch (e) { return; }
                    def.onChange(fieldCode, selectedKey, r.record);
                }
            }, 300);
        });
    }

    function refreshSubtableDropdowns(fieldCode, def) {
        var fieldEls = findSubtableFieldElements(def.label);

        fieldEls.forEach(function (fieldEl) {
            var rowIndex = getSubtableRowIndex(fieldEl);
            if (rowIndex < 0) return;

            var oldRow = fieldEl.querySelector('.lkd-field-row');
            var oldSelect = oldRow ? oldRow.querySelector('.' + SEL_CLS) : fieldEl.querySelector('.' + SEL_CLS);

            var rec;
            try { rec = kintone.app.record.get(); } catch (e) { return; }
            var filterValue = rec.record[def.filterField]?.value || '';

            var currentValue = '';
            var subtableRows = rec.record[def.subtable]?.value || [];
            if (rowIndex < subtableRows.length) {
                currentValue = subtableRows[rowIndex].value[fieldCode]?.value || '';
            }

            var filteredRecords = getFilteredRecords(def, filterValue);
            var options = buildOptions(def, filteredRecords, currentValue);
            var isDisabled = !filterValue;

            var newSelect = createSelect(fieldCode, options, currentValue, def.emptyMessage, isDisabled, def.tooltipField, def.searchable);
            newSelect.addEventListener('change', function () {
                onSubtableSelectChange(fieldCode, def, newSelect, fieldEl);
            });

            var resetFn = function () {
                newSelect.value = '';
                newSelect.dispatchEvent(new Event('change'));
            };
            var newWrapped = wrapWithFieldRow(newSelect, fieldCode, def, fieldEl, resetFn);

            hideLookupUI(fieldEl);

            var oldElement = oldRow || oldSelect;
            if (oldElement) {
                if (oldSelect) cleanupCustomPanel(oldSelect);
                oldElement.replaceWith(newWrapped);
            } else {
                getValueArea(fieldEl).appendChild(newWrapped);
            }
        });
    }

    // =================================================================
    // WATCHER 窶・繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､縺ｮ螟画峩繧偵・繝ｼ繝ｪ繝ｳ繧ｰ縺ｧ讀懃衍
    // =================================================================

    function startWatcher() {
        if (watcherInterval) clearInterval(watcherInterval);

        watcherInterval = setInterval(function () {
            if (isProcessing) return;
            try {
                var rec;
                try { rec = kintone.app.record.get(); } catch (e) { return; }

                // 繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､繧貞庶髮・            
                var currentValues = {};
                Object.values(lookupDefs).forEach(function (d) {
                    var key = d.filterField;
                    if (!currentValues[key]) {
                        currentValues[key] = rec.record[key]?.value || '';
                    }
                });

                // 繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､縺ｮ螟画峩繧呈､懃衍
                var changed = false;
                for (var key in currentValues) {
                    if (currentValues[key] !== lastFilterValues[key]) {
                        changed = true;
                        break;
                    }
                }

                if (changed) {
                    console.log('[LKD] フィルター値変更検知:', JSON.stringify(currentValues));
                    lastFilterValues = currentValues;
                    refreshAllDropdowns();
                }

                // 譛ｪ蜃ｦ逅・・繧ｵ繝悶ユ繝ｼ繝悶Ν陦後ｒ讀懷・・・・逅・ｼ郁｡瑚ｿｽ蜉蟇ｾ蠢懶ｼ・
                Object.keys(lookupDefs).forEach(function (fc) {
                    var d = lookupDefs[fc];
                    if (d.location === 'subtable') {
                        processSubtableLookups(fc, d);
                    }
                    if (d.location === 'root') {
                        processRootLookup(fc, d);
                    }
                });
            } catch (e) {
                // 繝輔か繝ｼ繝蜀肴緒逕ｻ荳ｭ縺ｮ繧ｨ繝ｩ繝ｼ縺ｯ辟｡隕・
            }
        }, 500);
    }

    /** 蜈ｨ繝峨Ο繝・・繝繧ｦ繝ｳ繧貞・讒狗ｯ・*/
    function refreshAllDropdowns() {
        Object.keys(lookupDefs).forEach(function (fieldCode) {
            var def = lookupDefs[fieldCode];
            if (def.location === 'root') {
                refreshRootDropdown(fieldCode, def);
            } else {
                refreshSubtableDropdowns(fieldCode, def);
            }
        });
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);

        // Material Symbols Outlined 繝輔か繝ｳ繝郁ｪｭ縺ｿ霎ｼ縺ｿ
        if (!document.getElementById('lkd-material-symbols')) {
            var link = document.createElement('link');
            link.id = 'lkd-material-symbols';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=clear_all,new_window';
            document.head.appendChild(link);
        }
    }

    async function initialize(defs) {
        lookupDefs = defs;

        try {
            // 繧ｪ繝ｼ繝舌・繝ｬ繧､繧ｳ繝ｳ繝・リ繧偵Μ繧ｻ繝・ヨ
            var oldContainer = document.getElementById(LKD_OVERLAY_ID);
            if (oldContainer) oldContainer.innerHTML = '';
            _lkdTooltip = null;

            // 蜿ら・蜈医い繝励Μ縺ｮ繝ｬ繧ｳ繝ｼ繝峨ｒ荳諡ｬ蜿門ｾ・        
            var appIds = [];
            Object.values(lookupDefs).forEach(function (d) {
                if (appIds.indexOf(d.refApp) === -1) appIds.push(d.refApp);
            });
            await Promise.all(appIds.map(function (id) { return fetchAllRecords(id); }));
            console.log('[LKD] データ取得完了',
                appIds.map(function (k) { return 'App' + k + ': ' + (dataCache[k] || []).length + '莉ｶ'; }).join(', ')
            );

            // 蛻晄悄繝輔ぅ繝ｫ繧ｿ繝ｼ蛟､繧定ｨ倬鹸
            var rec;
            try { rec = kintone.app.record.get(); } catch (e) { return; }
            lastFilterValues = {};
            Object.values(lookupDefs).forEach(function (d) {
                var key = d.filterField;
                if (!lastFilterValues[key]) {
                    lastFilterValues[key] = rec.record[key]?.value || '';
                }
            });

            // CSS豕ｨ蜈･
            injectStyles();

            // DOM貅門ｙ繧貞ｾ・▽
            await new Promise(function (resolve) { setTimeout(resolve, 500); });

            // 蜈ｨ繝ｫ繝・け繧｢繝・・繧貞・逅・
            Object.keys(lookupDefs).forEach(function (fieldCode) {
                var def = lookupDefs[fieldCode];
                if (def.location === 'root') {
                    processRootLookup(fieldCode, def);
                } else {
                    processSubtableLookups(fieldCode, def);
                }
            });

            // 繧ｦ繧ｩ繝・メ繝｣繝ｼ髢句ｧ・
            startWatcher();

            console.log('[LKD] 初期化完了');
        } catch (e) {
            console.error('[LKD] 初期化エラー:', e);
        }
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    window.LkdEngine = {
        /**
         * 繝ｫ繝・け繧｢繝・・竊偵ラ繝ｭ繝・・繝繧ｦ繝ｳ螟画鋤繧貞・譛溷喧
         * @param {Object} defs - LOOKUP_DEFS 險ｭ螳壹が繝悶ず繧ｧ繧ｯ繝・         */
        init: function (defs) {
            initialize(defs);
        }
    };

    // =================================================================
    // PREFILL HANDLER 窶・譁ｰ隕丈ｽ懈・逕ｻ髱｢縺ｧ縺ｮ繝輔ぅ繝ｼ繝ｫ繝芽・蜍募・蜉・    // =================================================================
    // lkd-engine.js 繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・ｋ繧｢繝励Μ縺ｮ create.show 縺ｧ閾ｪ蜍募ｮ溯｡後＆繧後ｋ縲・    // sessionStorage 縺ｫ prefill 繝・・繧ｿ縺後≠繧後・縲∬ｩｲ蠖薙ヵ繧｣繝ｼ繝ｫ繝峨↓蛟､繧偵そ繝・ヨ縺励・    // 繝ｫ繝・け繧｢繝・・繝輔ぅ繝ｼ繝ｫ繝峨・蝣ｴ蜷医・繝阪う繝・ぅ繝悶・縲悟叙蠕励阪・繧ｿ繝ｳ繧ゅヨ繝ｪ繧ｬ繝ｼ縺吶ｋ縲・
    kintone.events.on('app.record.create.show', function (event) {
        var raw = sessionStorage.getItem('lkd-prefill');
        if (!raw) return event;

        var data;
        try { data = JSON.parse(raw); } catch (e) { return event; }

        // 繧｢繝励ΜID縺御ｸ閾ｴ縺励↑縺・ｴ蜷医・辟｡隕厄ｼ亥挨繧｢繝励Μ縺ｮprefill繝・・繧ｿ・・    
        var currentAppId;
        try { currentAppId = kintone.app.getId(); } catch (e) { return event; }
        if (String(data.appId) !== String(currentAppId)) return event;

        // 菴ｿ逕ｨ貂医∩繝・・繧ｿ繧貞炎髯､
        sessionStorage.removeItem('lkd-prefill');
        console.log('[LKD] Prefill: create.show でデータ受信', data);

        // event.record 縺ｫ蛟､繧偵そ繝・ヨ
        data.fields.forEach(function (f) {
            if (event.record[f.code]) {
                event.record[f.code].value = f.value;
            }
        });

        // DOM謠冗判蠕後↓繝ｫ繝・け繧｢繝・・繝輔ぅ繝ｼ繝ｫ繝峨ｒ讀懷・縺励∝叙蠕励ｒ繝医Μ繧ｬ繝ｼ
        setTimeout(function () {
            data.fields.forEach(function (f) {
                try {
                    var el = kintone.app.record.getFieldElement(f.code);
                    if (!el) return;

                    // .control-gaia 縺ｾ縺ｧ驕｡縺｣縺ｦ繝ｫ繝・け繧｢繝・・UI繧呈爾縺・                
                    var controlEl = el.closest('.control-gaia') || el;
                    var container = controlEl.querySelector('.component-app-lookup-inputlookup');
                    if (!container) {
                        // 隕ｪ隕∫ｴ繧よ爾邏｢・・intone縺ｮDOM讒矩蟾ｮ逡ｰ蟇ｾ蠢懶ｼ・                    
                        var parent = controlEl.parentElement;
                        if (parent) container = parent.querySelector('.component-app-lookup-inputlookup');
                    }
                    if (!container) return; // 繝ｫ繝・け繧｢繝・・縺ｧ縺ｯ縺ｪ縺・竊・event.record 縺ｧ險ｭ螳壽ｸ医∩

                    var input = container.querySelector('input[type="text"]');
                    var btn = container.querySelector('.input-lookup-gaia');
                    if (!input || !btn) return;

                    console.log('[LKD] Prefill: ルックアップ取得トリガー:', f.code, '=', f.value);

                    // 繝阪う繝・ぅ繝門・蜉帛､繧偵そ繝・ヨ
                    var nativeSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value'
                    ).set;
                    nativeSetter.call(input, f.value);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));

                    // 縲悟叙蠕励阪・繧ｿ繝ｳ繧偵け繝ｪ繝・け
                    setTimeout(function () { btn.click(); }, 300);
                } catch (e) {
                    console.error('[LKD] Prefill: フィールド' + f.code + ' エラー:', e);
                }
            });
        }, 1500);

        return event;
    });

})();
