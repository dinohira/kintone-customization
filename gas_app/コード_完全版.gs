function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setTitle('社内打刻システム');
}

// ============================================
// Kintone Webhook受信エンドポイント（承認・取消逆連携）
// ============================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', reason: 'no contents'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(e.postData.contents);
    const eventType = payload.type; // ADD_RECORD, UPDATE_RECORD, DELETE_RECORD
    
    // レコード更新イベントのみ処理
    if (eventType !== 'UPDATE_RECORD') {
      return ContentService.createTextOutput(JSON.stringify({status: 'skipped', reason: 'not UPDATE_RECORD'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const record = payload.record;
    const kintoneRecordId = record['$id'] ? record['$id'].value : null;
    const rType = record['R種別'] ? record['R種別'].value : null;
    const cCancel = record['C取消'] ? record['C取消'].value : null;
    const applicantName = record['申請者名'] ? record['申請者名'].value : '';
    const startDate = record['開始日'] ? record['開始日'].value : '';
    
    if (!kintoneRecordId) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', reason: 'no record ID'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const plSheet = ss.getSheetByName('有給休暇申請');
    if (!plSheet) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', reason: 'sheet not found'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // G列（7列目）のKintoneレコードIDで対象行を検索
    const plData = plSheet.getDataRange().getValues();
    let targetRow = -1;
    // 下から検索し最新の行を優先
    for (let i = plData.length - 1; i >= 1; i--) {
      if (String(plData[i][6]) === String(kintoneRecordId)) {
        targetRow = i + 1; // シート上の行番号(1-indexed)
        break;
      }
    }
    
    if (targetRow === -1) {
      console.warn(`Webhook: KintoneレコードID ${kintoneRecordId} に対応する行が見つかりません`);
      return ContentService.createTextOutput(JSON.stringify({status: 'error', reason: 'record not found in sheet'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let action = 'none';
    
    // --- 取消処理（C取消がチェックされている場合）---
    // チェックボックス / ドロップダウン / 配列のいずれの形式にも対応
    const isCancelled = cCancel === 'true' || cCancel === true || cCancel === 'TRUE' ||
        (Array.isArray(cCancel) && cCancel.length > 0);
    
    if (isCancelled) {
      // すでにF列がTRUEの場合は二重実行防止
      if (plData[targetRow - 1][5] !== true && plData[targetRow - 1][5] !== "TRUE") {
        const empId = plData[targetRow - 1][1].toString();
        cancelPaidLeaveRow(ss, plSheet, targetRow, empId);
        action = 'cancelled';
        console.log(`Webhook: レコード${kintoneRecordId} を取消処理しました（${applicantName}, ${startDate}）`);
      } else {
        action = 'already_cancelled';
        console.log(`Webhook: レコード${kintoneRecordId} は既に取消済みです`);
      }
    }
    // --- 承認処理 ---
    else if (rType === '休日(承認済)') {
      // H列（8列目）に承認ステータスを記録
      plSheet.getRange(targetRow, 8).setValue('承認済');
      action = 'approved';
      console.log(`Webhook: レコード${kintoneRecordId} を承認済にしました（${applicantName}, ${startDate}）`);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'ok', action: action, recordId: kintoneRecordId}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    console.error('Webhook処理エラー: ' + err.message);
    // エラーでも管理者に通知
    try {
      const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
      if (adminEmail) {
        MailApp.sendEmail(adminEmail,
          '【要確認】Kintone Webhook処理エラー',
          'Kintone Webhookの処理中にエラーが発生しました。\n\n' +
          'エラー: ' + err.message + '\n' +
          'ペイロード: ' + (e.postData ? e.postData.contents : '(なし)'));
      }
    } catch(me) {}
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// 定数定義 & 共通ユーティリティ関数
// ============================================

// 従業員マスタの列インデックス定数 (0-based, getValues配列アクセス用)
const M = {
  ID: 0, NAME: 1, TYPE: 2,
  STATUS: 4, STATUS_DATE: 5,
  WORK_TYPE: 6, GRANTED: 7,
  CARRIED: 8, USED: 9, REMAINING: 10,
  HIRE_DATE: 11,
  CHILD_COUNT: 12, CARE_FAMILY: 13,
  NURSING_USED: 14, CARE_USED: 15
};

// 有給付与日数テーブル（労働基準法準拠: 0.5年=10日, 1.5年=11日, ...6.5年以降=20日）
const LEGAL_PAID_LEAVE_DAYS = [10, 11, 12, 14, 16, 18, 20];

/**
 * 日付を安全にパースする共通関数
 * Date型、文字列 "YYYY-MM-DD" や "YYYY/MM/DD" に対応
 */
function parseDateSafe_(val) {
  if (val instanceof Date) return val;
  if (!val) return null;
  const s = String(val);
  const matched = s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (!matched) return null;
  return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

/**
 * カレンダーシートから休日マップ(holidays1, holidays2)を読み込む共通関数
 * holidays1: B列の休日判定（勤務種別 1,2,4 向け）
 * holidays2: C列の休日判定（勤務種別 3 向け）
 */
function loadHolidays_(ss) {
  const calSheet = ss.getSheetByName('会社カレンダー');
  const holidays1 = {};
  const holidays2 = {};
  if (calSheet) {
    const cData = calSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      if (!cData[i][0]) continue;
      const dStr = (cData[i][0] instanceof Date)
        ? Utilities.formatDate(cData[i][0], "JST", "yyyy-MM-dd")
        : String(cData[i][0]).replace(/\//g, "-");
      holidays1[dStr] = (cData[i][1] === '休日');
      holidays2[dStr] = (cData[i][2] === '休日');
    }
  }
  return { holidays1, holidays2 };
}

/**
 * 従業員マスタからID→{row, data}のMapを構築する共通関数
 * row: 1-indexed (シートの行番号としてそのまま使える)
 */
function buildEmpIndex_(masterData) {
  const index = {};
  for (let i = 1; i < masterData.length; i++) {
    index[String(masterData[i][M.ID])] = { row: i + 1, data: masterData[i] };
  }
  return index;
}

/**
 * 法定有給付与日数を取得する
 * @param {number} y - 初回付与（0.5年後）からの経過年数 (0=初回10日, 1=1.5年11日, ...)
 */
function getLegalPaidLeaveDays_(y) {
  if (y < 0) return 0;
  return LEGAL_PAID_LEAVE_DAYS[Math.min(y, LEGAL_PAID_LEAVE_DAYS.length - 1)];
}

function getEmployeeData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('従業員マスタ');
  const masterData = masterSheet.getDataRange().getValues();
  masterData.shift(); 
  
  // 打刻ログから各従業員の「最新の打刻」を自動抽出（これによって手動でログを消しても即時アプリに連動する）
  const logSheet = ss.getSheetByName('打刻ログ');
  const logData = logSheet ? logSheet.getDataRange().getValues() : [];
  const latestLog = {}; 
  // 一番下（最新）の行から上にスキャンし、各IDの最新アクション1つだけを取得
  for (let i = logData.length - 1; i >= 1; i--) {
     const eId = String(logData[i][1]);
     if (!eId || latestLog[eId]) continue;
     latestLog[eId] = { time: logData[i][0], action: logData[i][4] };
  }
  
  // カレンダー情報を読み取り「本日の休日判定」を行う
  const { holidays1, holidays2 } = loadHolidays_(ss);
  const todayDashStr = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");
  
  const todayStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");
  
  return masterData.filter(emp => emp[M.ID] && String(emp[M.ID]).trim() !== "").map(emp => {
    const empId = String(emp[M.ID]); 
    const empName = emp[M.NAME];   
    const empType = Number(emp[M.TYPE]) || emp[M.TYPE];   
    
    const granted = Number(emp[M.GRANTED]) || 0;
    const used = Number(emp[M.USED]) || 0;
    const remaining = Number(emp[M.REMAINING]) || 0;

    const hireDateStr = emp[M.HIRE_DATE];
    let deadlineStr = "";
    if (hireDateStr) {
      let hireDate = parseDateSafe_(hireDateStr);
      if (!isNaN(hireDate.getTime())) {
         let grantMonth = hireDate.getMonth() + 6;
         let grantYear = hireDate.getFullYear();
         if (grantMonth > 11) { grantMonth -= 12; grantYear += 1; }
         const baseGrantDate = new Date(grantYear, grantMonth, hireDate.getDate());
         const now = new Date();
         let nextGrantDate = new Date(now.getFullYear(), grantMonth, baseGrantDate.getDate());
         if (nextGrantDate.getTime() <= now.getTime()) {
             nextGrantDate.setFullYear(now.getFullYear() + 1);
         }
         const deadlineDate = new Date(nextGrantDate.getTime() - 24 * 60 * 60 * 1000);
         deadlineStr = Utilities.formatDate(deadlineDate, "JST", "yyyy年M月d日");
      }
    }
    
    // ▼ 最新ログによる自動判定 ▼
    let lastStatus = "未出勤";
    let lastDateStr = "";
    if (latestLog[empId]) {
      lastStatus = latestLog[empId].action || "未出勤";
      // 遅刻・早退のステータスを基本ステータスに正規化（UI判定用）
      if (lastStatus.startsWith('出勤')) lastStatus = '出勤';
      else if (lastStatus.startsWith('退勤')) lastStatus = '退勤';
      try {
        let d = parseDateSafe_(latestLog[empId].time) || new Date(latestLog[empId].time);
        lastDateStr = Utilities.formatDate(d, "JST", "yyyy/MM/dd");
      } catch(e) {}
    }
    
    const isNightShift = (empType === '夜勤');
    const typeNum = Number(emp[M.WORK_TYPE]) || 0; // G列
    const isTodayHoliday = (typeNum === 3) ? !!holidays2[todayDashStr] : !!holidays1[todayDashStr];
    
    // 日付が変わったら一般の人は「未出勤」にリセット（夜勤は日またぎの業務があるためリセットから除外）
    if (!isNightShift && lastDateStr !== todayStr) {
      lastStatus = "未出勤";
    }
    
    // ▼ 看護・介護休暇 資格情報 ▼
    const childCount = Number(emp[M.CHILD_COUNT]) || 0;
    const careFamily = Number(emp[M.CARE_FAMILY]) || 0;
    const nursingUsed = Number(emp[M.NURSING_USED]) || 0;
    const careUsed = Number(emp[M.CARE_USED]) || 0;
    const nursingLimit = childCount === 0 ? 0 : (childCount >= 2 ? 10 : 5);
    const careLimit = careFamily === 0 ? 0 : (careFamily >= 2 ? 10 : 5);

    return { 
      id: empId, name: empName, type: empType, isHoliday: isTodayHoliday, 
      status: lastStatus, granted: granted, used: used, remaining: remaining, deadline: deadlineStr,
      childCount: childCount, careFamily: careFamily,
      nursingUsed: nursingUsed, careUsed: careUsed,
      nursingLimit: nursingLimit, careLimit: careLimit 
    };
  });
}

function recordTime(empId, type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('打刻ログ');
  const masterSheet = ss.getSheetByName('従業員マスタ');
  // ログ書き込み用の情報取得と同時に、マスタ側のステータスも更新する
  const masterData = masterSheet.getDataRange().getValues();
  
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd");

  let empName = "", workType = "";
  let empTypeNum = 1; // デフォルト種別
  // buildEmpIndex_でMap化して高速検索
  const empIndex = buildEmpIndex_(masterData);
  let exactEmpId = empId; 
  const found = empIndex[String(empId)];
  if (found) {
    exactEmpId = String(found.data[M.ID]);
    empName = found.data[M.NAME];
    workType = found.data[M.TYPE];
    empTypeNum = Number(found.data[M.WORK_TYPE]) || 1;
    // 該当行のE列にステータス、F列に今日の日付を書き込む
    masterSheet.getRange(found.row, M.STATUS + 1, 1, 2).setValues([[type, todayStr]]);
  }

  // 遅刻・早退の自動判定
  let logType = type;
  if (type === '出勤' || type === '退勤') {
    const schedule = getSchedule_(empTypeNum);
    const nowJST = new Date(now.toLocaleString('en-US', {timeZone: 'Asia/Tokyo'}));
    const nowMinutes = nowJST.getHours() * 60 + nowJST.getMinutes();
    
    if (type === '出勤' && nowMinutes > schedule.startMin) {
      logType = '出勤(遅刻)';
    } else if (type === '退勤' && nowMinutes < schedule.endMin) {
      // 夜勤(種別2)の場合: endMin=26*60=1560 → 実際は翌日2:00
      // 日中勤務の場合のみ早退判定
      if (empTypeNum !== 2) {
        logType = '退勤(早退)';
      }
    }
  }

  // appendRowの代わりに直接書き込みで、テキスト書式とデータ設定を1回のAPI呼び出しで完了させる
  const lastRow = logSheet.getLastRow() + 1;
  const range = logSheet.getRange(lastRow, 1, 1, 5);
  range.setNumberFormat("@");  // 全セルをテキスト書式に（ID先頭ゼロ消失防止）
  range.setValues([[now, exactEmpId, empName, workType, logType]]);
  // A列（タイムスタンプ）だけ日時書式に戻す
  logSheet.getRange(lastRow, 1).setNumberFormat("yyyy/MM/dd HH:mm:ss");

  return Utilities.formatDate(now, "JST", "HH:mm");
}

function submitCorrection(empId, empName, date, reason, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let correctionSheet = ss.getSheetByName('打刻修正申請');
  
  // シートが存在しない場合は自動で作成してヘッダーを設定する
  if (!correctionSheet) {
    correctionSheet = ss.insertSheet('打刻修正申請');
    correctionSheet.appendRow(['送信日時', '従業員番号', '氏名', '対象日', '申告内容', '詳細・正しい時間', '対応ステータス']);
    correctionSheet.getRange("A1:G1").setBackground("#f8f9fa").setFontWeight("bold");
    correctionSheet.setFrozenRows(1);
    correctionSheet.getRange("B:B").setNumberFormat("@"); // IDのゼロ落ち防止
  }
  
  const now = new Date();
  // idにシングルクォートをつけてゼロ落ちを完全防止
  correctionSheet.appendRow([now, "'" + empId, empName, date, reason, details, '未対応']);
  
  // ▼ 申請内容を管理者にメールで送信する場合は、以下のコメントアウト(/* */)を外して使用できます ▼
  
  const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || "admin@example.com";
  const subject = `【打刻修正申請】${empName}様より`;
  const body = `${empName}様より打刻の修正申請がありました。\n\n対象日: ${date}\n申告内容: ${reason}\n詳細: ${details}\n\n「打刻修正申請」シートを確認してください。`;
  MailApp.sendEmail(adminEmail, subject, body);
  
  
  return true;
}

// ============================================
// B2: 打刻履歴の取得（直近7日分）
// ============================================
function getRecentLogs(empId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('打刻ログ');
  if (!logSheet) return [];
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const data = logSheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const eId = String(data[i][1]);
    if (eId !== String(empId)) continue;
    const t = (data[i][0] instanceof Date) ? data[i][0] : new Date(data[i][0]);
    if (isNaN(t.getTime()) || t < sevenDaysAgo) continue;
    results.push({
      datetime: Utilities.formatDate(t, "JST", "MM/dd HH:mm"),
      date: Utilities.formatDate(t, "JST", "MM/dd(E)"),
      time: Utilities.formatDate(t, "JST", "HH:mm"),
      action: data[i][4]
    });
  }
  
  // 新しい順にソート
  results.sort((a, b) => b.datetime.localeCompare(a.datetime));
  return results;
}


// ============================================
// 看護休暇・介護休暇の申請処理（事後申請・承認不要）
// ============================================
function submitNursingCareLeave(empId, empName, leaveType, date, reason) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (leaveType !== '看護休暇' && leaveType !== '介護休暇') {
    return { success: false, reason: 'invalid_type' };
  }
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (!masterSheet) return { success: false, reason: 'master_not_found' };
  const masterData = masterSheet.getDataRange().getValues();
  const empIndex = buildEmpIndex_(masterData);
  const found = empIndex[String(empId)];
  if (!found) return { success: false, reason: 'employee_not_found' };
  const childCount = Number(found.data[M.CHILD_COUNT]) || 0;
  const careFamily = Number(found.data[M.CARE_FAMILY]) || 0;
  if (leaveType === '看護休暇' && childCount === 0) {
    return { success: false, reason: 'no_eligible_child' };
  }
  if (leaveType === '介護休暇' && careFamily === 0) {
    return { success: false, reason: 'no_eligible_family' };
  }
  let annualLimit, usedCol;
  if (leaveType === '看護休暇') {
    annualLimit = childCount >= 2 ? 10 : 5;
    usedCol = M.NURSING_USED;
  } else {
    annualLimit = careFamily >= 2 ? 10 : 5;
    usedCol = M.CARE_USED;
  }
  const currentUsed = Number(found.data[usedCol]) || 0;
  if (currentUsed >= annualLimit) {
    return { success: false, reason: 'limit_exceeded', used: currentUsed, limit: annualLimit };
  }
  let ncSheet = ss.getSheetByName('看護・介護休暇');
  if (!ncSheet) {
    ncSheet = ss.insertSheet('看護・介護休暇');
    ncSheet.appendRow(['申請日時', '従業員番号', '氏名', '休暇種別', '取得日', '事由・備考', 'KintoneレコードID']);
    ncSheet.getRange("A1:G1").setBackground("#f8f9fa").setFontWeight("bold");
    ncSheet.setFrozenRows(1);
    ncSheet.getRange("B:B").setNumberFormat("@");
  }
  const ncData = ncSheet.getDataRange().getValues();
  const normalizedDate = parseDateSafe_(date)
    ? Utilities.formatDate(parseDateSafe_(date), "JST", "yyyy-MM-dd")
    : String(date);
  for (let i = 1; i < ncData.length; i++) {
    const existId = ncData[i][1].toString().replace(/^'/, "");
    let existDate = "";
    if (ncData[i][4] instanceof Date) {
      existDate = Utilities.formatDate(ncData[i][4], "JST", "yyyy-MM-dd");
    } else {
      existDate = String(ncData[i][4]);
    }
    if (existId === String(empId) && existDate === normalizedDate && ncData[i][3] === leaveType) {
      return { success: false, reason: 'duplicate' };
    }
  }
  const now = new Date();
  ncSheet.appendRow([now, "'" + empId, empName, leaveType, date, reason || "（記載なし）", ""]);
  const lastRow = ncSheet.getLastRow();
  masterSheet.getRange(found.row, usedCol + 1).setValue(currentUsed + 1);
  const props = PropertiesService.getScriptProperties();
  const kintoneDomain = props.getProperty('KINTONE_DOMAIN');
  const appId = Number(props.getProperty('KINTONE_APP_ID_PAID_LEAVE')) || 324;
  const apiToken = props.getProperty('KINTONE_API_TOKEN');
  let kintoneSync = false;
  let kintoneDate = "";
  if (date) {
    const parsed = parseDateSafe_(date);
    kintoneDate = parsed ? Utilities.formatDate(parsed, "JST", "yyyy-MM-dd") : date;
  }
  const payload = {
    app: appId,
    record: {
      "申請者名": { value: empName },
      "開始日": { value: kintoneDate },
      "終了日": { value: kintoneDate },
      "R種別": { value: leaveType },
      "C終日": { value: ["終日"] },
      "備考": { value: reason || "" }
    }
  };
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "X-Cybozu-API-Token": apiToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    if (kintoneDomain && apiToken) {
      const response = UrlFetchApp.fetch('https://' + kintoneDomain + '/k/v1/record.json', options);
      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        if (json && json.id) {
          ncSheet.getRange(lastRow, 7).setValue(json.id);
          kintoneSync = true;
        }
      } else {
        console.error('Kintone API Error: HTTP ' + response.getResponseCode());
      }
    }
  } catch (e) {
    console.error("Kintone API Error (nursing/care): " + e.message);
  }
  return { success: true, kintoneSync: kintoneSync, used: currentUsed + 1, limit: annualLimit };
}
function submitPaidLeaveAction(empId, empName, date, reason) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let plSheet = ss.getSheetByName('有給休暇申請');
  
  if (!plSheet) {
    plSheet = ss.insertSheet('有給休暇申請');
    plSheet.appendRow(['申請日時', '従業員番号', '氏名', '取得希望日', '事由・備考', '取消 / 差戻']);
    plSheet.getRange("A1:F1").setBackground("#f8f9fa").setFontWeight("bold");
    plSheet.setFrozenRows(1);
    plSheet.getRange("B:B").setNumberFormat("@"); // IDのゼロ落ち防止
  } else {
    // 既存のシートにアップデートする場合、F1が「取消 / 差戻」か確認
    const currentHeader = plSheet.getRange("F1").getValue();
    if (currentHeader !== "取消 / 差戻") {
        plSheet.getRange("F1").setValue("取消 / 差戻");
    }
  }
  
  // ▼ A3: 重複チェック — 同一従業員ID＋同一日付＋未取消の申請がないか確認 ▼
  const plData = plSheet.getDataRange().getValues();
  // 申請日（date）をyyyy-MM-dd形式に正規化してから比較する
  const normalizedDate = parseDateSafe_(date)
    ? Utilities.formatDate(parseDateSafe_(date), "JST", "yyyy-MM-dd")
    : String(date);
  for (let i = 1; i < plData.length; i++) {
    // F列(index5)がTRUEの行は取消済み → スキップ
    if (plData[i][5] === true || plData[i][5] === "TRUE") continue;
    const existId = plData[i][1].toString().replace(/^'/, "");
    let existDate = "";
    if (plData[i][3] instanceof Date) {
      existDate = Utilities.formatDate(plData[i][3], "JST", "yyyy-MM-dd");
    } else {
      existDate = String(plData[i][3]);
    }
    if (existId === String(empId) && existDate === normalizedDate) {
      return { success: false, kintoneSync: false, reason: "duplicate" };
    }
  }
  // ▲ A3: 重複チェック ここまで ▲
  
  const now = new Date();
  plSheet.appendRow([now, "'" + empId, empName, date, reason || "（記載なし）", "FALSE"]);
  
  // 追加した行のF列だけをチェックボックス化する
  const lastRow = plSheet.getLastRow();
  plSheet.getRange(lastRow, 6).insertCheckboxes();
  
  // 従業員マスタの「取得済日数（J列）」を+1する処理
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (masterSheet) {
    const masterData = masterSheet.getDataRange().getValues();
    const empIndex = buildEmpIndex_(masterData);
    const found = empIndex[String(empId)];
    if (found) {
      const currentUsed = Number(found.data[M.USED]) || 0;
      masterSheet.getRange(found.row, M.USED + 1).setValue(currentUsed + 1);
    }
  }
  
  // ▼▼ Kintoneアプリへのデータ連携処理（認証情報はスクリプトプロパティから取得） ▼▼
  const props = PropertiesService.getScriptProperties();
  const kintoneDomain = props.getProperty('KINTONE_DOMAIN');
  const appId = Number(props.getProperty('KINTONE_APP_ID_PAID_LEAVE')) || 324;
  const apiToken = props.getProperty('KINTONE_API_TOKEN');
  let kintoneSync = false; // A1: Kintone連携の成否フラグ
  
  // 休暇日のフォーマット変換 (YYYY-MM-DD 形式で送る必要がある)
  let kintoneDate = "";
  if (date) {
    const parsed = parseDateSafe_(date);
    kintoneDate = parsed
      ? Utilities.formatDate(parsed, "JST", "yyyy-MM-dd")
      : date; // 変換できない場合はそのまま送る
  }

  const payload = {
    app: appId,
    record: {
      "申請者名": { value: empName },
      "開始日": { value: kintoneDate },
      "終了日": { value: kintoneDate },
      "R種別": { value: "休日(申請中)" },
      "C終日": { value: ["終日"] },
      "備考": { value: reason || "" }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Cybozu-API-Token": apiToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    if (!kintoneDomain || !apiToken) {
      console.warn("Kintone連携スキップ: スクリプトプロパティ(KINTONE_DOMAIN, KINTONE_API_TOKEN)が未設定です。setupScriptProperties() を実行してください。");
    } else {
      const response = UrlFetchApp.fetch(`https://${kintoneDomain}/k/v1/record.json`, options);
      const responseCode = response.getResponseCode();
      // Kintone APIのレスポンスコードを確認し、200以外はエラーとして記録する
      if (responseCode !== 200) {
        const errBody = response.getContentText();
        console.error(`Kintone API Error: HTTP ${responseCode} - ${errBody}`);
        // A1: Kintone連携失敗を管理者にメール通知
        const adminEmail = props.getProperty('ADMIN_EMAIL');
        if (adminEmail) {
          MailApp.sendEmail(adminEmail,
            `【要確認】有給申請のKintone連携失敗（${empName}）`,
            `以下の有給申請はスプレッドシートに記録済みですが、Kintoneへの登録に失敗しました。\n\n` +
            `従業員: ${empName} (ID: ${empId})\n` +
            `取得希望日: ${date}\n` +
            `エラー: HTTP ${responseCode}\n` +
            `詳細: ${errBody}\n\n` +
            `手動でKintoneアプリ324にレコードを追加してください。`);
        }
      } else {
        const json = JSON.parse(response.getContentText());
        if (json && json.id) {
           plSheet.getRange(lastRow, 7).setValue(json.id);
           kintoneSync = true; // 連携成功
        }
      }
    }
  } catch (e) {
    console.error("Kintone API Error: " + e.message);
    // A1: 例外発生時も管理者にメール通知
    try {
      const adminEmail = props.getProperty('ADMIN_EMAIL');
      if (adminEmail) {
        MailApp.sendEmail(adminEmail,
          `【要確認】有給申請のKintone連携エラー（${empName}）`,
          `以下の有給申請はスプレッドシートに記録済みですが、Kintone連携で例外が発生しました。\n\n` +
          `従業員: ${empName} (ID: ${empId})\n` +
          `取得希望日: ${date}\n` +
          `エラー: ${e.message}\n\n` +
          `手動でKintoneアプリ324にレコードを追加してください。`);
      }
    } catch (mailErr) {
      console.error("管理者メール送信にも失敗: " + mailErr.message);
    }
  }
  // ▲▲ Kintoneアプリへのデータ連携処理 ここまで ▲▲
  
  // A1: 戻り値をオブジェクトに変更（フロントエンド側でKintone同期結果を表示可能に）
  return { success: true, kintoneSync: kintoneSync };
}

// ============================================
// 有給休暇行の取消（日数戻し＆行削除）共通処理
// ============================================
function cancelPaidLeaveRow(ss, sheet, rowNum, empIdStr) {
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (masterSheet) {
    const masterData = masterSheet.getDataRange().getValues();
    // buildEmpIndex_でMap検索（シングルクォート除去にも対応）
    const empIndex = buildEmpIndex_(masterData);
    const cleanId = empIdStr.toString().replace(/^'/, "");
    const found = empIndex[cleanId];
    if (found) {
      const currentUsed = Number(found.data[M.USED]) || 0;
      // 取得済日数を -1 して戻す（0未満にはしない）
      if (currentUsed > 0) {
        masterSheet.getRange(found.row, M.USED + 1).setValue(currentUsed - 1);
      }
    }
  }
  // 有給申請の対象行を削除する
  sheet.deleteRow(rowNum);
}

// ============================================
// 手動取消ロジック (onEdit)
// ============================================
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  
  // 有給休暇申請シートのF列(6列目)が編集された場合
  if (sheet.getName() === "有給休暇申請" && e.range.getColumn() === 6) {
    if (e.value === "TRUE") {
      const rowNum = e.range.getRow();
      if (rowNum === 1) return;
      
      const empId = sheet.getRange(rowNum, 2).getValue().toString();
      if (!empId) return;

      const ss = e.source;
      cancelPaidLeaveRow(ss, sheet, rowNum, empId);
      
      try {
         ss.toast(`${empId} の有給申請を否決（行削除）し、取得済日数を -1 に戻しました！`, "手動取消完了");
      } catch(ex) {}
    }
  }
}


// ============================================
// 有給休暇の自動管理システム (労働基準法準拠)
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('集計・有給管理・その他ツール')
    .addItem('集計結果CSVをダウンロード（月ごと）', 'showExportDialog')
    .addSeparator()
    .addItem('有給日数を一括最新化（手動更新）', 'updatePaidLeave')
    .addItem('毎日の自動更新トリガーを作成', 'setupDailyTrigger')
    .addSeparator()
    .addItem('打刻ログを手動で退避＆古いデータ削除', 'archiveAndCleanupLogs')
    .addItem('月次ログ退避トリガーを作成', 'setupMonthlyArchiveTrigger')
    .addSeparator()
    .addItem('打刻抜けアラートを手動実行', 'checkMissingPunches')
    .addItem('打刻抜けアラートトリガーを作成', 'setupPunchAlertTrigger')
    .addSeparator()
    .addItem('打刻ログを手動で追加する', 'showManualLogDialog')
    .addItem('打刻抜け行を赤くハイライト', 'highlightMissingPunches')
    .addToUi();
}

function showExportDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ExportDialog')
    .setWidth(360)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, '勤怠データCSV出力');
}

/**
 * 勤務種別に応じた定刻の開始・終了時間（分単位）を返す
 */
function getSchedule_(typeId) {
  let startMin = 8 * 60; // 08:00
  let endMin = 17 * 60;  // 17:00
  switch (Number(typeId)) {
    case 1: startMin = 8*60; endMin = 17*60; break;
    case 2: startMin = 18*60; endMin = 26*60; break; // 夜勤 18:00〜翌02:00
    case 3: startMin = 9*60; endMin = 16*60; break;
    case 4: startMin = 8*60; endMin = 12*60; break;
  }
  return { startMin, endMin };
}

/**
 * 年次（毎年4月1日）の有給日数追加処理とデータ最新化
 */
function updatePaidLeave() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (!masterSheet) {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert('エラー: 「従業員マスタ」シートが見つかりません。');
    return;
  }

  const masterData = masterSheet.getDataRange().getValues();
  const today = new Date();
  let updatedCount = 0;

  for (let i = 1; i < masterData.length; i++) {
    const row = i + 1;
    const empId = masterData[i][M.ID];
    const hireDateStr = masterData[i][M.HIRE_DATE];
    if (!empId || !hireDateStr) continue;

    let hireDate = parseDateSafe_(hireDateStr);
    if (!hireDate || isNaN(hireDate.getTime())) continue;

    // ▼ 初回付与日（入社日の半年後の日）
    let grantMonth = hireDate.getMonth() + 6;
    let grantYear = hireDate.getFullYear();
    if (grantMonth > 11) {
      grantMonth -= 12;
      grantYear += 1;
    }
    const baseGrantDate = new Date(grantYear, grantMonth, hireDate.getDate());
    
    let now = new Date();
    // ▼ 今日時点での最新の直近付与日（＝現在有効な有給が最後に付与された日）
    let currentGrantDate = new Date(now.getFullYear(), grantMonth, baseGrantDate.getDate());
    if (currentGrantDate.getTime() > now.getTime()) {
        currentGrantDate.setFullYear(now.getFullYear() - 1);
    }
    
    // まだ最初の付与日（半年後）に達していない場合は0日
    let legalDays = 0;
    if (baseGrantDate.getTime() <= now.getTime()) {
         let diffYears = currentGrantDate.getFullYear() - baseGrantDate.getFullYear();
         legalDays = getLegalPaidLeaveDays_(diffYears);
    }
    
    const prevStatusDateStr = Utilities.formatDate(new Date(currentGrantDate), "JST", "yyyy-MM-dd");
    const lastUpdateStr = masterData[i][M.STATUS_DATE] ? 
                          Utilities.formatDate(new Date(masterData[i][M.STATUS_DATE]), "JST", "yyyy-MM-dd") : "";
    
    // もし前回更新日が現在有効な直近の付与日より古ければ「新しい年度」に突入した証拠なのでリセット処理を行う
    if (lastUpdateStr !== prevStatusDateStr && legalDays > 0) {
       // 前年の残日数を繰越（上限＝前年の付与日数）
       let prevRemaining = Number(masterData[i][M.REMAINING]) || 0;
       // （ただし本来は2年前の繰分は捨てるが、単純化するため、前年の付与日数が上限とする）
       let prevGrant = Number(masterData[i][M.GRANTED]) || 0;
       let nextCarried = Math.min(prevRemaining, prevGrant);
       
       masterSheet.getRange(row, M.GRANTED + 1).setValue(legalDays);
       masterSheet.getRange(row, M.CARRIED + 1).setValue(nextCarried);
       masterSheet.getRange(row, M.USED + 1).setValue(0);
       let curStatusDateStr = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");
       masterSheet.getRange(row, M.STATUS_DATE + 1).setValue(curStatusDateStr);
       
       // 年次処理：小3以下の子・要介護家族がいる場合は特別休暇リセット
       if (masterData[i][M.CHILD_COUNT] > 0) {
         masterSheet.getRange(row, M.NURSING_USED + 1).setValue(0);
       }
       if (masterData[i][M.CARE_FAMILY] > 0) {
         masterSheet.getRange(row, M.CARE_USED + 1).setValue(0);
       }
       
       updatedCount++;
       continue;
    }

    // （計算だけの更新）
    const granted = Number(masterData[i][M.GRANTED]) || 0;
    const carried = Number(masterData[i][M.CARRIED]) || 0;
    const used = Number(masterData[i][M.USED]) || 0;
    masterSheet.getRange(row, M.REMAINING + 1).setValue((granted + carried) - used);
  }

  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert(`有給日数の更新完了\n${updatedCount}人の従業員に新たに有給日数が付与（年度更新）されました。`);
  } catch(e) {}
}

