const LEAD_HEADERS = [
  "received_at",
  "name",
  "email",
  "phone",
  "business",
  "package",
  "details",
  "status",
];

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeCell(value) {
  const text = String(value ?? "");
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
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
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(LEAD_HEADERS);
      }
      sheet.appendRow([
        data.received_at,
        data.name,
        data.email,
        data.phone,
        data.business,
        data.package,
        data.details,
        data.status,
      ].map(safeCell));
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ success: true, recorded: true });
  } catch (error) {
    console.error("Lead could not be recorded in Google Sheets.", error);
    return jsonResponse({ success: false, recorded: false });
  }
}
