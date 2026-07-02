/**
 * 출석체크 — 구글 시트 Apps Script
 *
 * 시트 구성:
 * - 「학생명단」 A열: 이름, B열: 반(선택)
 * - 「출석기록」 자동 생성 (날짜, 이름, 상태, 기록시각)
 */
const CONFIG = {
  ROSTER_SHEET: "학생명단",
  LOG_SHEET: "출석기록",
  NAME_COL: 1,
  CLASS_COL: 2,
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("출석체크")
    .addItem("출석체크 열기", "showAttendanceCheck")
    .addItem("웹앱 URL 안내", "showWebAppHelp")
    .addToUi();
}

function showAttendanceCheck() {
  const html = HtmlService.createTemplateFromFile("AttendanceCheck")
    .evaluate()
    .setTitle("출석체크")
    .setWidth(640)
    .setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, "출석체크");
}

function showWebAppHelp() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "웹앱(확대 화면) 배포",
    "1. 확장 프로그램 > Apps Script\n" +
      "2. 배포 > 새 배포 > 유형: 웹 앱\n" +
      "3. 액세스: 본인 또는 링크가 있는 모든 사용자\n" +
      "4. 배포 후 URL을 태블릿/폰에서 열면 전체 화면 출석체크를 쓸 수 있습니다.\n\n" +
      "이 저장소의 google-sheets/attendance-check/README.md 도 참고하세요.",
    ui.ButtonSet.OK
  );
}

/** 웹앱 배포 시 진입점 */
function doGet() {
  return HtmlService.createTemplateFromFile("AttendanceCheck")
    .evaluate()
    .setTitle("출석체크")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function getAttendanceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName(CONFIG.ROSTER_SHEET);
  if (!roster) {
    throw new Error(
      "「" + CONFIG.ROSTER_SHEET + "」 시트가 없습니다. A열에 학생 이름을 넣어 주세요."
    );
  }

  const today = formatDateKorea_(new Date());
  const values = roster.getDataRange().getValues();
  const students = [];

  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][CONFIG.NAME_COL - 1] || "").trim();
    if (!name || name === "이름") continue;
    students.push({
      row: i + 1,
      name: name,
      className: String(values[i][CONFIG.CLASS_COL - 1] || "").trim(),
    });
  }

  return {
    today: today,
    students: students,
    marked: getMarkedToday_(ss, today),
  };
}

function markAttendance(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ensureLogSheet_(ss);
  const today = formatDateKorea_(new Date());
  const name = String((payload && payload.name) || "").trim();
  const status = String((payload && payload.status) || "출석").trim();

  if (!name) {
    throw new Error("이름이 비어 있습니다.");
  }

  const values = log.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowName = String(values[i][1] || "").trim();
    if (formatDateKorea_(rowDate) === today && rowName === name) {
      log.getRange(i + 1, 3).setValue(status);
      log.getRange(i + 1, 4).setValue(new Date());
      return { ok: true, updated: true, name: name, status: status };
    }
  }

  log.appendRow([today, name, status, new Date()]);
  return { ok: true, updated: false, name: name, status: status };
}

function ensureLogSheet_(ss) {
  let log = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(CONFIG.LOG_SHEET);
    log.appendRow(["날짜", "이름", "상태", "기록시각"]);
    log.setFrozenRows(1);
    log.setColumnWidth(1, 110);
    log.setColumnWidth(2, 120);
    log.setColumnWidth(3, 72);
    log.setColumnWidth(4, 160);
  }
  return log;
}

function getMarkedToday_(ss, today) {
  const log = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!log) return {};

  const values = log.getDataRange().getValues();
  const marked = {};
  for (let i = 1; i < values.length; i++) {
    const rowDate = values[i][0];
    const name = String(values[i][1] || "").trim();
    if (!name) continue;
    if (formatDateKorea_(rowDate) === today) {
      marked[name] = String(values[i][2] || "출석");
    }
  }
  return marked;
}

function formatDateKorea_(d) {
  return Utilities.formatDate(new Date(d), "Asia/Seoul", "yyyy-MM-dd");
}