/**
 * 毎日の自動更新トリガー
 */
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'updatePaidLeave') {
      ScriptApp.deleteTrigger(t);
    }
    if (t.getHandlerFunction() === 'sendAnnualNursingCareReminder') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 日次トリガー (0〜1時の間に実行)
  ScriptApp.newTrigger('updatePaidLeave')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  // 年次リマインダー用トリガー (毎日呼び出し、ロジック内で3/31のみ実行)
  ScriptApp.newTrigger('sendAnnualNursingCareReminder')
    .timeBased()
    .everyDays(1)
    .atHour(10) // 10時に送信
    .create();

  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert('有給自動管理用のトリガー（毎日0時台）および\n年次リマインダートリガー（毎日10時・3/31のみ実行）が正常に作成されました。');
  } catch(e) {}
}

// ============================================
// 打刻ログの退避とCSV集計機能
// ============================================

function exportMonthlyCsv(targetMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('打刻ログ');
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (!logSheet || !masterSheet) return { error: '対象のシートが見つかりません' };

  if (targetMonth === "CURRENT") {
    // 今月
    const tmpDate = new Date();
    targetMonth = Utilities.formatDate(tmpDate, "JST", "yyyy-MM");
  } else if (!targetMonth) {
    // 指定なしなら先月
    const tmpDate = new Date();
    tmpDate.setMonth(tmpDate.getMonth() - 1);
    targetMonth = Utilities.formatDate(tmpDate, "JST", "yyyy-MM");
  }

  const { holidays1, holidays2 } = loadHolidays_(ss);

  const mData = masterSheet.getDataRange().getValues();
  const empIndex = buildEmpIndex_(mData);
  
  const lData = logSheet.getDataRange().getValues();

  // ----- 集計構造の初期化 -----
  const summary = {}; 
  for (const row of mData) {
    if (row[0] === '社員番号' || !row[0]) continue;
    const eId = String(row[0]).replace(/^'/, ""); // B4: シングルクォート除去
    summary[eId] = {
      empId: eId,
      empName: String(row[M.NAME]),
      workType: Number(row[M.WORK_TYPE]) || 1,
      totalWorkDays: 0,
      totalLateTime: 0,
      totalEarlyTime: 0,
      totalOvertime: 0,
      dailyLogs: {} 
    };
  }

  // ----- 打刻ログの解析 -----
  // B4: 重複打刻の排除（日ごとに最初と最後の記録だけを採用）
  // dailyBuffer = { [empId]: { [yyyy-mm-dd]: { inTime, outTime, inStatus, outStatus } } }
  const dailyBuffer = {};

  for (let i = 1; i < lData.length; i++) {
    const t = (lData[i][0] instanceof Date) ? lData[i][0] : new Date(lData[i][0]);
    if (isNaN(t.getTime())) continue;
    
    // 対象月のチェック (例: "2024-03" === "2024-03")
    const yyyyMM = Utilities.formatDate(t, "JST", "yyyy-MM");
    if (yyyyMM !== targetMonth) continue;

    const eIdStr = String(lData[i][1]).replace(/^'/, ""); // シングルクォート除去
    if (!summary[eIdStr]) continue;

    const action = String(lData[i][4]);
    let dateStr = Utilities.formatDate(t, "JST", "yyyy-MM-dd");

    // 夜勤(種別2)の場合：AM5:00より前の打刻は前日勤務の続きとみなす
    // 夜勤で「退勤」が翌日AM2:00等の場合、前日分の勤務としてまとめる
    if (summary[eIdStr].workType === 2 && t.getHours() < 5) {
      let prevT = new Date(t.getTime());
      prevT.setDate(prevT.getDate() - 1);
      dateStr = Utilities.formatDate(prevT, "JST", "yyyy-MM-dd");
    }

    if (!dailyBuffer[eIdStr]) dailyBuffer[eIdStr] = {};
    if (!dailyBuffer[eIdStr][dateStr]) {
      dailyBuffer[eIdStr][dateStr] = { inTime: null, outTime: null, inStatus: "", outStatus: "" };
    }

    const tMinutes = t.getHours() * 60 + t.getMinutes();

    // 出勤処理（一番早い時間を採用）
    if (action.startsWith('出勤')) {
      const db = dailyBuffer[eIdStr][dateStr];
      if (db.inTime === null || tMinutes < db.inTime) {
         db.inTime = tMinutes;
         db.inStatus = action; // '出勤' or '出勤(遅刻)'
      }
    }
    // 退勤処理（一番遅い時間を採用）
    else if (action.startsWith('退勤')) {
      const db = dailyBuffer[eIdStr][dateStr];
      // 種別2の夜勤で翌日AM打刻の場合は 24h加算して比較
      let valMin = tMinutes;
      if (summary[eIdStr].workType === 2 && t.getHours() < 5) {
         valMin += 24 * 60; 
      }
      if (db.outTime === null || valMin > db.outTime) {
         db.outTime = valMin;
         db.outStatus = action;
      }
    }
  }

  // ----- Bufferから残業・遅刻早退等の計算 -----
  for (const eId in dailyBuffer) {
    const emp = summary[eId];
    const sched = getSchedule_(emp.workType);

    for (const dateStr in dailyBuffer[eId]) {
      const db = dailyBuffer[eId][dateStr];
      if (db.inTime !== null || db.outTime !== null) {
        emp.totalWorkDays++;
      }

      // 遅刻の計算
      let lateMins = 0;
      if (db.inTime !== null && db.inTime > sched.startMin) {
        lateMins = db.inTime - sched.startMin;
        emp.totalLateTime += lateMins;
      }

      // 早退の計算
      let earlyMins = 0;
      if (db.outTime !== null && db.outTime < sched.endMin) {
        earlyMins = sched.endMin - db.outTime;
        emp.totalEarlyTime += earlyMins;
      }

      // 休日出勤の判別
      const isNight = (emp.workType === 2);
      // カレンダー休日判定
      let isHoliday = false;
      if (emp.workType === 3) {
        isHoliday = !!holidays2[dateStr];
      } else {
        isHoliday = !!holidays1[dateStr];
      }

      // 残業計算
      let overMins = 0;
      if (isHoliday) {
        // 休日は実働時間すべて残業（休憩1hを引いて計算など必要であれば調整）
        if (db.inTime !== null && db.outTime !== null) {
          overMins = (db.outTime - db.inTime) - 60; // 休憩1時間引く仮定
          if (overMins < 0) overMins = 0;
        }
      } else {
        // 平日
        if (db.outTime !== null && db.outTime > sched.endMin) {
          overMins = db.outTime - sched.endMin;
        }
      }
      emp.totalOvertime += overMins;
    }
  }

  // ----- CSV出力の組み立て -----
  let csvData = ["社員番号,氏名,勤務種別,出勤日数,遅刻・早退合計(分),残業・休日出勤合計(分)\n"];
  for (const eId in summary) {
    const d = summary[eId];
    if (d.totalWorkDays === 0) continue; // 出勤がない人は出力しない
    const row = [
      d.empId,
      d.empName,
      d.workType,
      d.totalWorkDays,
      (d.totalLateTime + d.totalEarlyTime),
      d.totalOvertime
    ].join(",");
    csvData.push(row + "\n");
  }

  const csvString = csvData.join("");
  const fName = `attendance_${targetMonth}.csv`;

  return { success: true, csvString, fileName: fName };
}

/**
 * 過去（前月以前）の打刻ログを別のスプレッドシートや別シートに退避して削除する
 */
// 削除処理と、GASからの別ファイル作成にはユーザーのドライブ権限が必要なため、
// 別シート(YYYY-MM)にコピーして古いデータを消す形の実装例
function archiveAndCleanupLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('打刻ログ');
  const ui = SpreadsheetApp.getUi();
  
  if (!logSheet) {
     if(ui) ui.alert('エラー', '打刻ログシートが見つかりません', ui.ButtonSet.OK);
     return;
  }

  const now = new Date();
  const currentMonth = Utilities.formatDate(now, "JST", "yyyy-MM");
  
  const lData = logSheet.getDataRange().getValues();
  if (lData.length <= 1) {
    if(ui) ui.alert('退避するデータがありません。');
    return;
  }

  // 月ごとにデータを仕分ける
  const rowsByMonth = {};
  for (let i = 1; i < lData.length; i++) {
    const t = lData[i][0];
    if (!(t instanceof Date) && isNaN(new Date(t).getDate())) continue;
    const dateObj = (t instanceof Date) ? t : new Date(t);
    const mStr = Utilities.formatDate(dateObj, "JST", "yyyy-MM");
    
    // 今月のデータは退避しない
    if (mStr === currentMonth) continue;
    
    if (!rowsByMonth[mStr]) {
      rowsByMonth[mStr] = [];
    }
    rowsByMonth[mStr].push(lData[i]);
  }
  
  const targetMonths = Object.keys(rowsByMonth);
  if (targetMonths.length === 0) {
    if(ui) ui.alert(`退避対象（${currentMonth} より前）のデータがありませんでした。`);
    return;
  }

  // 退避（別シートへコピー）
  for (const mStr of targetMonths) {
    let arcSheet = ss.getSheetByName('退避_' + mStr);
    if (!arcSheet) {
      arcSheet = ss.insertSheet('退避_' + mStr);
      arcSheet.appendRow(lData[0]); // ヘッダー
    }
    const rows = rowsByMonth[mStr];
    arcSheet.getRange(arcSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  // 今月のデータだけで元のシートを再構築（高速化のため上書き）
  const currentMonthRows = [lData[0]]; // ヘッダー
  for (let i = 1; i < lData.length; i++) {
    const t = lData[i][0];
    if (!(t instanceof Date) && isNaN(new Date(t).getDate())) continue;
    const dateObj = (t instanceof Date) ? t : new Date(t);
    const mStr = Utilities.formatDate(dateObj, "JST", "yyyy-MM");
    if (mStr === currentMonth) {
      currentMonthRows.push(lData[i]);
    }
  }

  // クリアしてから再書き込み
  logSheet.clearContents();
  logSheet.getRange(1, 1, currentMonthRows.length, currentMonthRows[0].length).setValues(currentMonthRows);

  if (ui) ui.alert(`前月以前の古いログを退避しました。\n対象月: ${targetMonths.join(', ')}\n打刻ログシートは当月分のみになりました。`);
}

function setupMonthlyArchiveTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'archiveAndCleanupLogs') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎月1日の 午前2時頃に古いデータを退避する
  ScriptApp.newTrigger('archiveAndCleanupLogs')
    .timeBased()
    .onMonthDay(1)
    .atHour(2)
    .create();

  try {
    SpreadsheetApp.getUi().alert('毎月1日のログ自動退避トリガーを作成しました。');
  } catch(e) {}
}


// ============================================
// B3: 打刻抜けアラート実装（メール送信）
// ============================================

/**
 * 当日の打刻状況をチェックし、打刻抜けがあれば管理者にメール通知する。
 */
function checkMissingPunches() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('打刻ログ');
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (!logSheet || !masterSheet) return;

  const now = new Date();
  const todayStr = Utilities.formatDate(now, "JST", "yyyy-MM-dd");
  
  // マスタから全従業員を取得
  const mData = masterSheet.getDataRange().getValues();
  const activeEmps = [];
  for (let i = 1; i < mData.length; i++) {
     const id = String(mData[i][M.ID]).replace(/^'/, ""); // IDのシングルクォート除去
     if (!id) continue;
     activeEmps.push({
       id: id,
       name: String(mData[i][M.NAME]),
       workType: Number(mData[i][M.WORK_TYPE]) || 1
     });
  }

  const { holidays1, holidays2 } = loadHolidays_(ss);

  // ログから本日の打刻状況を取得
  // dailyRecords = { [empId]: { inCount: 0, outCount: 0, actions: [] } }
  const dailyRecords = {};
  const lData = logSheet.getDataRange().getValues();
  for (let i = 1; i < lData.length; i++) {
    const t = lData[i][0];
    if (!t) continue;
    const dateObj = (t instanceof Date) ? t : new Date(t);
    if (isNaN(dateObj.getTime())) continue;

    let targetDateStr = Utilities.formatDate(dateObj, "JST", "yyyy-MM-dd");
    const eId = String(lData[i][1]).replace(/^'/, "");
    // 夜勤補正: 0時〜5時までの打刻は、前日の日報としてカウントする
    const empData = activeEmps.find(e => e.id === eId);
    if (empData && empData.workType === 2 && dateObj.getHours() < 5) {
       let prevDate = new Date(dateObj.getTime());
       prevDate.setDate(prevDate.getDate() - 1);
       targetDateStr = Utilities.formatDate(prevDate, "JST", "yyyy-MM-dd");
    }

    if (targetDateStr !== todayStr) continue;

    const action = String(lData[i][4]);
    if (!dailyRecords[eId]) dailyRecords[eId] = { inCount: 0, outCount: 0, actions: [] };
    dailyRecords[eId].actions.push(action);
    if (action.startsWith('出勤')) dailyRecords[eId].inCount++;
    if (action.startsWith('退勤')) dailyRecords[eId].outCount++;
  }

  let missingLogText = "";

  // 従業員ごとに判定
  for (const emp of activeEmps) {
    const rec = dailyRecords[emp.id] || { inCount: 0, outCount: 0, actions: [] };
    
    // 本日が休日かどうか
    const isHoliday = (emp.workType === 3) ? !!holidays2[todayStr] : !!holidays1[todayStr];
    
    // ★チェック条件★
    // ① 出勤回数と退勤回数が一致しない場合（インだけ or アウトだけ）
    if ((rec.inCount > 0 || rec.outCount > 0) && (rec.inCount !== rec.outCount)) {
       // まだ退勤してないだけ（勤務中）の場合は除外する。（例：トリガーが朝9時に走ったとき、出勤済みで退勤0なのは正常）
       // しかし、「昨日の夜勤」の退勤漏れ等の場合はエラーにしたいので、時間帯に応じて補正か、ここだけ手動抽出するか運用ルールによる。
       // ※ ここでは単純に「出勤があって退勤がない && 現在時刻が定刻の退勤時間を過ぎている」などで判定するのが安全。
       const sched = getSchedule_(emp.workType);
       const nowMins = now.getHours() * 60 + now.getMinutes();
       
       let isError = false;
       if (rec.inCount > rec.outCount && nowMins > (sched.endMin + 60)) {
         // 定刻の終業から1時間以上経っても退勤がない → 異常
         isError = true;
       } else if (rec.outCount > rec.inCount) {
         // 退勤だけある → 完全におかしいので異常
         isError = true;
       }
       
       if (isError) {
         missingLogText += `・${emp.name} (ID: ${emp.id}) -> 出勤:${rec.inCount}回, 退勤:${rec.outCount}回\n`;
       }
    }
  }

  // 管理者へメール送信
  if (missingLogText !== "") {
    const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!adminEmail) return;

    const subject = `【打刻抜けアラート】${todayStr} の打刻ログに不整合があります`;
    const body = `管理者様\n\n本日の打刻データにおいて、以下の従業員に「出勤と退勤の不整合(打刻抜け)」が疑われます。\n\n` + 
                 `${missingLogText}\n` +
                 `スプレッドシートの「打刻ログ」を確認し、必要に応じて修正を行ってください。`;
    
    MailApp.sendEmail(adminEmail, subject, body);
  }
}

/**
 * 打刻抜けアラートのトリガーを作成する。
 * 勤務種別ごとの定刻+1時間後にチェックするため、
 * 毎日9時（種別1,4の定刻8:00+1h）・10時（種別3の定刻9:00+1h）・19時（種別2の定刻18:00+1h）に実行。
 */
function setupPunchAlertTrigger() {
  // 既存の同名トリガーを削除（重複防止）
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'checkMissingPunches') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // 9:00 — 種別1,4 の出勤チェック (定刻8:00 + 1h)
  ScriptApp.newTrigger('checkMissingPunches')
    .timeMapBased()
    .everyDays(1)
    .atHour(9)
    .create();
  
  // 10:00 — 種別3 の出勤チェック (定刻9:00 + 1h) + 種別1,4の退勤チェックも兼ねる
  ScriptApp.newTrigger('checkMissingPunches')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();
  
  // 19:00 — 種別2(夜勤) の出勤チェック (定刻18:00 + 1h)
  ScriptApp.newTrigger('checkMissingPunches')
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .create();
    
  try {
    SpreadsheetApp.getUi().alert('打刻抜けアラートのトリガーが作成されました！\n\n' +
      '・毎日 9:00 — 種別1,4（定刻8:00）の出勤チェック\n' +
      '・毎日 10:00 — 種別3（定刻9:00）の出勤チェック + 前日退勤チェック\n' +
      '・毎日 19:00 — 種別2（夜勤 定刻18:00）の出勤チェック');
  } catch (e) {}
}

