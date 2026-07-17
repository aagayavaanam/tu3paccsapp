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
  var typeLower = type.toLowerCase();
  
  // 1. Check exact matches first
  for (var i = 0; i < sheets.length; i++) {
    var nameLower = sheets[i].getName().toLowerCase();
    if (nameLower === typeLower) {
      return sheets[i];
    }
  }
  
  // 2. Check application and declaration custom fuzzy matches
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName().toLowerCase();
    
    if (type === "kcc") {
      if (sheetName.indexOf("kcc") !== -1 && (sheetName.indexOf("app") !== -1 || sheetName.indexOf("விண்ணப்ப") !== -1)) {
        return sheets[i];
      }
    } else if (type === "ah") {
      // Must contain 'ah' but NOT contain declaration terms
      if (sheetName.indexOf("ah") !== -1 && 
          sheetName.indexOf("self") === -1 && 
          sheetName.indexOf("photo") === -1 && 
          sheetName.indexOf("7") === -1 && 
          sheetName.indexOf("உறுதிமொழி") === -1 && 
          sheetName.indexOf("புகைப்பட") === -1 && 
          sheetName.indexOf("ஒப்புதல்") === -1) {
        return sheets[i];
      }
    } else if (type === "ah_self_dec") {
      if (sheetName.indexOf("ah") !== -1 && (sheetName.indexOf("self") !== -1 || sheetName.indexOf("சுய") !== -1 || sheetName.indexOf("உறுதிமொழி") !== -1)) {
        return sheets[i];
      }
    } else if (type === "ah_photo") {
      if (sheetName.indexOf("ah") !== -1 && (sheetName.indexOf("photo") !== -1 || sheetName.indexOf("படம்") !== -1 || sheetName.indexOf("புகைப்பட") !== -1)) {
        return sheets[i];
      }
    } else if (type === "ah_7_dec") {
      if (sheetName.indexOf("ah") !== -1 && (sheetName.indexOf("7") !== -1 || sheetName.indexOf("oputal") !== -1 || sheetName.indexOf("ஒப்புதல்") !== -1)) {
        return sheets[i];
      }
    } else if (type === "declaration") {
      if (sheetName.indexOf("dec") !== -1 || sheetName.indexOf("self") !== -1 || sheetName.indexOf("உறுதிமொழி") !== -1 || sheetName.indexOf("ஒப்புதல்") !== -1) {
        // Exclude AH declarations if KCC declaration is requested
        if (sheetName.indexOf("ah") === -1) {
          return sheets[i];
        }
      }
    }
  }
  
  // 3. Loose spacing matches (e.g., "KCC 1" matches "KCC1")
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName().toLowerCase();
    var cleanedType = typeLower.replace(/\s+/g, "");
    var cleanedSheet = sheetName.replace(/\s+/g, "");
    if (cleanedSheet === cleanedType || cleanedSheet.indexOf(cleanedType) !== -1 || cleanedType.indexOf(cleanedSheet) !== -1) {
      return sheets[i];
    }
  }
  
  // Fallbacks
  return ss.getSheetByName(type) || null;
}

