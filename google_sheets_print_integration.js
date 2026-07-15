// ==========================================================================
// Google Apps Script - Extended with prepare_print and add_member handling
// Paste this code into your Google Apps Script editor (Extensions -> Apps Script)
// Overwrite or append it to your Code.gs file, then redeploy as a Web App.
// ==========================================================================

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = data[0];
    var rows = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      row['row_num'] = i + 1;
      rows.push(row);
    }
    
    return ContentService.createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper to find sheet dynamically based on name variations
function findSheetDynamically(ss, type) {
  var sheets = ss.getSheets();
  
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName().toLowerCase();
    
    if (type === "kcc") {
      if (sheetName.indexOf("kcc") !== -1 && (sheetName.indexOf("app") !== -1 || sheetName.indexOf("விண்ணப்ப") !== -1)) {
        return sheets[i];
      }
    } else if (type === "ah") {
      if (sheetName.indexOf("ah") !== -1 || sheetName.indexOf("animal") !== -1 || sheetName.indexOf("கால்நடை") !== -1) {
        return sheets[i];
      }
    } else if (type === "declaration") {
      if (sheetName.indexOf("dec") !== -1 || sheetName.indexOf("self") !== -1 || sheetName.indexOf("உறுதிமொழி") !== -1 || sheetName.indexOf("ஒப்புதல்") !== -1) {
        return sheets[i];
      }
    }
  }
  
  // Fallbacks by exact matching/index
  if (type === "kcc") {
    return ss.getSheetByName("KCC Application") || ss.getSheetByName("KCC") || sheets[0];
  }
  if (type === "ah") {
    return ss.getSheetByName("AH Application") || ss.getSheetByName("AH");
  }
  if (type === "declaration") {
    return ss.getSheetByName("KCC Self Declaration") || ss.getSheetByName("Self Declaration") || ss.getSheetByName("Declaration") || (sheets.length > 1 ? sheets[1] : sheets[0]);
  }
  
  return null;
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // ==========================================================================
    // Action 1: prepare_print (Writes Borrower and Guarantor IDs and returns PDF link)
    // ==========================================================================
    if (params.action === "prepare_print") {
      var memberId = params.member_id;
      var guarantorId = params.guarantor_id || "";
      var docType = params.doc_type; // "kcc" or "ah" or "declaration"
      
      var targetSheet = findSheetDynamically(ss, docType);
      
      // Auto-create AH Application by copying KCC Application if missing
      if (!targetSheet && docType === "ah") {
        var kccSheet = findSheetDynamically(ss, "kcc");
        if (kccSheet) {
          targetSheet = kccSheet.copyTo(ss);
          targetSheet.setName("AH Application");
        }
      }
      
      var targetCell = "";
      var guarantorCell = "";
      
      if (docType === "kcc") {
        targetCell = "F8"; // F8 is for KCC Application lookup
        guarantorCell = "E29"; // E29 is for Guarantor lookup
      } else if (docType === "ah") {
        targetCell = "I10"; // I10 is for AH Application lookup
        guarantorCell = "K29"; // K29 is for Guarantor lookup (updated from I29)
      } else {
        targetCell = "T4"; // T4 is for Self Declaration lookup
        guarantorCell = ""; // NO Guarantor ID cell for Declaration
      }
      
      if (!targetSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error", 
          message: "Sheet template for '" + docType + "' not found! Please check sheet tab names in your Google Sheet."
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Write Borrower A Class ID
      targetSheet.getRange(targetCell).setValue(memberId);
      
      // Write Guarantor A Class ID ONLY for Application forms (KCC/AH)
      if (guarantorCell !== "") {
        targetSheet.getRange(guarantorCell).setValue(guarantorId);
      }
      
      // Force sheet calculation updates
      SpreadsheetApp.flush();
      
      var spreadsheetId = ss.getId();
      var sheetId = targetSheet.getSheetId();
      
      // Generate clean Legal sized print PDF export link (Portrait, fit-to-width, no gridlines)
      var pdfUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + 
                   "/export?format=pdf&gid=" + sheetId + 
                   "&size=legal&portrait=true&fitw=true&gridlines=false";
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", 
        pdf_url: pdfUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================================================
    // Action 2: Add new member row
    // ==========================================================================
    if (params.action === "add_member") {
      var sheet = ss.getActiveSheet();
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      
      var newRow = [];
      for (var j = 0; j < headers.length; j++) {
        var header = headers[j];
        if (params[header] !== undefined) {
          newRow.push(params[header]);
        } else {
          newRow.push("");
        }
      }
      
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", 
        message: "Member added successfully"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================================================
    // Action 3: Update member database row
    // ==========================================================================
    var sheet = ss.getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var memberId = params.member_id;
    var erpNo = params.erp_no;
    var rowToUpdate = -1;
    
    var colMemberIdIdx = headers.indexOf("Member ID");
    var colErpNoIdx = headers.indexOf("SB ERP No");
    
    for (var i = 1; i < data.length; i++) {
      var rowMemberId = data[i][colMemberIdIdx];
      var rowErpNo = data[i][colErpNoIdx];
      if ((memberId && rowMemberId == memberId) || (erpNo && rowErpNo == erpNo)) {
        rowToUpdate = i + 1;
        break;
      }
    }
    
    if (rowToUpdate == -1) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Member not found"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    for (var key in params) {
      var colIndex = headers.indexOf(key);
      if (colIndex != -1) {
        sheet.getRange(rowToUpdate, colIndex + 1).setValue(params[key]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Updated successfully"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