// ============================================
// 年次リマインダー: 小3以下の子・要介護家族の確認依頼メール
// トリガー設定: 毎年3月31日に実行
// ============================================
function sendAnnualNursingCareReminder() {
  // 3月31日以外は何もしない（日次トリガーで毎日呼び出し、3/31のみ実行）
  const today = new Date();
  if (today.getMonth() !== 2 || today.getDate() !== 31) return;

  const adminEmail = "admin@asami-k.co.jp";
  const subject = "【要対応】従業員マスタ更新のお願い（看護・介護休暇）";
  const body = [
    "管理者各位",
    "",
    "新年度（4月1日〜）に向けて、従業員マスタの以下項目の確認・更新をお願いします。",
    "",
    "■ 確認項目",
    "1. 小3以下の子の人数（M列）",
    "   → 各従業員に小学校3年生修了まで（9歳到達後最初の3月31日まで）の子がいるか確認してください。",
    "   → 進級・卒業により対象外となる子がいる場合は人数を減らしてください。",
    "   → 新たに出生した子がいる場合は人数を増やしてください。",
    "",
    "2. 要介護家族の人数（N列）",
    "   → 要介護状態の家族の有無に変更がないか確認してください。",
    "",
    "■ 更新方法",
    "スプレッドシート「従業員マスタ」のM列（小3以下の子の人数）およびN列（要介護家族の人数）を直接編集してください。",
    "",
    "■ 注意事項",
    "・O列（看護休暇取得済）とP列（介護休暇取得済）は有給起算日に自動リセットされるため、手動変更は不要です。",
    "・人数が0の従業員は該当する休暇を申請できません。",
    "",
    "※ このメールは勤怠管理システムから自動送信されています。",
  ].join("\n");
  
  MailApp.sendEmail(adminEmail, subject, body);
  console.log("年次リマインダーメール送信完了: " + adminEmail);
}