// Helper to write disbursement batch members dynamically to templates
function writeBatchToSheet(sheet, headers, members, docType) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  
  // 1. Dynamic placeholder replacements for RCL & Resolution headers
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var valStr = String(values[r][c]);
      if (valStr.indexOf("RCL") !== -1 || valStr.indexOf("rcl") !== -1) {
        // Update RCL No & Date in cells
        sheet.getRange(r + 1, c + 1).setValue("RCL No: " + headers.rcl_no + "  Dt: " + headers.rcl_date);
      }
      if (valStr.indexOf("jPh;khd") !== -1 || valStr.indexOf("தீர்மானம்") !== -1) {
        // Update Resolution No & Date in cells
        sheet.getRange(r + 1, c + 1).setValue("jPh;khd vz; " + headers.res_no + "  Dt: " + headers.res_date);
      }
      if (valStr.indexOf("RCL-") !== -1) {
        sheet.getRange(r + 1, c + 1).setValue("RCL No: " + headers.rcl_no + "  Dt: " + headers.rcl_date);
      }
    }
  }
  
  // 2. Find table header row by searching column keys (t.vz; or S.No or வ.எண்)
  var headerRowIdx = -1;
  var colMappings = {};
  
  for (var r = 0; r < Math.min(values.length, 12); r++) {
    var hasSNo = false;
    var hasAdmission = false;
    for (var c = 0; c < values[r].length; c++) {
      var val = String(values[r][c]).toLowerCase();
      if (val.indexOf("t.vz;") !== -1 || val.indexOf("s.no") !== -1 || val.indexOf("வ.எண்") !== -1 || val.indexOf("வ. எண்") !== -1) {
        hasSNo = true;
        colMappings["sno"] = c + 1;
      }
      if (val.indexOf("m.vz;") !== -1 || val.indexOf("admission") !== -1 || val.indexOf("அ.எண்") !== -1 || val.indexOf("உறுப்பினர் எண்") !== -1) {
        hasAdmission = true;
        colMappings["aclass"] = c + 1;
      }
      if (val.indexOf("sb") !== -1 || val.indexOf("s.b") !== -1) {
        colMappings["sb"] = c + 1;
      }
      if (val.indexOf("erp") !== -1) {
        colMappings["erp"] = c + 1;
      }
      if (val.indexOf("ngah;") !== -1 || val.indexOf("name") !== -1 || val.indexOf("பெயர்") !== -1) {
        colMappings["name"] = c + 1;
      }
      if (val.indexOf("rh;v") !== -1 || val.indexOf("survey") !== -1 || val.indexOf("புல எண்") !== -1 || val.indexOf("சப்வே") !== -1) {
        colMappings["survey"] = c + 1;
      }
      if (val.indexOf("gug;g") !== -1 || val.indexOf("area") !== -1 || val.indexOf("ஏக்கர்") !== -1 || val.indexOf("விஸ்தீரணம்") !== -1) {
        colMappings["area"] = c + 1;
      }
      if (val.indexOf("gaph;") !== -1 || val.indexOf("crop") !== -1 || val.indexOf("பயிர்") !== -1) {
        colMappings["crop"] = c + 1;
      }
      if (val.indexOf("fld;") !== -1 || val.indexOf("loan") !== -1 || val.indexOf("amount") !== -1 || val.indexOf("தொகை") !== -1) {
        colMappings["amount"] = c + 1;
      }
      if (val.indexOf("தேதி") !== -1 || val.indexOf("date") !== -1) {
        colMappings["date"] = c + 1;
      }
      if (val.indexOf("tpij") !== -1 || val.indexOf("seed") !== -1 || val.indexOf("விதை") !== -1) {
        colMappings["seed"] = c + 1;
      }
      if (val.indexOf("urhad") !== -1 || val.indexOf("fert") !== -1 || val.indexOf("உரம்") !== -1) {
        colMappings["fertilizer"] = c + 1;
      }
      if (val.indexOf("compost") !== -1 || val.indexOf("தொழு") !== -1) {
        colMappings["compost"] = c + 1;
      }
      if (val.indexOf("pest") !== -1 || val.indexOf("பூச்சி") !== -1) {
        colMappings["pesticide"] = c + 1;
      }
      if (val.indexOf("cash") !== -1 || val.indexOf("ரொக்கம்") !== -1) {
        colMappings["cash"] = c + 1;
      }
      if (val.indexOf("member status") !== -1 || val.indexOf("உறுப்பினர் நிலை") !== -1) {
        colMappings["member_status"] = c + 1;
      }
      if (val.indexOf("category") !== -1 || val.indexOf("caste") !== -1 || val.indexOf("இனம்") !== -1) {
        colMappings["caste_category"] = c + 1;
      }
      if (val.indexOf("farmer") !== -1 || val.indexOf("விவசாயி") !== -1) {
        colMappings["farmer_category"] = c + 1;
      }
      if (val.indexOf("gender") !== -1 || val.indexOf("பாலினம்") !== -1 || val.indexOf("ஆண்") !== -1) {
        colMappings["gender"] = c + 1;
      }
      if (val.indexOf("disability") !== -1 || val.indexOf("குறைபாடு") !== -1) {
        colMappings["disability"] = c + 1;
      }
      if (val.indexOf("loan status") !== -1 || val.indexOf("வெண்நிலை") !== -1) {
        colMappings["loan_status"] = c + 1;
      }
      if (val.indexOf("mortgage") !== -1 || val.indexOf("அடமானம்") !== -1) {
        colMappings["mortgage_continuity"] = c + 1;
      }
      if (val.indexOf("collateral") !== -1 || val.indexOf("ஆதார") !== -1) {
        colMappings["collateral_type"] = c + 1;
      }
      if (val.indexOf("book fee") !== -1 || val.indexOf("புத்தக பாரம்") !== -1 || val.indexOf("passbook") !== -1) {
        colMappings["book_fee"] = c + 1;
      }
      if (val.indexOf("insurance") !== -1 || val.indexOf("காப்பீடு") !== -1 || val.indexOf("ins") !== -1) {
        colMappings["insurance"] = c + 1;
      }
      if (val.indexOf("share") !== -1 || val.indexOf("பங்கு") !== -1) {
        colMappings["share_amount"] = c + 1;
      }
      if (val.indexOf("prev loan no") !== -1 || val.indexOf("previous loan no") !== -1 || val.indexOf("முன்கடன் எண்") !== -1) {
        colMappings["prev_loan_no"] = c + 1;
      }
      if (val.indexOf("prev loan date") !== -1 || val.indexOf("previous loan date") !== -1 || val.indexOf("முன்கடன் தேதி") !== -1) {
        colMappings["prev_loan_date"] = c + 1;
      }
      if (val.indexOf("prev loan amount") !== -1 || val.indexOf("previous loan amount") !== -1 || val.indexOf("முன்கடன் தொகை") !== -1) {
        colMappings["prev_loan_amount"] = c + 1;
      }
    }
    if (hasSNo || hasAdmission) {
      headerRowIdx = r + 1;
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    headerRowIdx = 4; // Fallback
    colMappings = {
      "sno": 1, "aclass": 2, "sb": 3, "erp": 4, "name": 6, "survey": 7, "area": 8, "crop": 9, "amount": 10, "date": 11
    };
  }
  
  // Clear old data rows (up to 50 rows)
  var lastRow = sheet.getLastRow();
  if (lastRow > headerRowIdx) {
    sheet.getRange(headerRowIdx + 1, 1, Math.min(50, lastRow - headerRowIdx), sheet.getLastColumn()).clearContent();
  }
  
  // Write members list
  for (var i = 0; i < members.length; i++) {
    var member = members[i];
    var writeRow = headerRowIdx + 1 + i;
    
    if (colMappings["sno"]) sheet.getRange(writeRow, colMappings["sno"]).setValue(i + 1);
    if (colMappings["aclass"]) sheet.getRange(writeRow, colMappings["aclass"]).setValue(member.aclass);
    if (colMappings["sb"]) sheet.getRange(writeRow, colMappings["sb"]).setValue(member.sb);
    if (colMappings["erp"]) sheet.getRange(writeRow, colMappings["erp"]).setValue(member.erp);
    
    // Write initials and name split if column exists
    var nameParts = member.name.split(" ");
    var initials = "";
    var nameOnly = member.name;
    if (nameParts.length > 1) {
      initials = nameParts[0];
      nameOnly = nameParts.slice(1).join(" ");
    }
    if (colMappings["name"]) {
      var nameCol = colMappings["name"];
      if (nameCol > 2 && sheet.getRange(headerRowIdx, nameCol - 1).getValue() === "") {
        sheet.getRange(writeRow, nameCol - 1).setValue(initials);
        sheet.getRange(writeRow, nameCol).setValue(nameOnly);
      } else {
        sheet.getRange(writeRow, nameCol).setValue(member.name);
      }
    }
    
    if (colMappings["survey"]) sheet.getRange(writeRow, colMappings["survey"]).setValue(member.survey_no);
    if (colMappings["area"]) sheet.getRange(writeRow, colMappings["area"]).setValue(member.area);
    if (colMappings["crop"]) sheet.getRange(writeRow, colMappings["crop"]).setValue(member.crop);
    if (colMappings["amount"]) sheet.getRange(writeRow, colMappings["amount"]).setValue(member.amount);
    if (colMappings["date"]) sheet.getRange(writeRow, colMappings["date"]).setValue(member.date);
    
    // Write components if columns exist and are mapped, otherwise fallback to 30%/70% auto-calculator
    if (colMappings["seed"]) {
      sheet.getRange(writeRow, colMappings["seed"]).setValue(member.seed !== undefined ? member.seed : 0);
    }
    if (colMappings["fertilizer"]) {
      sheet.getRange(writeRow, colMappings["fertilizer"]).setValue(member.fertilizer !== undefined ? member.fertilizer : Math.round(member.amount * 0.3));
    }
    if (colMappings["compost"]) {
      sheet.getRange(writeRow, colMappings["compost"]).setValue(member.compost !== undefined ? member.compost : 0);
    }
    if (colMappings["pesticide"]) {
      sheet.getRange(writeRow, colMappings["pesticide"]).setValue(member.pesticide !== undefined ? member.pesticide : 0);
    }
    if (colMappings["cash"]) {
      sheet.getRange(writeRow, colMappings["cash"]).setValue(member.cash !== undefined ? member.cash : Math.round(member.amount * 0.7));
    }
    
    // Write members' other details if columns exist
    if (colMappings["member_status"]) {
      sheet.getRange(writeRow, colMappings["member_status"]).setValue(member.member_status || "");
    }
    if (colMappings["caste_category"]) {
      sheet.getRange(writeRow, colMappings["caste_category"]).setValue(member.caste_category || "");
    }
    if (colMappings["farmer_category"]) {
      sheet.getRange(writeRow, colMappings["farmer_category"]).setValue(member.farmer_category || "");
    }
    if (colMappings["gender"]) {
      sheet.getRange(writeRow, colMappings["gender"]).setValue(member.gender || "");
    }
    if (colMappings["disability"]) {
      sheet.getRange(writeRow, colMappings["disability"]).setValue(member.disability !== undefined ? member.disability : "0");
    }
    if (colMappings["loan_status"]) {
      sheet.getRange(writeRow, colMappings["loan_status"]).setValue(member.loan_status || "");
    }
    if (colMappings["mortgage_continuity"]) {
      sheet.getRange(writeRow, colMappings["mortgage_continuity"]).setValue(member.mortgage_continuity || "");
    }
    if (colMappings["collateral_type"]) {
      sheet.getRange(writeRow, colMappings["collateral_type"]).setValue(member.collateral_type || "");
    }
    
    // Write Part 7 Deductions details if columns exist
    if (colMappings["book_fee"]) {
      sheet.getRange(writeRow, colMappings["book_fee"]).setValue(member.book_fee !== undefined ? member.book_fee : 0);
    }
    if (colMappings["insurance"]) {
      sheet.getRange(writeRow, colMappings["insurance"]).setValue(member.insurance !== undefined ? member.insurance : 0);
    }
    if (colMappings["share_amount"]) {
      sheet.getRange(writeRow, colMappings["share_amount"]).setValue(member.share_amount !== undefined ? member.share_amount : 0);
    }
    
    // Write Part 8 Repayment details if columns exist
    if (colMappings["prev_loan_no"]) {
      sheet.getRange(writeRow, colMappings["prev_loan_no"]).setValue(member.prev_loan_no || "");
    }
    if (colMappings["prev_loan_date"]) {
      sheet.getRange(writeRow, colMappings["prev_loan_date"]).setValue(member.prev_loan_date || "");
    }
    if (colMappings["prev_loan_amount"]) {
      sheet.getRange(writeRow, colMappings["prev_loan_amount"]).setValue(member.prev_loan_amount !== undefined ? member.prev_loan_amount : 0);
    }
    
    // Legacy support if specific columns were not found but a cropCol + 1 column is the seed/fertilizer region
    if (!colMappings["seed"] && !colMappings["fertilizer"] && !colMappings["cash"]) {
      var cropCol = colMappings["crop"] || colMappings["survey"] + 2;
      if (cropCol) {
        var seedCell = sheet.getRange(writeRow, cropCol + 1);
        var fertCell = sheet.getRange(writeRow, cropCol + 2);
        var cashCell = sheet.getRange(writeRow, cropCol + 3);
        
        var seedHeader = String(sheet.getRange(headerRowIdx, cropCol + 1).getValue()).toLowerCase();
        if (seedHeader.indexOf("tpij") !== -1 || seedHeader.indexOf("seed") !== -1 || seedHeader.indexOf("விதை") !== -1) {
          var amt = parseFloat(member.amount) || 0;
          seedCell.setValue(member.seed !== undefined ? member.seed : 0);
          fertCell.setValue(member.fertilizer !== undefined ? member.fertilizer : Math.round(amt * 0.3));
          cashCell.setValue(member.cash !== undefined ? member.cash : Math.round(amt * 0.7));
        }
      }
    }
  }
  
  // Write total row
  var totalRow = headerRowIdx + 1 + members.length;
  if (colMappings["name"]) {
    sheet.getRange(totalRow, colMappings["name"]).setValue("nkhj;jk;"); // total in legacy font
  }
  if (colMappings["area"]) {
    var areaRange = sheet.getRange(headerRowIdx + 1, colMappings["area"], members.length, 1);
    sheet.getRange(totalRow, colMappings["area"]).setFormula("=SUM(" + areaRange.getA1Notation() + ")");
  }
  if (colMappings["amount"]) {
    var amountRange = sheet.getRange(headerRowIdx + 1, colMappings["amount"], members.length, 1);
    sheet.getRange(totalRow, colMappings["amount"]).setFormula("=SUM(" + amountRange.getA1Notation() + ")");
  }
  
  // Components totals
  var cropCol = colMappings["crop"] || colMappings["survey"] + 2;
  if (cropCol) {
    var fertHeader = String(sheet.getRange(headerRowIdx, cropCol + 2).getValue()).toLowerCase();
    if (fertHeader.indexOf("urhad") !== -1 || fertHeader.indexOf("fert") !== -1) {
      sheet.getRange(totalRow, cropCol + 1).setFormula("=SUM(" + sheet.getRange(headerRowIdx + 1, cropCol + 1, members.length, 1).getA1Notation() + ")");
      sheet.getRange(totalRow, cropCol + 2).setFormula("=SUM(" + sheet.getRange(headerRowIdx + 1, cropCol + 2, members.length, 1).getA1Notation() + ")");
      sheet.getRange(totalRow, cropCol + 3).setFormula("=SUM(" + sheet.getRange(headerRowIdx + 1, cropCol + 3, members.length, 1).getA1Notation() + ")");
    }
  }
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // ==========================================================================
    // Action 0: prepare_disbursement_print
    // ==========================================================================
    if (params.action === "prepare_disbursement_print") {
      var docType = params.doc_type; // "KCC1", "KCC2", "Insurance", etc.
      var headers = params.headers;
      var members = params.members;
      
      var targetSheet = findSheetDynamically(ss, docType);
      if (!targetSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error", 
          message: "Sheet template for '" + docType + "' not found!"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Write batch members dynamically
      writeBatchToSheet(targetSheet, headers, members, docType);
      
      SpreadsheetApp.flush();
      
      var spreadsheetId = ss.getId();
      var sheetId = targetSheet.getSheetId();
      
      var pdfUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + 
                   "/export?format=pdf&gid=" + sheetId + 
                   "&size=legal&portrait=true&fitw=true&gridlines=false&attachment=false";
      
      var excelUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + 
                     "/export?format=xlsx&gid=" + sheetId;
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", 
        pdf_url: pdfUrl,
        excel_url: excelUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================================================
    // Action 1: prepare_print (Writes Borrower and Guarantor IDs and returns PDF link)
    // ==========================================================================
    if (params.action === "prepare_print") {
      var memberId = params.member_id;
      var guarantorId = params.guarantor_id || "";
      var docType = params.doc_type; // "kcc", "ah", "ah_self_dec", "ah_photo", "ah_7_dec", "declaration"
      
      var targetSheet = findSheetDynamically(ss, docType);
      
      // Auto-create AH Application by copying KCC Application if missing
      if (!targetSheet && docType === "ah") {
        var kccSheet = findSheetDynamically(ss, "kcc");
        if (kccSheet) {
          targetSheet = kccSheet.copyTo(ss);
          targetSheet.setName("AH Application");
        }
      }
      
      if (!targetSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error", 
          message: "Sheet template for '" + docType + "' not found! Please check sheet tab names in your Google Sheet."
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Write Borrower and Guarantor IDs to appropriate sheets & coordinates
      if (docType === "kcc") {
        targetSheet.getRange("F8").setValue(memberId);
        targetSheet.getRange("E29").setValue(guarantorId);
      } else if (docType === "ah" || docType === "ah_self_dec" || docType === "ah_photo" || docType === "ah_7_dec") {
        // ALWAYS write Borrower ID to I10 and Guarantor ID to K31 on the main "AH Application" sheet.
        // Other AH sheets will automatically read from it via Google Sheet formulas.
        var ahAppSheet = findSheetDynamically(ss, "ah");
        if (ahAppSheet) {
          ahAppSheet.getRange("I10").setValue(memberId);
          ahAppSheet.getRange("K31").setValue(guarantorId);
        } else {
          // Fallback if main AH Application sheet is missing
          targetSheet.getRange("I10").setValue(memberId);
          targetSheet.getRange("K31").setValue(guarantorId);
        }
      } else {
        // KCC Self Declaration (writes to T4 on the declaration sheet)
        targetSheet.getRange("T4").setValue(memberId);
      }
      
      // Force sheet calculation updates
      SpreadsheetApp.flush();
      
      var spreadsheetId = ss.getId();
      var sheetId = targetSheet.getSheetId();
      
      // Generate clean Legal sized print PDF export link (Portrait, fit-to-width, no gridlines)
      var pdfUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + 
                   "/export?format=pdf&gid=" + sheetId + 
                   "&size=legal&portrait=true&fitw=true&gridlines=false&attachment=false";
      
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
