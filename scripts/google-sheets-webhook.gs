const LEAD_HEADERS = [
  "received_at",
  "name",
  "email",
  "phone",
  "business",
  "package",
  "details",
  "status",
  "last_contacted",
  "follow_up_date",
  "notes",
];
const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Proposal sent", "Won", "Lost"];

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeCell(value) {
  const text = String(value ?? "");
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function prepareLeadSheet(sheet) {
  let headersChanged = false;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LEAD_HEADERS.length).setValues([LEAD_HEADERS]);
    headersChanged = true;
  } else {
    const lastColumn = Math.max(sheet.getLastColumn(), 1);
    const existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
      .map((header) => header.trim());
    LEAD_HEADERS.forEach((header) => {
      if (!existingHeaders.includes(header)) {
        existingHeaders.push(header);
        headersChanged = true;
      }
    });
    if (headersChanged) {
      sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
    }
  }

  const headerMap = new Map(
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      .map((header, index) => [header.trim(), index + 1]),
  );
  if (!headersChanged) return headerMap;

  const columnCount = sheet.getLastColumn();
  const maxRows = sheet.getMaxRows();
  const statusRange = sheet.getRange(2, headerMap.get("status"), maxRows - 1, 1);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LEAD_STATUSES, true)
    .setAllowInvalid(false)
    .build();

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground("#1d1d1f")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setWrap(true);
  sheet.setRowHeight(1, 36);
  statusRange.setDataValidation(statusRule);
  sheet.getRange(2, headerMap.get("last_contacted"), maxRows - 1, 1)
    .setNumberFormat("yyyy-mm-dd");
  sheet.getRange(2, headerMap.get("follow_up_date"), maxRows - 1, 1)
    .setNumberFormat("yyyy-mm-dd");
  sheet.setColumnWidth(headerMap.get("received_at"), 170);
  sheet.setColumnWidth(headerMap.get("name"), 160);
  sheet.setColumnWidth(headerMap.get("email"), 220);
  sheet.setColumnWidth(headerMap.get("phone"), 150);
  sheet.setColumnWidth(headerMap.get("business"), 180);
  sheet.setColumnWidth(headerMap.get("package"), 150);
  sheet.setColumnWidth(headerMap.get("details"), 320);
  sheet.setColumnWidth(headerMap.get("status"), 140);
  sheet.setColumnWidth(headerMap.get("last_contacted"), 140);
  sheet.setColumnWidth(headerMap.get("follow_up_date"), 140);
  sheet.setColumnWidth(headerMap.get("notes"), 260);
  sheet.getRange(2, headerMap.get("details"), maxRows - 1, 1).setWrap(true);
  sheet.getRange(2, headerMap.get("notes"), maxRows - 1, 1).setWrap(true);

  const filters = sheet.getFilter();
  const filterRange = sheet.getRange(1, 1, maxRows, columnCount);
  if (filters) {
    filters.setRange(filterRange);
  } else {
    filterRange.createFilter();
  }

  return headerMap;
}

function doPost(event) {
  const properties = PropertiesService.getScriptProperties();
  const expectedToken = properties.getProperty("WEBHOOK_TOKEN");
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  if (!expectedToken || !spreadsheetId) {
    console.error("Lead recording is not configured: required script properties are missing.");
    return jsonResponse({ success: false, recorded: false });
  }

  let data;
  try {
    data = JSON.parse(event.postData.contents);
  } catch (error) {
    return jsonResponse({ success: false, recorded: false });
  }

  if (!data || data.token !== expectedToken
    || typeof data.name !== "string"
    || typeof data.email !== "string"
    || typeof data.details !== "string") {
    return jsonResponse({ success: false, recorded: false });
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName("Leads");
    if (!sheet) {
      console.error("Lead recording failed: the Leads sheet tab was not found.");
      return jsonResponse({ success: false, recorded: false });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const headerMap = prepareLeadSheet(sheet);
      const lead = {
        received_at: data.received_at,
        name: data.name,
        email: data.email,
        phone: data.phone,
        business: data.business,
        package: data.package,
        details: data.details,
        status: "New",
        last_contacted: "",
        follow_up_date: "",
        notes: "",
      };
      const row = Array(sheet.getLastColumn()).fill("");
      headerMap.forEach((column, header) => {
        row[column - 1] = safeCell(lead[header] ?? "");
      });
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ success: true, recorded: true });
  } catch (error) {
    console.error("Lead could not be recorded in Google Sheets.", error);
    return jsonResponse({ success: false, recorded: false });
  }
}