// ============================================
// 打刻ログ手動追加機能
// ============================================
function showManualLogDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ManualLogDialog')
    .setWidth(400)
    .setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(html, '打刻ログ手動追加');
}

function getEmployeeListForDialog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (!masterSheet) return [];
  const masterData = masterSheet.getDataRange().getValues();
  const emps = [];
  for (let i = 1; i < masterData.length; i++) {
    const id = String(masterData[i][M.ID]);
    if (id && id.trim() !== '') {
      emps.push({
        id: id,
        name: String(masterData[i][M.NAME]),
        type: Number(masterData[i][M.WORK_TYPE]) || 1
      });
    }
  }
  return emps;
}

function addManualLog(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName('打刻ログ');
    if (!logSheet) return { success: false, error: '打刻ログシートが見つかりません' };

    const dateStr = data.dateStr; // yyyy-mm-dd
    const timeStr = data.timeStr; // hh:mm
    const dateObj = new Date(`${dateStr}T${timeStr}:00`);

    // A列（タイムスタンプ）の処理
    const lastRow = logSheet.getLastRow() + 1;
    const range = logSheet.getRange(lastRow, 1, 1, 5);
    range.setNumberFormat("@"); // 全セルテキスト
    range.setValues([[dateObj, data.empId, data.empName, data.workType, data.type]]);
    // A列だけ日時書式に戻す
    logSheet.getRange(lastRow, 1).setNumberFormat("yyyy/MM/dd HH:mm:ss");

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// 打刻抜け行のハイライト機能
// ============================================
function highlightMissingPunches() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('打刻ログ');
  if (!logSheet) {
    SpreadsheetApp.getUi().alert('「打刻ログ」シートが見つかりません。');
    return;
  }
  
  const data = logSheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  // 日付・従業員ごとにイベントを集計
  const logsMap = {}; 

  for (let i = 1; i < data.length; i++) {
    const time = data[i][0];
    const eId = String(data[i][1]);
    const action = String(data[i][4]);
    if (!time || !eId) continue;
    
    let d = (time instanceof Date) ? time : new Date(time);
    if (isNaN(d.getTime())) continue;
    
    let logYY = d.getFullYear();
    let logMM = d.getMonth();
    let logDD = d.getDate();
    let dateKey = `${logYY}-${String(logMM+1).padStart(2,'0')}-${String(logDD).padStart(2,'0')}`;
    let key = `${eId}_${dateKey}`;
    
    if (!logsMap[key]) {
      logsMap[key] = { inTotal: 0, outTotal: 0, rows: [] };
    }
    
    logsMap[key].rows.push(i);
    
    if (action.startsWith('出勤')) logsMap[key].inTotal++;
    if (action.startsWith('退勤')) logsMap[key].outTotal++;
  }
  
  // 赤く塗りつぶす行の判定
  const errorRows = new Set();
  const todayStr = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");

  for (const key in logsMap) {
    const logInfo = logsMap[key];
    const [empId, dateKey] = key.split('_');
    
    if (logInfo.inTotal !== logInfo.outTotal) {
      if (dateKey === todayStr && logInfo.inTotal > logInfo.outTotal) {
        continue; // 今日の出勤済みでまだ退勤していない場合はスキップ
      }
      logInfo.rows.forEach(r => errorRows.add(r));
    }
  }
  
  const numRows = data.length;
  const numCols = data[0].length;
  const newColors = Array(numRows).fill(null).map(() => Array(numCols).fill(null));
  
  for (let i = 1; i < data.length; i++) {
    if (errorRows.has(i)) {
      newColors[i].fill('#ffdddd'); 
    } else {
      newColors[i].fill('#ffffff'); 
    }
  }
  
  const colorRange = logSheet.getRange(1, 1, numRows, numCols);
  const currentColors = colorRange.getBackgrounds();
  newColors[0] = currentColors[0];
  colorRange.setBackgrounds(newColors);
  
  SpreadsheetApp.getUi().alert(`打刻抜けの行を赤くハイライトしました。\n対象行数: ${errorRows.size}行`);
}
