function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setTitle('社内打刻システム');
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
  const calSheet = ss.getSheetByName('会社カレンダー');
  const holidays1 = {}; 
  const holidays2 = {};
  if (calSheet) {
     const cData = calSheet.getDataRange().getValues();
     for (let i = 1; i < cData.length; i++) {
        if (!cData[i][0]) continue;
        let dStr = (cData[i][0] instanceof Date) ? Utilities.formatDate(cData[i][0], "JST", "yyyy-MM-dd") : String(cData[i][0]).replace(/\\//g, "-");
        holidays1[dStr] = (cData[i][1] === '休日');
        holidays2[dStr] = (cData[i][2] === '休日');
     }
  }
  const todayDashStr = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");
  
  const todayStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");
  
  return masterData.map(emp => {
    const empId = String(emp[0]); 
    const empName = emp[1];   
    const empType = Number(emp[2]) || emp[2];   
    
    const granted = Number(emp[7]) || 0;
    const used = Number(emp[9]) || 0;
    const remaining = Number(emp[10]) || 0;

    const hireDateStr = emp[11];
    let deadlineStr = "";
    if (hireDateStr) {
      let hireDate = (hireDateStr instanceof Date) ? hireDateStr : new Date(hireDateStr);
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
      try {
        let t = latestLog[empId].time;
        let d = (t instanceof Date) ? t : new Date(t);
        lastDateStr = Utilities.formatDate(d, "JST", "yyyy/MM/dd");
      } catch(e) {}
    }
    
    const isNightShift = (empType === '夜勤');
    const typeNum = Number(emp[6]) || 0; // G列
    const isTodayHoliday = (typeNum === 3) ? !!holidays2[todayDashStr] : !!holidays1[todayDashStr];
    
    // 日付が変わったら一般の人は「未出勤」にリセット（夜勤は日またぎの業務があるためリセットから除外）
    if (!isNightShift && lastDateStr !== todayStr) {
      lastStatus = "未出勤";
    }
    
    return { 
      id: empId, name: empName, type: empType, isHoliday: isTodayHoliday, 
      status: lastStatus, granted: granted, used: used, remaining: remaining, deadline: deadlineStr 
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
  // ゼロ落ちを防ぐため、マスタ側の厳密な文字列データを取得する
  let exactEmpId = empId; 
  for (let i = 1; i < masterData.length; i++) {
    if (masterData[i][0].toString() === empId.toString()) {
      exactEmpId = masterData[i][0].toString();
      empName = masterData[i][1];
      workType = masterData[i][2];
      // 該当行の5列目（E列）にステータス、6列目（F列）に今日の日付を書き込む
      masterSheet.getRange(i + 1, 5, 1, 2).setValues([[type, todayStr]]);
      break;
    }
  }

  logSheet.appendRow([now, exactEmpId, empName, workType, type]);
  
  // appendRowによる自動数値化（00123 -> 123等）を防ぐため、
  // B列を書式なしテキスト（"@"）に指定した上で、元のID文字列を再度上書きする
  const lastRow = logSheet.getLastRow();
  const idCell = logSheet.getRange(lastRow, 2);
  idCell.setNumberFormat("@");
  idCell.setValue(exactEmpId);

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
  
  const adminEmail = "admin@asami-k.co.jp"; // ★管理者のアドレスに変更してください
  const subject = `【打刻修正申請】${empName}様より`;
  const body = `${empName}様より打刻の修正申請がありました。\n\n対象日: ${date}\n申告内容: ${reason}\n詳細: ${details}\n\n「打刻修正申請」シートを確認してください。`;
  MailApp.sendEmail(adminEmail, subject, body);
  
  
  return true;
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
  
  const now = new Date();
  plSheet.appendRow([now, "'" + empId, empName, date, reason || "（記載なし）", "FALSE"]);
  
  // 追加した行のF列だけをチェックボックス化する
  const lastRow = plSheet.getLastRow();
  plSheet.getRange(lastRow, 6).insertCheckboxes();
  
  // 従業員マスタの「取得済日数（J列）」を+1する処理
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (masterSheet) {
    const masterData = masterSheet.getDataRange().getValues();
    // ヘッダーを除外して検索
    for (let i = 1; i < masterData.length; i++) {
        // IDの一致確認
        if (masterData[i][0].toString() === empId.toString()) {
            const currentUsed = Number(masterData[i][9]) || 0; // J列はインデックス9
            masterSheet.getRange(i + 1, 10).setValue(currentUsed + 1); 
            break;
        }
    }
  }
  
  // ▼▼ Kintoneアプリ324へのデータ連携処理を追加 ▼▼
  const kintoneDomain = "asamikogyo.cybozu.com";
  const appId = 324;
  const apiToken = "Th1LcsNCo1Nn6t1DNjn3i8SSuuuIfuIST0s9DQSv";
  
  // 休暇日のフォーマット変換 (YYYY-MM-DD 形式で送る必要がある)
  let kintoneDate = "";
  if (date) {
    try {
      let d = new Date(date);
      if (!isNaN(d.getTime())) {
        kintoneDate = Utilities.formatDate(d, "JST", "yyyy-MM-dd");
      } else {
        kintoneDate = date; // 変換できない場合はそのまま送る
      }
    } catch (e) {
      kintoneDate = date;
    }
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
    const response = UrlFetchApp.fetch(`https://${kintoneDomain}/k/v1/record.json`, options);
    // Kintone側のレコード登録成功後、採番されたIDをシートのG列(7列目)に記録する
    const json = JSON.parse(response.getContentText());
    if (json && json.id) {
       plSheet.getRange(lastRow, 7).setValue(json.id);
    }
  } catch (e) {
    console.error("Kintone API Error: " + e.message);
  }
  // ▲▲ Kintoneアプリへのデータ連携処理 ここまで ▲▲
  
  return true;
}

// ============================================
// 有給休暇行の取消（日数戻し＆行削除）共通処理
// ============================================
function cancelPaidLeaveRow(ss, sheet, rowNum, empIdStr) {
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (masterSheet) {
    const masterData = masterSheet.getDataRange().getValues();
    for (let i = 1; i < masterData.length; i++) {
        // シングルクォートなどが混入した場合に備え、純粋に文字列比較
        const idA = masterData[i][0].toString().replace(/^'/, "");
        const idB = empIdStr.toString().replace(/^'/, "");
        
        if (idA === idB) {
            const currentUsed = Number(masterData[i][9]) || 0;
            // 取得済日数を -1 して戻す（0未満にはしない）
            if (currentUsed > 0) {
               masterSheet.getRange(i + 1, 10).setValue(currentUsed - 1); 
            }
            break;
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
// Kintone Webhook 受信口 (有給取消の連動)
// ============================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("No contents");
    }
    const data = JSON.parse(e.postData.contents);
    
    // KintoneのWebhookから送られてくるレコード情報
    const record = data.record;
    // 「C取消」フィールドが選択されているか確認
    if (record && record["C取消"] && record["C取消"].value && record["C取消"].value.includes("取消・差戻")) {
      const kintoneId = record.$id ? record.$id.value : (record.レコード番号 ? record.レコード番号.value : null);
      if (!kintoneId) return ContentService.createTextOutput("No Kintone ID");
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('有給休暇申請');
      // // シートが見つからない場合は処理を終了
      if (!sheet) return ContentService.createTextOutput("No Sheet found");
      
      const plData = sheet.getDataRange().getValues();
      // 下から最新の行を検索（複数ある場合は直近の1件を優先）
      for (let i = plData.length - 1; i >= 1; i--) {
         // G列(インデックス6)が Kintoneのレコード番号と一致するか
         if (plData[i][6] && plData[i][6].toString() === kintoneId.toString()) {
            const rowNum = i + 1;
            const empId = plData[i][1].toString();
            // すでにF列(インデックス5)がTRUEになっていないことを確認（二重実行防止）
            if (plData[i][5] !== true && plData[i][5] !== "TRUE") {
              cancelPaidLeaveRow(ss, sheet, rowNum, empId);
            }
            break; 
         }
      }
    }
    return ContentService.createTextOutput("Success");
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
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
    .addToUi();
}

function showExportDialog() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: sans-serif; padding: 20px; color: #333; }
    select, button { padding: 8px; font-size: 14px; margin-bottom: 15px; width: 100%; box-sizing: border-box; }
    button { background-color: #0984e3; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold; }
    button:hover { background-color: #74b9ff; }
    #status { font-size: 13px; color: #d63031; text-align: center; }
  </style>
</head>
<body>
  <label>対象月</label>
  <select id="monthSelect"></select>
  
  <label>締め日区分 / 対象</label>
  <select id="closingType">
    <option value="25">25日締め (勤務種別 1, 2, 3)</option>
    <option value="月末">月末日締め (勤務種別 4)</option>
  </select>
  
  <button id="btn" onclick="generate()">CSVダウンロード</button>
  <div id="status"></div>
  
  <script>
    const sel = document.getElementById('monthSelect');
    const now = new Date();
    for(let i = -1; i < 6; i++){
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const mStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0');
       const opt = document.createElement('option');
       opt.value = mStr; opt.textContent = mStr;
       sel.appendChild(opt);
    }
    document.getElementById('monthSelect').selectedIndex = 1;

    function generate() {
      document.getElementById('status').innerText = '現在集計しています... 数秒お待ちください。';
      document.getElementById('btn').disabled = true;
      const ym = document.getElementById('monthSelect').value;
      const type = document.getElementById('closingType').value;
      google.script.run.withSuccessHandler(download).withFailureHandler(err).generateAggregatedCSV(ym, type);
    }
    function download(base64) {
      if (!base64) { err("対象期間の有効なデータが見つかりませんでした。"); return; }
      const ym = document.getElementById('monthSelect').value;
      const type = document.getElementById('closingType').value;
      
      // dataURIによるダウンロードは最近のブラウザセキュリティでファイル名が無視されることがあるため、Blobを利用
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: 'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = \`勤怠集計_\${ym}_\${type}締め.csv\`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
         URL.revokeObjectURL(url);
         document.body.removeChild(a);
         err("ダウンロードを開始しました！");
         setTimeout(() => google.script.host.close(), 2500);
      }, 100);
    }
    function err(msg) {
      document.getElementById('status').innerText = msg;
      document.getElementById('btn').disabled = false;
    }
  </script>
</body>
</html>
  `)
  .setWidth(360)
  .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, '勤怠データCSV出力');
}

function generateAggregatedCSV(ymStr, closingType) {
  const parts = ymStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-based month
  
  let startDate, endDate;
  if (closingType === '25') {
    startDate = new Date(y, m - 1, 26, 0, 0, 0); 
    endDate = new Date(y, m, 25, 23, 59, 59); 
  } else {
    startDate = new Date(y, m, 1, 0, 0, 0); 
    endDate = new Date(y, m + 1, 0, 23, 59, 59); 
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. カレンダー
  const calSheet = ss.getSheetByName('会社カレンダー');
  const holidays1 = {}; 
  const holidays2 = {};
  if (calSheet) {
     const data = calSheet.getDataRange().getValues();
     for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        let dStr = (data[i][0] instanceof Date) 
          ? Utilities.formatDate(data[i][0], "JST", "yyyy-MM-dd") 
          : String(data[i][0]).replace(/\\//g, "-");
        holidays1[dStr] = (data[i][1] === '休日');
        holidays2[dStr] = (data[i][2] === '休日');
     }
  }
  
  // 2. マスタ読取
  const masterSheet = ss.getSheetByName('従業員マスタ');
  if (!masterSheet) return "";
  const masterData = masterSheet.getDataRange().getValues();
  const emps = []; 
  const empById = {};
  for (let i = 1; i < masterData.length; i++) {
     const t = Number(masterData[i][6]) || 0; // G列 (Index=6)
     const empId = String(masterData[i][0]);
     const name = masterData[i][1];
     if (closingType === '25' && !(t === 1 || t === 2 || t === 3)) continue;
     if (closingType === '月末' && t !== 4) continue;
     const emp = { id: empId, name: name, type: t };
     emps.push(emp);
     empById[empId] = emp;
  }
  
  // 3. 有給休暇
  const plSheet = ss.getSheetByName('有給休暇申請');
  const paidLeavesStr = {};
  if (plSheet) {
    const data = plSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][5] === true || data[i][5] === "TRUE") continue; // 差戻
      let d = data[i][3];
      if (!d) continue;
      let dStr = (d instanceof Date) ? Utilities.formatDate(d, "JST", "yyyy-MM-dd") : String(d);
      paidLeavesStr[data[i][1].toString() + "_" + dStr] = true;
    }
  }
  
  // 4. 打刻ログ
  const logSheet = ss.getSheetByName('打刻ログ');
  const eventsByUser = {}; 
  if (logSheet) {
    const data = logSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        const time = data[i][0];
        const eId = data[i][1] ? String(data[i][1]) : '';
        const action = data[i][4];
        if (!time || !eId || !empById[eId]) continue;
        const d = (time instanceof Date) ? time : new Date(time);
        
        // パディングを持たせて前後を少し広く読み取る（日またぎ対応）
        if (d.getTime() < startDate.getTime() - 86400000 || d.getTime() > endDate.getTime() + 86400000) continue;
        
        if (!eventsByUser[eId]) eventsByUser[eId] = [];
        eventsByUser[eId].push({ time: d, action: action });
    }
  }
  
  const getOverlap = (wS, wE, oS, oE) => {
      let s = Math.max(wS, oS);
      let e = Math.min(wE, oE);
      return Math.max(0, (e - s) / 60000); 
  };
  
  const results = [];
  
  for (let emp of emps) {
     let evs = eventsByUser[emp.id] || [];
     evs.sort((a,b) => a.time.getTime() - b.time.getTime());
     
     let totalDays = 0, realWork = 0, regOT = 0, nightOT = 0;
     let holDays = 0, holWork = 0, lateCount = 0, lateTime = 0, absDays = 0;
     
     // 「出勤」ベースでブロック分け
     let blocks = [];
     let curBlock = null;
     for (let e of evs) {
       if (e.action === '出勤') {
          if (curBlock) blocks.push(curBlock);
          curBlock = { inT: e.time, outT: null, brks: [], lastBrk: null };
       } else if (e.action === '退勤') {
          if (curBlock) {
             curBlock.outT = e.time;
             blocks.push(curBlock);
             curBlock = null;
          }
       } else if (e.action === '外出') {
          if (curBlock) curBlock.lastBrk = e.time;
       } else if (e.action === '帰社') {
          if (curBlock && curBlock.lastBrk) {
             curBlock.brks.push({ s: curBlock.lastBrk, e: e.time });
             curBlock.lastBrk = null;
          }
       }
     }
     if (curBlock) blocks.push(curBlock);
     
     let workingDatesSeen = {};
     let isType134 = (emp.type === 1 || emp.type === 3 || emp.type === 4);
     
     let tScheduledStartMin = 0, tScheduledEndMin = 0;
     if (emp.type === 1 || emp.type === 4) { tScheduledStartMin = 8*60; tScheduledEndMin = 17*60; }
     if (emp.type === 2) { tScheduledStartMin = 18*60; tScheduledEndMin = 26*60; }
     if (emp.type === 3) { tScheduledStartMin = 9*60; tScheduledEndMin = 17*60; }
     
     for (let b of blocks) {
        if (!b.outT) continue;
        const inJST = new Date(b.inT.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        
        let logYY = inJST.getFullYear();
        let logMM = inJST.getMonth();
        let logDD = inJST.getDate();
        let logicalDate = new Date(logYY, logMM, logDD);
        
        // 月次期間の判定
        if (logicalDate.getTime() < startDate.getTime() || logicalDate.getTime() > endDate.getTime()) {
           continue; 
        }
        
        let dStr = Utilities.formatDate(logicalDate, "JST", "yyyy-MM-dd");
        workingDatesSeen[dStr] = true;
        
        let isHoliday = (emp.type === 3) ? !!holidays2[dStr] : !!holidays1[dStr];
        
        let midNight = logicalDate.getTime();
        let sStart = midNight + tScheduledStartMin * 60000;
        let sEnd   = midNight + tScheduledEndMin * 60000;
        let nightThresh = midNight + 22 * 60 * 60000;
        let fixBrkS = midNight + 12 * 60 * 60000;
        let fixBrkE = midNight + 13 * 60 * 60000;
        
        let inMS = b.inT.getTime();
        let outMS = b.outT.getTime();
        
        // 休憩控除ロジック（重なり分のみ）
        let getManualBrkSum = (wS, wE) => {
           let sum = 0;
           for (let brk of b.brks) sum += getOverlap(wS, wE, brk.s.getTime(), brk.e.getTime());
           return sum;
        };
        
        // 休日出勤
        if (isHoliday) {
            holDays++;
            totalDays++; // 休日勤務日数を出勤日数に加算
            let adjustedIn = Math.max(inMS, sStart); // 休日も早出カット
            let w = Math.max(0, outMS - adjustedIn) / 60000;
            // 休日の定刻跨ぎでも原則・固定＆手動を控除
            let bF = isType134 ? getOverlap(adjustedIn, outMS, fixBrkS, fixBrkE) : 0;
            let bM = getManualBrkSum(adjustedIn, outMS);
            holWork += Math.max(0, w - bF - bM);
            continue;
        }
        
        // 基本勤務
        totalDays++;
        
        // 早出は切り捨て
        let adjustedIn = Math.max(inMS, sStart); 
        // 修正: 実働時間は定刻終了時間を上限とする（残業分を含まない）
        let adjustedOut = Math.min(outMS, sEnd);
        
        let workedMins = Math.max(0, adjustedOut - adjustedIn) / 60000;
        // 定刻内の労働時間から休憩を控除
        let bF = isType134 ? getOverlap(adjustedIn, adjustedOut, fixBrkS, fixBrkE) : 0;
        let bM = getManualBrkSum(adjustedIn, adjustedOut);
        
        realWork += Math.max(0, workedMins - bF - bM);
        
        // 遅刻カウント (定刻より遅い)
        if (inMS > sStart) {
           lateTime += (inMS - sStart) / 60000;
           lateCount++;
        }
        // 早退カウント (定刻修了より早い)
        if (outMS < sEnd) {
           lateTime += (sEnd - outMS) / 60000;
           lateCount++;
        }
        // 外出がある場合も遅刻早退回数へ足す
        if (b.brks.length > 0) {
            lateCount += b.brks.length;
            lateTime += bM;
        }
        
        // 普通残業と深夜残業
        if (emp.type === 2) { 
            // 種別2: 深夜割増ナシ、2時以降はすべて普通残業
            let baseOT = Math.max(0, outMS - sEnd) / 60000;
            let bpOT = getManualBrkSum(Math.max(adjustedIn, sEnd), outMS);
            regOT += Math.max(0, baseOT - bpOT);
        } else {
            // 種別1, 3, 4: 17:00以降を普通残業とし、22時またぎを深夜残業へ分割
            let regOTMins = getOverlap(sEnd, nightThresh, adjustedIn, outMS);
            let bpReg = getManualBrkSum(Math.max(adjustedIn, sEnd), Math.min(nightThresh, outMS));
            regOT += Math.max(0, regOTMins - bpReg);
            
            let nOTMins = getOverlap(nightThresh, outMS + 86400000, adjustedIn, outMS);
            let bpNight = getManualBrkSum(Math.max(adjustedIn, nightThresh), outMS);
            nightOT += Math.max(0, nOTMins - bpNight);
        }
     }
     
     // 有給日数・欠勤日数の集計
     let paidLeaveCount = 0;
     let todayTime = new Date().getTime();
     for (let ts = startDate.getTime(); ts <= endDate.getTime(); ts += 86400000) {
         let dDate = new Date(ts);
         let dStr = Utilities.formatDate(dDate, "JST", "yyyy-MM-dd");
         if (paidLeavesStr[emp.id + "_" + dStr]) {
            paidLeaveCount++;
            continue;
         }
         if (dDate.getTime() > todayTime) continue; // 未来日は欠勤にしない
         let isHoliday = (emp.type === 3) ? holidays2[dStr] : holidays1[dStr];
         if (!isHoliday && !workingDatesSeen[dStr]) {
             absDays++;
         }
     }
     
     // 部門修正: 1, 2, 3 は "浅見工業株式会社"、4 は "株式会社アサミ"
     let dept = (emp.type === 4) ? "株式会社アサミ" : "浅見工業株式会社";
     const f = (val) => (val / 60).toFixed(2);
     
     results.push([
        emp.id, emp.name, dept, 
        totalDays, f(realWork), f(regOT), f(nightOT), 
        holDays, f(holWork), paidLeaveCount, absDays, lateCount, f(lateTime)
     ]);
  }
  
  // CSV構築 (UTF-8 BOM付き)
  let csvRows = [];
  csvRows.push(['従業員番号', '従業員名', '部門', '出勤日数', '実働時間', '普通残業時間', '深夜残業時間', '休日出勤日数', '休日勤務時間', '有給日数', '欠勤日数', '遅刻早退回数', '遅刻早退時間'].join(','));
  for (let r of results) {
     let escaped = r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"');
     csvRows.push(escaped.join(','));
  }
  
  const csvContent = "\\uFEFF" + csvRows.join('\\r\\n');
  return Utilities.base64Encode(Utilities.newBlob(csvContent).getBytes());
}

function setupDailyTrigger() {
  // すでに同じトリガーがある場合は重複を防ぐために一扫する
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'updatePaidLeave') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // 毎日 深夜1時〜2時の間に自動実行する設定
  ScriptApp.newTrigger('updatePaidLeave')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
    
  SpreadsheetApp.getUi().alert("毎晩 深夜1時 に有給を自動更新する設定が完了しました！\n（PCやスプレッドシートを閉じていてもクラウド上で実行されます）");
}

function updatePaidLeave() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('従業員マスタ');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  // 今日の日付 (JST)
  const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  const todayStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd");

  let modifiedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const hireDateValue = data[i][11]; // L列: 入社日 (Index 11)
    if (!hireDateValue || !(hireDateValue instanceof Date)) continue;

    let hireDate = new Date(hireDateValue.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    
    let isGrantDay = false;
    let newLegalDays = 0;
    
    // (1) 入社から半年後の計算
    let d = new Date(hireDate.getTime());
    d.setMonth(d.getMonth() + 6);
    
    // 今日が「初回の付与日」か判定
    if (Utilities.formatDate(d, "JST", "yyyy/MM/dd") === todayStr) {
        isGrantDay = true;
        newLegalDays = 10;
    }
    
    // 初期セットアップ時の「今の勤続年数なら何日付与されているべきか」算出用
    let maxGrantedSoFar = 0;
    if (now >= d) maxGrantedSoFar = 10;
    
    // (2) 1.5年以降 (50年分まで対応)
    for (let y = 1; y <= 50; y++) {
        let anny = new Date(d.getTime());
        anny.setFullYear(anny.getFullYear() + y);
        
        // 法定付与日数（1.5年=11 → 2.5年=12 → 3.5年=14 → 4.5年=16 → 5.5年=18 → 6.5年以上=Max20）
        let days = y === 1 ? 11 : y === 2 ? 12 : y === 3 ? 14 : y === 4 ? 16 : y === 5 ? 18 : 20;

        if (now >= anny) {
            maxGrantedSoFar = days;
        }

        // 今日が「1年ごとの付与日」か判定
        if (Utilities.formatDate(anny, "JST", "yyyy/MM/dd") === todayStr) {
            isGrantDay = true;
            newLegalDays = days;
            break;
        }
    }
    
    const currentGranted = data[i][7]; // H列: 総付与日数
    
    // ==========================================
    // 【A】本日が何らかの付与日であれば、有給の付与＆繰越処理を実行
    // ==========================================
    if (isGrantDay) {
        let prevGranted = Number(currentGranted) || 0;
        let prevCarried = Number(data[i][8]) || 0; // I列: 繰越日数
        let prevUsed    = Number(data[i][9]) || 0; // J列: 取得済日数
        
        // 前年度の残日数
        let remaining = prevGranted + prevCarried - prevUsed;
        if (remaining < 0) remaining = 0;
        
        // 残日数を「今年の繰越」に回す（※労基法の2年時効により、さらに1年前の繰越分は消滅。つまり前年度付与分だけが残る）
        let newCarried = remaining;
        if (newCarried > prevGranted) {
           newCarried = prevGranted;
        }
        
        // スプレッドシートへ書き込み (1-indexed 配列のため 行番号は i+1)
        sheet.getRange(i + 1, 8).setValue(newLegalDays); // H列: 今年の新たな総付与(例：12など)
        sheet.getRange(i + 1, 9).setValue(newCarried);   // I列: 繰越日数
        sheet.getRange(i + 1, 10).setValue(0);           // J列: 取得済日数はゼロにリセット
        modifiedCount++;
    } 
    // ==========================================
    // 【B】過去に一度も総付与日数が入力されていない場合（システムの初期導入時）
    // ==========================================
    else if (currentGranted === "" || currentGranted == null) {
        if (maxGrantedSoFar > 0) {
            // 現在の勤続年数に応じた正しい総付与日数をセットする
            sheet.getRange(i + 1, 8).setValue(maxGrantedSoFar);
            // ※取得済・繰り越しはユーザー自身が手動で過去データを入力するため、あえて0リセットしない
        }
    }
  }

  // ==========================================
  // 【C】K列（有給残日数）に数式「=H2+I2-J2」を一括セット
  // ==========================================
  // 管理者が手動でJ列の「取得済日数」を打った瞬間に、画面上ですぐにK列の有給残日数が減るように関数式を入れる
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const kRange = sheet.getRange(2, 11, lastRow - 1); 
    kRange.setFormula('=H2+I2-J2');
  }
  
  try {
     SpreadsheetApp.getActiveSpreadsheet().toast(`処理が完了しました！\n本日、新たに有給がリセット＆付与された人数: ${modifiedCount}名`, "完了");
  } catch(e) {} // サーバーからの時間駆動トリガー時はtoastが使えないため無視
}