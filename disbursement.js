/* ==========================================================================
   PACS Disbursement Preparation Module - Logic Script
   ========================================================================== */

(function () {
    // State Management for active batches
    let kccBatchMembers = [];
    let ahBatchMembers = [];
    
    let kccSelectedMember = null;
    let ahSelectedMember = null;
    let editingKccMemberIndex = null;
    
    // Default dates setup
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Helper: Format amount to Indian Rupees
    function formatCurrency(amt) {
        return "₹" + parseInt(amt).toLocaleString('en-IN');
    }

    // Helper: Lookup member details from global localMembers array
    function findMember(query) {
        const members = (typeof localMembers !== 'undefined') ? localMembers : null;
        if (query === undefined || query === null || !members) return null;
        const queryStr = String(query).toLowerCase().trim();
        if (!queryStr) return null;
        return members.find(m => {
            const keys = Object.keys(m);
            const idVal = String(m[keys[0]] || '').toLowerCase();
            const erpVal = String(getFuzzyValue(m, ['sberp', 'erp', 'sb']) || '').toLowerCase();
            const nameVal = String(getFuzzyValue(m, ['name', 'பெயர்']) || '').toLowerCase();
            return idVal === queryStr || erpVal === queryStr || nameVal.includes(queryStr);
        });
    }

    // Helper: Find value from object key using fuzzy matching keywords list
    function getFuzzyValue(member, keywords) {
        if (!member) return '';
        const keys = Object.keys(member);
        const matchKey = keys.find(k => {
            const kl = k.toLowerCase().replace(/\s+/g, '');
            return keywords.some(kw => {
                const kwl = kw.toLowerCase().replace(/\s+/g, '');
                return kwl !== '' && kl.includes(kwl);
            });
        });
        return matchKey ? member[matchKey] : '';
    }

    // Helper: Safe DOM Selector
    function safeSelect(id) {
        return document.getElementById(id);
    }

    /* ==========================================================================
       KCC DISBURSEMENT LOGIC
       ========================================================================== */
    function initKccDisbursement() {
        const inputAClass = safeSelect('disb-kcc-aclass-input');
        const btnLookup = safeSelect('btn-disb-kcc-lookup');
        const btnAdd = safeSelect('btn-disb-kcc-add');
        const btnSubmit = safeSelect('btn-disb-kcc-submit');
        const btnPrint = safeSelect('btn-disb-kcc-print');
        const btnExcel = safeSelect('btn-disb-kcc-excel');
        
        const inputDate = safeSelect('disb-kcc-date');
        const inputResNo = safeSelect('disb-kcc-res-no');
        const inputResDate = safeSelect('disb-kcc-res-date');
        const inputRclNo = safeSelect('disb-kcc-rcl-no');
        const inputRclDate = safeSelect('disb-kcc-rcl-date');
        
        // Set default date for fields
        if (inputDate) inputDate.value = todayStr;
        const inputPrevDate = safeSelect('disb-kcc-prev-loan-date');
        if (inputPrevDate) inputPrevDate.value = todayStr;

        // Set default RCL values and save on change
        if (inputRclNo) {
            const savedRclNo = localStorage.getItem('pacs_kcc_rcl_no');
            inputRclNo.value = savedRclNo || "107/25-26/P1";
            inputRclNo.addEventListener('input', () => {
                localStorage.setItem('pacs_kcc_rcl_no', inputRclNo.value.trim());
            });
        }
        if (inputRclDate) {
            const savedRclDate = localStorage.getItem('pacs_kcc_rcl_date');
            inputRclDate.value = savedRclDate || "2026-04-15";
            inputRclDate.addEventListener('input', () => {
                localStorage.setItem('pacs_kcc_rcl_date', inputRclDate.value);
            });
        }

        // Set default Resolution values and save on change
        if (inputResNo) {
            const savedResNo = localStorage.getItem('pacs_kcc_res_no');
            inputResNo.value = savedResNo || "1";
            inputResNo.addEventListener('input', () => {
                localStorage.setItem('pacs_kcc_res_no', inputResNo.value.trim());
            });
        }
        if (inputResDate) {
            const savedResDate = localStorage.getItem('pacs_kcc_res_date');
            inputResDate.value = savedResDate || todayStr;
            inputResDate.addEventListener('input', () => {
                localStorage.setItem('pacs_kcc_res_date', inputResDate.value);
            });
        }

        // Auto-format Area input to 2 decimal places on focus out (blur)
        const inputArea = safeSelect('disb-kcc-area');
        if (inputArea) {
            inputArea.addEventListener('blur', () => {
                const val = parseFloat(inputArea.value);
                if (!isNaN(val)) {
                    inputArea.value = val.toFixed(2);
                }
            });
        }

        // Auto-fill Part 8 values if member status is "புதிய உறுப்பினர்"
        const memberStatusSelect = safeSelect('disb-kcc-member-status');
        const prevLoanNoInput = safeSelect('disb-kcc-prev-loan-no');
        const prevLoanAmountInput = safeSelect('disb-kcc-prev-loan-amount');
        const prevLoanDateInput = safeSelect('disb-kcc-prev-loan-date');

        if (memberStatusSelect) {
            memberStatusSelect.addEventListener('change', () => {
                if (memberStatusSelect.value === 'புதிய உறுப்பினர்') {
                    if (prevLoanNoInput) prevLoanNoInput.value = 'புதியநபர்';
                    if (prevLoanAmountInput) {
                        prevLoanAmountInput.value = '0';
                        prevLoanAmountInput.readOnly = true;
                        prevLoanAmountInput.style.backgroundColor = 'var(--bg-hover)';
                    }
                    if (prevLoanDateInput) prevLoanDateInput.value = '';
                } else {
                    if (prevLoanNoInput) prevLoanNoInput.value = 'KCC - ';
                    if (prevLoanAmountInput) {
                        prevLoanAmountInput.value = '';
                        prevLoanAmountInput.readOnly = false;
                        prevLoanAmountInput.style.backgroundColor = '';
                    }
                    if (prevLoanDateInput) prevLoanDateInput.value = todayStr;
                }
            });
        }

        // Part 5: Dynamic sum calculation for Seed, Fertilizer, Compost, Pesticide, and Cash
        const inputSeed = safeSelect('disb-kcc-seed');
        const inputFert = safeSelect('disb-kcc-fertilizer');
        const inputCompost = safeSelect('disb-kcc-compost');
        const inputPest = safeSelect('disb-kcc-pesticide');
        const inputCash = safeSelect('disb-kcc-cash');
        const inputTotal = safeSelect('disb-kcc-amount');

        const inputBookFee = safeSelect('disb-kcc-book-fee');
        const inputInsurance = safeSelect('disb-kcc-insurance');
        const inputShareAmount = safeSelect('disb-kcc-share-amount');
        const inputPrevLoanAmount = safeSelect('disb-kcc-prev-loan-amount');
        
        const part5Inputs = [inputSeed, inputFert, inputCompost, inputPest, inputCash];
        const part7Inputs = [inputBookFee, inputInsurance, inputShareAmount];
        const allCurrencyInputs = [...part5Inputs, ...part7Inputs, inputPrevLoanAmount];
        
        function calculatePart5Total() {
            let sum = 0;
            part5Inputs.forEach(input => {
                if (input) {
                    const cleanVal = input.value.replace(/,/g, '');
                    const val = parseFloat(cleanVal) || 0;
                    sum += val;
                }
            });
            if (inputTotal) {
                inputTotal.value = sum.toLocaleString('en-IN');
            }
        }
        
        allCurrencyInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', (e) => {
                    let cursorPosition = e.target.selectionStart;
                    let originalLength = e.target.value.length;
                    
                    let cleanVal = e.target.value.replace(/[^0-9]/g, '');
                    if (cleanVal !== '') {
                        const formatted = parseInt(cleanVal).toLocaleString('en-IN');
                        e.target.value = formatted;
                        
                        let newLength = e.target.value.length;
                        cursorPosition = cursorPosition + (newLength - originalLength);
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                    } else {
                        e.target.value = '';
                    }
                    
                    if (part5Inputs.includes(input)) {
                        calculatePart5Total();
                    }
                });
            }
        });

        // 1. Member Lookup
        if (btnLookup) {
            btnLookup.addEventListener('click', () => {
                const query = inputAClass.value.trim();
                if (!query) {
                    alert("A Class எண்ணை உள்ளிடவும்!");
                    return;
                }

                const member = findMember(query);
                if (!member) {
                    kccSelectedMember = null;
                    alert("உறுப்பினர் கண்டறியப்படவில்லை!");
                    resetKccMemberLabels();
                    return;
                }

                kccSelectedMember = member;
                populateKccMemberLabels(member);
            });
        }

        // 2. Add Member to Batch
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                if (!kccSelectedMember) {
                    alert("முதலில் உறுப்பினரைத் தேடி ஏற்செய்யவும்!");
                    return;
                }

                const loanNo = safeSelect('disb-kcc-loan-no').value.trim();
                const disbDate = safeSelect('disb-kcc-date').value;
                const surveyNo = safeSelect('disb-kcc-survey-no').value.trim();
                const area = parseFloat(safeSelect('disb-kcc-area').value);
                const crop = safeSelect('disb-kcc-crop').value;
                const amountText = safeSelect('disb-kcc-amount').value.trim().replace(/,/g, '');
                const amount = parseFloat(amountText);
                const insurance = parseFloat(safeSelect('disb-kcc-insurance').value.trim().replace(/,/g, '') || '0');

                const seedText = safeSelect('disb-kcc-seed').value.trim().replace(/,/g, '') || '0';
                const fertText = safeSelect('disb-kcc-fertilizer').value.trim().replace(/,/g, '') || '0';
                const compostText = safeSelect('disb-kcc-compost').value.trim().replace(/,/g, '') || '0';
                const pestText = safeSelect('disb-kcc-pesticide').value.trim().replace(/,/g, '') || '0';
                const cashText = safeSelect('disb-kcc-cash').value.trim().replace(/,/g, '') || '0';
                const bookFeeText = safeSelect('disb-kcc-book-fee').value.trim().replace(/,/g, '') || '0';
                const shareAmountText = safeSelect('disb-kcc-share-amount').value.trim().replace(/,/g, '') || '0';

                const seed = parseFloat(seedText);
                const fert = parseFloat(fertText);
                const compost = parseFloat(compostText);
                const pest = parseFloat(pestText);
                const cash = parseFloat(cashText);
                const bookFee = parseFloat(bookFeeText);
                const shareAmount = parseFloat(shareAmountText);

                const prevLoanNo = safeSelect('disb-kcc-prev-loan-no').value.trim();
                const prevLoanDate = safeSelect('disb-kcc-prev-loan-date').value;
                const prevLoanAmountText = safeSelect('disb-kcc-prev-loan-amount').value.trim().replace(/,/g, '') || '0';
                const prevLoanAmount = parseFloat(prevLoanAmountText);

                const memberStatus = safeSelect('disb-kcc-member-status').value;
                const casteCategory = safeSelect('disb-kcc-caste-category').value;
                const farmerCategory = safeSelect('disb-kcc-farmer-category').value;
                const gender = safeSelect('disb-kcc-gender').value;
                const disability = safeSelect('disb-kcc-disability').value.trim() || '0';
                const loanStatus = safeSelect('disb-kcc-loan-status').value;
                const collateralType = safeSelect('disb-kcc-collateral-type').value;

                // Specific field-by-field validations
                if (!surveyNo) {
                    alert("நில விபரத்தில் புல எண்ணை (Survey No) உள்ளிடவும்!");
                    const inputSurvey = safeSelect('disb-kcc-survey-no');
                    if (inputSurvey) {
                        inputSurvey.focus();
                        inputSurvey.classList.add('input-error');
                        setTimeout(() => inputSurvey.classList.remove('input-error'), 3000);
                    }
                    return;
                }

                if (isNaN(area) || area <= 0) {
                    alert("நில விபரத்தில் பரப்பை (Area in Acres) உள்ளிடவும்!");
                    const inputArea = safeSelect('disb-kcc-area');
                    if (inputArea) {
                        inputArea.focus();
                        inputArea.classList.add('input-error');
                        setTimeout(() => inputArea.classList.remove('input-error'), 3000);
                    }
                    return;
                }

                if (isNaN(amount) || amount <= 0) {
                    alert("கடன் விபரத்தில் தொகைகளை உள்ளிடவும் (மொத்த தொகை 0-க்கு அதிகமாக இருக்க வேண்டும்)!");
                    const inputSeed = safeSelect('disb-kcc-seed');
                    if (inputSeed) {
                        inputSeed.focus();
                        inputSeed.classList.add('input-error');
                        setTimeout(() => inputSeed.classList.remove('input-error'), 3000);
                    }
                    return;
                }

                // Add to batch list
                const keys = Object.keys(kccSelectedMember);
                const memberId = kccSelectedMember[keys[0]] || '';
                const name = getFuzzyValue(kccSelectedMember, ['name', 'பெயர்']) || '';
                const sb = getFuzzyValue(kccSelectedMember, ['sb', 's.b', 'சேமிப்பு']) || '';
                const erp = getFuzzyValue(kccSelectedMember, ['erp', 'இஆர்பி']) || '';

                let initials = getFuzzyValue(kccSelectedMember, ['ins', 'initial', 'இனிசியல்']) || '';
                let nameOnly = name;
                if (!initials) {
                    const nameParts = name.trim().split(" ");
                    if (nameParts.length > 1) {
                        initials = nameParts[0];
                        nameOnly = nameParts.slice(1).join(" ");
                    }
                }

                const updatedMember = {
                    aclass: memberId,
                    name: nameOnly,
                    initials: initials,
                    sb: sb,
                    erp: erp,
                    loan_no: loanNo,
                    date: disbDate,
                    survey_no: surveyNo,
                    area: area.toFixed(2),
                    crop: crop,
                    amount: amount,
                    insurance: insurance,
                    seed: seed,
                    fertilizer: fert,
                    compost: compost,
                    pesticide: pest,
                    cash: cash,
                    member_status: memberStatus,
                    caste_category: casteCategory,
                    farmer_category: farmerCategory,
                    gender: gender,
                    disability: disability,
                    loan_status: loanStatus,
                    collateral_type: collateralType,
                    book_fee: bookFee,
                    share_amount: shareAmount,
                    prev_loan_no: prevLoanNo,
                    prev_loan_date: prevLoanDate,
                    prev_loan_amount: prevLoanAmount
                };

                if (editingKccMemberIndex !== null) {
                    // Update in-place to preserve row position
                    kccBatchMembers[editingKccMemberIndex] = updatedMember;
                    editingKccMemberIndex = null;
                    if (btnAdd) btnAdd.textContent = "பட்டியலில் சேர்";
                } else {
                    // Add new member
                    kccBatchMembers.push(updatedMember);
                }

                // Update UI
                renderKccBatchTable();
                
                // Automatically switch to KCC List tab
                const listLink = safeSelect('link-disbursement-kcc-list');
                if (listLink) listLink.click();
                
                // Clear fields
                kccSelectedMember = null;
                inputAClass.value = "";
                resetKccMemberLabels();
                
                safeSelect('disb-kcc-loan-no').value = "";
                safeSelect('disb-kcc-survey-no').value = "";
                safeSelect('disb-kcc-area').value = "";
                safeSelect('disb-kcc-seed').value = "";
                safeSelect('disb-kcc-fertilizer').value = "";
                safeSelect('disb-kcc-compost').value = "";
                safeSelect('disb-kcc-pesticide').value = "";
                safeSelect('disb-kcc-cash').value = "";
                safeSelect('disb-kcc-amount').value = "0";
                safeSelect('disb-kcc-insurance').value = "0";
                safeSelect('disb-kcc-book-fee').value = "0";
                safeSelect('disb-kcc-share-amount').value = "0";
                safeSelect('disb-kcc-prev-loan-no').value = "KCC - ";
                safeSelect('disb-kcc-prev-loan-date').value = todayStr;
                safeSelect('disb-kcc-prev-loan-amount').value = "";

                safeSelect('disb-kcc-member-status').selectedIndex = 0;
                safeSelect('disb-kcc-caste-category').selectedIndex = 0;
                safeSelect('disb-kcc-farmer-category').selectedIndex = 0;
                safeSelect('disb-kcc-gender').selectedIndex = 0;
                safeSelect('disb-kcc-disability').value = "0";
                safeSelect('disb-kcc-loan-status').selectedIndex = 0;
                safeSelect('disb-kcc-collateral-type').selectedIndex = 0;
            });
        }

        // 3. Submit Batch to Google Sheets
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                if (kccBatchMembers.length === 0) {
                    alert("பட்டியலில் எந்த உறுப்பினரும் இல்லை!");
                    return;
                }

                const sheetUrl = localStorage.getItem('pacs_google_sheet_url');
                if (!sheetUrl) {
                    alert("கூகுள் சீட் இணைப்பு பக்கத்தில் வெப் ஆப் URL-ஐ இணைக்கவும்!");
                    return;
                }

                const statusDiv = safeSelect('disb-kcc-status');
                statusDiv.style.color = "var(--primary)";
                statusDiv.textContent = "⏳ தகவல்கள் அனுப்பப்படுகின்றன...";

                const payload = {
                    action: "prepare_disbursement_print",
                    doc_type: safeSelect('sel-disb-kcc-form').value,
                    headers: {
                        rcl_no: safeSelect('disb-kcc-rcl-no').value.trim(),
                        rcl_date: safeSelect('disb-kcc-rcl-date').value,
                        res_no: safeSelect('disb-kcc-res-no').value.trim(),
                        res_date: safeSelect('disb-kcc-res-date').value
                    },
                    members: kccBatchMembers
                };

                fetch(sheetUrl, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                })
                .then(() => {
                    statusDiv.style.color = "var(--success)";
                    statusDiv.textContent = "✅ பட்டுவாடா வெற்றிகரமாக இறுதி செய்யப்பட்டது!";
                    safeSelect('box-disb-kcc-print-actions').classList.remove('hidden');
                })
                .catch(err => {
                    console.error("Disbursement write error:", err);
                    statusDiv.style.color = "var(--danger)";
                    statusDiv.textContent = "❌ இணைப்பு பிழை ஏற்பட்டது! மீண்டும் முயலவும்.";
                });
            });
        }

        // 4. Print & Export
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                const docType = safeSelect('sel-disb-kcc-form').value;
                const statusDiv = safeSelect('disb-kcc-status');

                if (docType === "KCC1") {
                    statusDiv.textContent = "⏳ KCC 1 அச்சுக்கோப்பு தயாராகிறது...";
                    try {
                        printKcc1Html(kccBatchMembers);
                        statusDiv.textContent = "✅ KCC 1 அச்சு தயாராக உள்ளது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ அச்சு பிழை: " + e.message;
                    }
                    return;
                }

                const sheetUrl = localStorage.getItem('pacs_google_sheet_url');
                statusDiv.textContent = "⏳ அச்சுக்கோப்பு தயாராகிறது...";
                
                // Repost to write the specific sheet layout and generate download link
                const payload = {
                    action: "prepare_disbursement_print",
                    doc_type: docType,
                    headers: {
                        rcl_no: safeSelect('disb-kcc-rcl-no').value.trim(),
                        rcl_date: safeSelect('disb-kcc-rcl-date').value,
                        res_no: safeSelect('disb-kcc-res-no').value.trim(),
                        res_date: safeSelect('disb-kcc-res-date').value
                    },
                    members: kccBatchMembers
                };

                fetch(sheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === "success" && data.pdf_url) {
                        statusDiv.textContent = "✅ அச்சு தயாராக உள்ளது!";
                        window.open(data.pdf_url, '_blank');
                    } else {
                        statusDiv.textContent = "❌ பிழை: " + (data.message || "கோப்பு கிடைக்கவில்லை");
                    }
                })
                .catch(err => {
                    statusDiv.textContent = "❌ அச்சு பிழை ஏற்பட்டது!";
                    console.error(err);
                });
            });
        }

        if (btnExcel) {
            btnExcel.addEventListener('click', () => {
                const docType = safeSelect('sel-disb-kcc-form').value;
                const statusDiv = safeSelect('disb-kcc-status');

                statusDiv.textContent = "⏳ எக்செல் கோப்பு தயாராகிறது...";

                if (docType === "KCC1") {
                    try {
                        exportKcc1Excel(kccBatchMembers);
                        statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ எக்செல் பிழை: " + e.message;
                    }
                    return;
                }
                
                const sheetUrl = localStorage.getItem('pacs_google_sheet_url');
                const payload = {
                    action: "prepare_disbursement_print",
                    doc_type: docType,
                    headers: {
                        rcl_no: safeSelect('disb-kcc-rcl-no').value.trim(),
                        rcl_date: safeSelect('disb-kcc-rcl-date').value,
                        res_no: safeSelect('disb-kcc-res-no').value.trim(),
                        res_date: safeSelect('disb-kcc-res-date').value
                    },
                    members: kccBatchMembers
                };

                fetch(sheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === "success" && data.excel_url) {
                        statusDiv.textContent = "✅ பதிவிறக்கம் தொடங்கப்பட்டது!";
                        window.open(data.excel_url, '_blank');
                    } else {
                        statusDiv.textContent = "❌ பிழை: " + (data.message || "கோப்பு கிடைக்கவில்லை");
                    }
                })
                .catch(err => {
                    statusDiv.textContent = "❌ பதிவிறக்க பிழை!";
                    console.error(err);
                });
            });
        }
    }

    function populateKccMemberLabels(member) {
        const keys = Object.keys(member);
        const memberId = member[keys[0]] || '';
        
        const name = getFuzzyValue(member, ['name', 'பெயர்']) || '-';
        const father = getFuzzyValue(member, ['father', 'husband', 'parent', 'c/o', 'co', 'தந்தை', 'கணவர்']) || '-';
        const sb = getFuzzyValue(member, ['sb', 's.b', 'சேமிப்பு']) || '-';
        const erp = getFuzzyValue(member, ['erp', 'இஆர்பி']) || '-';
        const address = getFuzzyValue(member, ['address', 'village', 'street', 'முகவரி', 'கிராமம்']) || '-';
        const nominee = getFuzzyValue(member, ['nominee', 'namini', 'வாரிசு', 'நாமினி']) || '-';
        const relationship = getFuzzyValue(member, ['relationship', 'relation', 'உறவு']) || '-';
        const ration = getFuzzyValue(member, ['ration', 'family', 'குடும்ப அட்டை', 'ரேசன்', 'ரேஷன்']) || '-';
        const mdcc = getFuzzyValue(member, ['mdcc', 'எம்டிசிசி']) || '-';

        // Check if Initials column exists
        let initials = getFuzzyValue(member, ['ins', 'initial', 'இனிசியல்']) || '';
        let nameOnly = name;
        if (!initials) {
            // Split if not found in separate column
            var nameParts = name.trim().split(" ");
            if (nameParts.length > 1) {
                initials = nameParts[0];
                nameOnly = nameParts.slice(1).join(" ");
            }
        }

        safeSelect('lbl-disb-kcc-aclass').textContent = memberId;
        safeSelect('lbl-disb-kcc-sb').textContent = sb;
        safeSelect('lbl-disb-kcc-erp').textContent = erp;
        safeSelect('lbl-disb-kcc-initials').textContent = initials || "-";
        safeSelect('lbl-disb-kcc-name').textContent = nameOnly;
        safeSelect('lbl-disb-kcc-father').textContent = father;
        safeSelect('lbl-disb-kcc-address').textContent = address;
        safeSelect('lbl-disb-kcc-ration').textContent = ration;
        safeSelect('lbl-disb-kcc-mdcc').textContent = mdcc;
        safeSelect('lbl-disb-kcc-nominee').textContent = nominee;
        safeSelect('lbl-disb-kcc-relationship').textContent = relationship;
        
        // Auto-suggest loan amount based on approved amount
        const approvedAmt = getFuzzyValue(member, ['approved', 'sanction', 'ஒப்புதல்']) || '';
        if (approvedAmt) {
            safeSelect('disb-kcc-amount').value = parseInt(approvedAmt).toLocaleString('en-IN');
        }
    }

    function resetKccMemberLabels() {
        editingKccMemberIndex = null;
        const btnAdd = safeSelect('btn-disb-kcc-add');
        if (btnAdd) btnAdd.textContent = "பட்டியலில் சேர்";

        safeSelect('lbl-disb-kcc-aclass').textContent = "-";
        safeSelect('lbl-disb-kcc-sb').textContent = "-";
        safeSelect('lbl-disb-kcc-erp').textContent = "-";
        safeSelect('lbl-disb-kcc-initials').textContent = "-";
        safeSelect('lbl-disb-kcc-name').textContent = "-";
        safeSelect('lbl-disb-kcc-father').textContent = "-";
        safeSelect('lbl-disb-kcc-address').textContent = "-";
        safeSelect('lbl-disb-kcc-ration').textContent = "-";
        safeSelect('lbl-disb-kcc-mdcc').textContent = "-";
        safeSelect('lbl-disb-kcc-nominee').textContent = "-";
        safeSelect('lbl-disb-kcc-relationship').textContent = "-";
    }

    function renderKccBatchTable() {
        const tbody = document.querySelector('#tbl-disb-kcc-batch tbody');
        if (!tbody) return;

        tbody.innerHTML = "";

        if (kccBatchMembers.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center text-muted">பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை</td></tr>';
            safeSelect('lbl-disb-kcc-total-area').textContent = "0.00";
            safeSelect('lbl-disb-kcc-total-amount').textContent = "₹0";
            return;
        }

        let totalArea = 0;
        let totalAmount = 0;

        kccBatchMembers.forEach((member, index) => {
            totalArea += parseFloat(member.area || 0);
            totalAmount += member.amount;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td class="font-bold">${member.aclass}</td>
                <td>${member.name}</td>
                <td>${parseFloat(member.area || 0).toFixed(2)}</td>
                <td class="font-bold">${formatCurrency(member.amount)}</td>
                <td>
                    <button class="btn btn-secondary btn-edit" style="padding: 4px 8px; font-size: 11px; background: var(--warning); color: #000; margin-right: 5px;" data-idx="${index}">திருத்து</button>
                    <button class="btn btn-secondary btn-delete" style="padding: 4px 8px; font-size: 11px; background: var(--danger); color: white;" data-idx="${index}">நீக்கு</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Set totals
        safeSelect('lbl-disb-kcc-total-area').textContent = totalArea.toFixed(2);
        safeSelect('lbl-disb-kcc-total-amount').textContent = formatCurrency(totalAmount);

        // Bind edits
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                try {
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    const member = kccBatchMembers[idx];
                    if (!member) {
                        alert("உறுப்பினர் பட்டியல் விவரம் கண்டறியப்படவில்லை!");
                        return;
                    }

                    // 1. Populate search query and selected member
                    const inputAClass = safeSelect('disb-kcc-aclass-input');
                    if (inputAClass) inputAClass.value = member.aclass;
                    
                    // Lookup in master data to ensure lookup object matches
                    const masterMember = findMember(member.aclass);
                    if (masterMember) {
                        kccSelectedMember = masterMember;
                        populateKccMemberLabels(masterMember);
                    } else {
                        // Fallback using stored data
                        kccSelectedMember = {
                            "A Class": member.aclass,
                            "Name": member.initials ? `${member.initials} ${member.name}` : member.name,
                            "SB Account": member.sb
                        };
                        const aclassLbl = safeSelect('lbl-disb-kcc-aclass');
                        if (aclassLbl) aclassLbl.textContent = member.aclass;
                        const nameLbl = safeSelect('lbl-disb-kcc-name');
                        if (nameLbl) nameLbl.textContent = member.name;
                        const sbLbl = safeSelect('lbl-disb-kcc-sb');
                        if (sbLbl) sbLbl.textContent = member.sb;
                        const erpLbl = safeSelect('lbl-disb-kcc-erp');
                        if (erpLbl) erpLbl.textContent = member.erp || "-";
                        const initialsLbl = safeSelect('lbl-disb-kcc-initials');
                        if (initialsLbl) initialsLbl.textContent = member.initials || "-";
                    }

                    // 2. Pre-fill Part 4 (Land Details)
                    const surveyInput = safeSelect('disb-kcc-survey-no');
                    if (surveyInput) surveyInput.value = member.survey_no || "";
                    const areaInput = safeSelect('disb-kcc-area');
                    if (areaInput) areaInput.value = member.area || "";
                    const cropSelect = safeSelect('disb-kcc-crop');
                    if (cropSelect) cropSelect.value = member.crop || "தென்னை";

                    // 3. Pre-fill Part 5 (Current Loan Details)
                    const seedInput = safeSelect('disb-kcc-seed');
                    if (seedInput) seedInput.value = (member.seed || 0).toLocaleString('en-IN');
                    const fertInput = safeSelect('disb-kcc-fertilizer');
                    if (fertInput) fertInput.value = (member.fertilizer || 0).toLocaleString('en-IN');
                    const compostInput = safeSelect('disb-kcc-compost');
                    if (compostInput) compostInput.value = (member.compost || 0).toLocaleString('en-IN');
                    const pestInput = safeSelect('disb-kcc-pesticide');
                    if (pestInput) pestInput.value = (member.pesticide || 0).toLocaleString('en-IN');
                    const cashInput = safeSelect('disb-kcc-cash');
                    if (cashInput) cashInput.value = (member.cash || 0).toLocaleString('en-IN');
                    const amountInput = safeSelect('disb-kcc-amount');
                    if (amountInput) amountInput.value = (member.amount || 0).toLocaleString('en-IN');

                    // 4. Pre-fill Part 6 (Member's Other Details)
                    const memberStatusSelect = safeSelect('disb-kcc-member-status');
                    if (memberStatusSelect) memberStatusSelect.value = member.member_status || "பழைய உறுப்பினர்";
                    
                    const casteCategorySelect = safeSelect('disb-kcc-caste-category');
                    if (casteCategorySelect) casteCategorySelect.value = member.caste_category || "SC/ST";
                    
                    const farmerCategorySelect = safeSelect('disb-kcc-farmer-category');
                    if (farmerCategorySelect) farmerCategorySelect.value = member.farmer_category || "MF";
                    
                    const genderSelect = safeSelect('disb-kcc-gender');
                    if (genderSelect) genderSelect.value = member.gender || "ஆண் உறுப்பினர்";
                    
                    const disabilityInput = safeSelect('disb-kcc-disability');
                    if (disabilityInput) disabilityInput.value = member.disability !== undefined ? member.disability : "0";
                    
                    const loanStatusSelect = safeSelect('disb-kcc-loan-status');
                    if (loanStatusSelect) loanStatusSelect.value = member.loan_status || "வெந்நிலை ஜாமீன் மூலம் முன்கடன் செலுத்தியவர்";
                    
                    const collateralTypeSelect = safeSelect('disb-kcc-collateral-type');
                    if (collateralTypeSelect) collateralTypeSelect.value = member.collateral_type || "நபர் ஜாமீன்";

                    // 5. Pre-fill Part 7 (Deductions)
                    const bookInput = safeSelect('disb-kcc-book-fee');
                    if (bookInput) bookInput.value = (member.book_fee || 0).toLocaleString('en-IN');
                    const insInput = safeSelect('disb-kcc-insurance');
                    if (insInput) insInput.value = (member.insurance || 0).toLocaleString('en-IN');
                    const shareInput = safeSelect('disb-kcc-share-amount');
                    if (shareInput) shareInput.value = (member.share_amount || 0).toLocaleString('en-IN');

                    // 6. Pre-fill Part 8 (Previous Loan Repayment Details)
                    const prevNoInput = safeSelect('disb-kcc-prev-loan-no');
                    if (prevNoInput) prevNoInput.value = member.prev_loan_no || "KCC - ";
                    const prevDateInput = safeSelect('disb-kcc-prev-loan-date');
                    if (prevDateInput) prevDateInput.value = member.prev_loan_date || "";
                    const prevAmtInput = safeSelect('disb-kcc-prev-loan-amount');
                    if (prevAmtInput) prevAmtInput.value = (member.prev_loan_amount || 0).toLocaleString('en-IN');

                    // Trigger readOnly adjustments for New Member status
                    if (member.member_status === 'புதிய உறுப்பினர்') {
                        if (prevAmtInput) {
                            prevAmtInput.readOnly = true;
                            prevAmtInput.style.backgroundColor = 'var(--bg-hover)';
                        }
                    } else {
                        if (prevAmtInput) {
                            prevAmtInput.readOnly = false;
                            prevAmtInput.style.backgroundColor = '';
                        }
                    }

                    // 7. Set editing index and update button label
                    editingKccMemberIndex = idx;
                    const btnAdd = safeSelect('btn-disb-kcc-add');
                    if (btnAdd) {
                        btnAdd.textContent = "பட்டியலில் புதுப்பி (Update)";
                    }

                    // Automatically switch back to KCC Disbursement Form tab
                    const formLink = safeSelect('link-disbursement-kcc');
                    if (formLink) formLink.click();

                    // Scroll smoothly to AClass search input
                    const aclassInp = safeSelect('disb-kcc-aclass-input');
                    if (aclassInp) aclassInp.scrollIntoView({ behavior: 'smooth' });
                } catch (err) {
                    console.error("Edit click handler error: ", err);
                    alert("உறுப்பினரைத் திருத்துவதில் பிழை: " + err.message);
                }
            });
        });

        // Bind deletes
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                try {
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    kccBatchMembers.splice(idx, 1);
                    renderKccBatchTable();
                } catch (err) {
                    console.error("Delete click handler error: ", err);
                    alert("உறுப்பினரை நீக்குவதில் பிழை: " + err.message);
                }
            });
        });
    }

    /* ==========================================================================
       AH DISBURSEMENT LOGIC
       ========================================================================== */
    function initAhDisbursement() {
        const inputAClass = safeSelect('disb-ah-aclass-input');
        const btnLookup = safeSelect('btn-disb-ah-lookup');
        const btnAdd = safeSelect('btn-disb-ah-add');
        const btnSubmit = safeSelect('btn-disb-ah-submit');
        const btnPrint = safeSelect('btn-disb-ah-print');
        const btnExcel = safeSelect('btn-disb-ah-excel');
        
        const inputDate = safeSelect('disb-ah-date');
        
        if (inputDate) inputDate.value = todayStr;

        // 1. Member Lookup
        if (btnLookup) {
            btnLookup.addEventListener('click', () => {
                const query = inputAClass.value.trim();
                if (!query) {
                    alert("A Class எண்ணை உள்ளிடவும்!");
                    return;
                }

                const member = findMember(query);
                if (!member) {
                    ahSelectedMember = null;
                    alert("உறுப்பினர் கண்டறியப்படவில்லை!");
                    resetAhMemberLabels();
                    return;
                }

                ahSelectedMember = member;
                populateAhMemberLabels(member);
            });
        }

        // 2. Add Member to Batch
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                if (!ahSelectedMember) {
                    alert("முதலில் உறுப்பினரைத் தேடி ஏற்செய்யவும்!");
                    return;
                }

                const loanNo = safeSelect('disb-ah-loan-no').value.trim();
                const disbDate = safeSelect('disb-ah-date').value;
                const surveyNo = safeSelect('disb-ah-survey-no').value.trim();
                const area = parseFloat(safeSelect('disb-ah-area').value);
                const amountText = safeSelect('disb-ah-amount').value.trim().replace(/,/g, '');
                const amount = parseFloat(amountText);

                if (!loanNo || !disbDate || !surveyNo || isNaN(area) || isNaN(amount)) {
                    alert("அனைத்து விபரங்களையும் நிரப்பவும் (*)");
                    return;
                }

                const keys = Object.keys(ahSelectedMember);
                const memberId = ahSelectedMember[keys[0]] || '';
                const name = ahSelectedMember[keys.find(k => k.toLowerCase().includes('name') || k.includes('பெயர்'))] || '';
                const sb = ahSelectedMember['SB ERP No'] || ahSelectedMember['SB ERP எண்'] || ahSelectedMember[keys[1]] || '';

                ahBatchMembers.push({
                    aclass: memberId,
                    name: name,
                    sb: sb,
                    loan_no: loanNo,
                    date: disbDate,
                    survey_no: surveyNo,
                    area: area,
                    crop: "கால்நடை",
                    amount: amount
                });

                renderAhBatchTable();
                
                ahSelectedMember = null;
                inputAClass.value = "";
                resetAhMemberLabels();
                
                safeSelect('disb-ah-loan-no').value = "";
                safeSelect('disb-ah-survey-no').value = "";
                safeSelect('disb-ah-amount').value = "";
            });
        }

        // 3. Submit Batch
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                if (ahBatchMembers.length === 0) {
                    alert("பட்டியலில் எந்த உறுப்பினரும் இல்லை!");
                    return;
                }

                const sheetUrl = localStorage.getItem('pacs_google_sheet_url');
                if (!sheetUrl) {
                    alert("கூகுள் சீட் இணைப்பு வெப் ஆப் URL-ஐ இணைக்கவும்!");
                    return;
                }

                const statusDiv = safeSelect('disb-ah-status');
                statusDiv.style.color = "var(--primary)";
                statusDiv.textContent = "⏳ தகவல்கள் அனுப்பப்படுகின்றன...";

                const payload = {
                    action: "prepare_disbursement_print",
                    doc_type: safeSelect('sel-disb-ah-form').value,
                    headers: {},
                    members: ahBatchMembers
                };

                fetch(sheetUrl, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                })
                .then(() => {
                    statusDiv.style.color = "var(--success)";
                    statusDiv.textContent = "✅ கூகுள் சீட் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!";
                    safeSelect('box-disb-ah-print-actions').classList.remove('hidden');
                })
                .catch(err => {
                    statusDiv.style.color = "var(--danger)";
                    statusDiv.textContent = "❌ இணைப்பு பிழை!";
                });
            });
        }

        // 4. Print & Export for AH
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                const sheetUrl = localStorage.getItem('pacs_google_sheet_url');
                const docType = safeSelect('sel-disb-ah-form').value;
                const statusDiv = safeSelect('disb-ah-status');

                statusDiv.textContent = "⏳ அச்சு தயாராகிறது...";

                const payload = {
                    action: "prepare_disbursement_print",
                    doc_type: docType,
                    headers: {},
                    members: ahBatchMembers
                };

                fetch(sheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === "success" && data.pdf_url) {
                        statusDiv.textContent = "✅ அச்சு தயாராக உள்ளது!";
                        window.open(data.pdf_url, '_blank');
                    } else {
                        statusDiv.textContent = "❌ பிழை!";
                    }
                })
                .catch(err => {
                    statusDiv.textContent = "❌ அச்சு பிழை!";
                });
            });
        }

        if (btnExcel) {
            btnExcel.addEventListener('click', () => {
                const sheetUrl = localStorage.getItem('pacs_google_sheet_url');
                const docType = safeSelect('sel-disb-ah-form').value;
                const statusDiv = safeSelect('disb-ah-status');

                statusDiv.textContent = "⏳ எக்செல் தயாராகிறது...";

                const payload = {
                    action: "prepare_disbursement_print",
                    doc_type: docType,
                    headers: {},
                    members: ahBatchMembers
                };

                fetch(sheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === "success" && data.excel_url) {
                        statusDiv.textContent = "✅ எக்செல் தயாராக உள்ளது!";
                        window.open(data.excel_url, '_blank');
                    } else {
                        statusDiv.textContent = "❌ பிழை!";
                    }
                })
                .catch(err => {
                    statusDiv.textContent = "❌ பதிவிறக்க பிழை!";
                });
            });
        }
    }

    function populateAhMemberLabels(member) {
        const name = getFuzzyValue(member, ['name', 'பெயர்']) || '-';
        const father = getFuzzyValue(member, ['father', 'husband', 'parent', 'c/o', 'co', 'தந்தை', 'கணவர்']) || '-';
        const sb = getFuzzyValue(member, ['sb', 's.b', 'சேமிப்பு']) || '-';
        const erp = getFuzzyValue(member, ['erp', 'இஆர்பி']) || '-';
        const address = getFuzzyValue(member, ['address', 'village', 'street', 'முகவரி', 'கிராமம்']) || '-';

        safeSelect('lbl-disb-ah-name').textContent = name;
        safeSelect('lbl-disb-ah-father').textContent = father;
        safeSelect('lbl-disb-ah-sb').textContent = sb;
        safeSelect('lbl-disb-ah-erp').textContent = erp;
        safeSelect('lbl-disb-ah-address').textContent = address;
        
        const approvedAmt = getFuzzyValue(member, ['approved', 'sanction', 'ஒப்புதல்']) || '';
        if (approvedAmt) {
            safeSelect('disb-ah-amount').value = parseInt(approvedAmt).toLocaleString('en-IN');
        }
    }

    function resetAhMemberLabels() {
        safeSelect('lbl-disb-ah-name').textContent = "-";
        safeSelect('lbl-disb-ah-father').textContent = "-";
        safeSelect('lbl-disb-ah-sb').textContent = "-";
        safeSelect('lbl-disb-ah-erp').textContent = "-";
        safeSelect('lbl-disb-ah-address').textContent = "-";
    }

    function renderAhBatchTable() {
        const tbody = document.querySelector('#tbl-disb-ah-batch tbody');
        if (!tbody) return;

        tbody.innerHTML = "";

        if (ahBatchMembers.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="10" class="text-center text-muted">பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை</td></tr>';
            safeSelect('lbl-disb-ah-total-area').textContent = "0.00";
            safeSelect('lbl-disb-ah-total-amount').textContent = "₹0";
            return;
        }

        let totalArea = 0;
        let totalAmount = 0;

        ahBatchMembers.forEach((member, index) => {
            totalArea += member.area;
            totalAmount += member.amount;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td class="font-bold">${member.aclass}</td>
                <td>${member.name}</td>
                <td>${member.sb}</td>
                <td>${member.survey_no}</td>
                <td>${member.area.toFixed(2)}</td>
                <td class="font-bold">${formatCurrency(member.amount)}</td>
                <td>${member.loan_no}</td>
                <td>${member.date}</td>
                <td>
                    <button class="btn btn-secondary btn-delete" style="padding: 4px 8px; font-size: 11px; background: var(--danger); color: white;" data-idx="${index}">நீக்கு</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        safeSelect('lbl-disb-ah-total-area').textContent = totalArea.toFixed(2);
        safeSelect('lbl-disb-ah-total-amount').textContent = formatCurrency(totalAmount);

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                ahBatchMembers.splice(idx, 1);
                renderAhBatchTable();
            });
        });
    }

    // Helper to format date YYYY-MM-DD to DD-MM-YYYY
    function formatDateDDMMYYYY(dateStr) {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    }

    // HTML to Print local helper for KCC 1 Form
    function printKcc1Html(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no').value.trim();
        const rclDate = safeSelect('disb-kcc-rcl-date').value;

        // Open print window
        const w = window.open('', '_blank');
        if (!w) {
            alert("Popup blocker தடுத்துள்ளது! தயவுசெய்து Popups அனுமதித்து மீண்டும் முயற்சிக்கவும்.");
            return;
        }

        let totalPrevLoan = 0;
        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalCurrentLoan = 0;

        // Generate rows
        let rowsHtml = "";
        members.forEach((m, idx) => {
            const prevAmt = parseFloat(String(m.prev_loan_amount || '0').replace(/,/g, '')) || 0;
            const area = parseFloat(String(m.area || '0')) || 0;
            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const currentAmt = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            totalPrevLoan += prevAmt;
            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalCurrentLoan += currentAmt;

            rowsHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td class="font-bold">${m.aclass || ''}</td>
                    <td>${m.sb || ''}</td>
                    <td>${m.erp || ''}</td>
                    <td>${m.initials || ''}</td>
                    <td class="text-left font-bold">${m.name || ''}</td>
                    <td>${m.prev_loan_no || ''}</td>
                    <td>${formatDateDDMMYYYY(m.prev_loan_date)}</td>
                    <td class="text-right">${prevAmt > 0 ? prevAmt.toLocaleString('en-IN') : '0'}</td>
                    <td>${area.toFixed(2)}</td>
                    <td>${m.crop || ''}</td>
                    <td class="text-right">${seed > 0 ? seed.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${fert > 0 ? fert.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${compost > 0 ? compost.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${pest > 0 ? pest.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${cash > 0 ? cash.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right font-bold">${currentAmt.toLocaleString('en-IN')}</td>
                </tr>
            `;
        });

        // HTML Content
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>KCC 1 - பட்டுவாடா பட்டியல்</title>
    <style>
        @page {
            size: legal landscape;
            margin: 0.4in;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #111;
            margin: 0;
            padding: 0;
            background: #fff;
            -webkit-print-color-adjust: exact;
        }
        .print-container {
            width: 100%;
        }
        .print-header {
            text-align: center;
            margin-bottom: 12px;
        }
        .print-header h1 {
            font-size: 18px;
            margin: 0 0 4px 0;
            font-weight: bold;
            color: #000;
        }
        .print-header h2 {
            font-size: 16px;
            margin: 0;
            font-weight: 600;
        }
        .print-meta {
            text-align: center;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: bold;
            padding-bottom: 4px;
            border-bottom: 2px solid #000;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
        }
        th, td {
            border: 1px solid #000;
            padding: 5px 6px;
            text-align: center;
            vertical-align: middle;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
            font-size: 14px;
        }
        td {
            font-size: 12px;
        }
        .text-left {
            text-align: left;
        }
        .text-right {
            text-align: right;
        }
        .font-bold {
            font-weight: bold;
        }
        .sig-section {
            margin-top: 60px;
            display: flex;
            justify-content: center;
            gap: 250px;
            font-size: 13px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="print-container">
        <div class="print-header">
            <h1>T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்.</h1>
            <h2>KCC பயிர்க்கடன் பட்டுவாடா விபரம்</h2>
        </div>
        
        <div class="print-meta">
            மத்திய வங்கி RCL எண்: ${rclNo} &nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate)}
        </div>

        <table>
            <thead>
                <tr>
                    <th rowspan="2" style="width: 40px;">வ.எண்</th>
                    <th rowspan="2" style="width: 80px;">அ.எண் (A Class)</th>
                    <th rowspan="2" style="width: 50px;">SB</th>
                    <th rowspan="2" style="width: 70px;">ERP</th>
                    <th colspan="2">உறுப்பினர் பெயர்</th>
                    <th colspan="3">முன்கடன் திருப்பி செலுத்திய விபரம்</th>
                    <th rowspan="2" style="width: 50px;">பரப்பு</th>
                    <th rowspan="2" style="width: 60px;">பயிர்</th>
                    <th rowspan="2" style="width: 60px;">விதை</th>
                    <th rowspan="2" style="width: 60px;">இரசாயன உரம்</th>
                    <th rowspan="2" style="width: 60px;">தொழு உரம்</th>
                    <th rowspan="2" style="width: 60px;">பூச்சி மருந்து</th>
                    <th rowspan="2" style="width: 75px;">ரொக்கம்</th>
                    <th rowspan="2" style="width: 90px;">மொத்த தொகை</th>
                </tr>
                <tr>
                    <th style="width: 35px;">Ins</th>
                    <th>பெயர்</th>
                    <th style="width: 75px;">கடன் எண்</th>
                    <th style="width: 75px;">தேதி</th>
                    <th style="width: 75px;">தொகை</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
                <tr class="font-bold" style="background-color: #f9f9f9;">
                    <td colspan="4">மொத்தம்:</td>
                    <td></td>
                    <td class="text-left"></td>
                    <td colspan="2"></td>
                    <td class="text-right">${totalPrevLoan > 0 ? totalPrevLoan.toLocaleString('en-IN') : '0'}</td>
                    <td>${totalArea.toFixed(2)}</td>
                    <td></td>
                    <td class="text-right">${totalSeed > 0 ? totalSeed.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalFert > 0 ? totalFert.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalCompost > 0 ? totalCompost.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalPest > 0 ? totalPest.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalCash > 0 ? totalCash.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalCurrentLoan.toLocaleString('en-IN')}</td>
                </tr>
            </tbody>
        </table>

        <div class="sig-section">
            <div>செயலாளர்</div>
            <div>செயலாட்சியர்</div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        };
    </script>
</body>
</html>
        `;

        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    // Client-side structured Excel exporter for KCC 1 Form using SheetJS
    function exportKcc1Excel(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no').value.trim();
        const rclDate = safeSelect('disb-kcc-rcl-date').value;

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws_data = [];

        // Add headers and metadata to match the print layout form
        ws_data.push(["T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்."]);
        ws_data.push(["KCC பயிர்க்கடன் பட்டுவாடா விபரம்"]);
        ws_data.push([`மத்திய வங்கி RCL எண்: ${rclNo}     தேதி: ${formatDateDDMMYYYY(rclDate)}`]);
        ws_data.push([]); // Spacing row

        // Double-row header to replicate print layout structure
        const headerRow1 = [
            "வ.எண்", 
            "அ.எண் (A Class)", 
            "SB", 
            "ERP", 
            "உறுப்பினர் பெயர்", 
            "", // col 5 (Initials - Ins)
            "முன்கடன் திருப்பி செலுத்திய விபரம்", 
            "", // col 7 (Prev Loan No)
            "", // col 8 (Prev Loan Date)
            "பரப்பு", 
            "பயிர்", 
            "விதை", 
            "இரசாயன உரம்", 
            "தொழு உரம்", 
            "பூச்சி மருந்து", 
            "ரொக்கம்", 
            "மொத்த தொகை"
        ];

        const headerRow2 = [
            "", // வ.எண் (rowspan)
            "", // அ.எண் (rowspan)
            "", // SB (rowspan)
            "", // ERP (rowspan)
            "Ins", // col 4 (initials)
            "பெயர்", // col 5 (name)
            "கடன் எண்", // col 6
            "தேதி", // col 7
            "தொகை", // col 8
            "", // பரப்பு (rowspan)
            "", // பயிர் (rowspan)
            "", // விதை (rowspan)
            "", // இரசாயன உரம் (rowspan)
            "", // தொழு உரம் (rowspan)
            "", // பூச்சி மருந்து (rowspan)
            "", // ரொக்கம் (rowspan)
            ""  // மொத்த தொகை (rowspan)
        ];

        ws_data.push(headerRow1);
        ws_data.push(headerRow2);

        let totalPrevLoan = 0;
        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalCurrentLoan = 0;

        // Write row details
        members.forEach((m, idx) => {
            const prevAmt = parseFloat(String(m.prev_loan_amount || '0').replace(/,/g, '')) || 0;
            const area = parseFloat(String(m.area || '0')) || 0;
            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const currentAmt = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            totalPrevLoan += prevAmt;
            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalCurrentLoan += currentAmt;

            const row = [
                idx + 1,
                m.aclass || '',
                m.sb || '',
                m.erp || '',
                m.initials || '',
                m.name || '',
                m.prev_loan_no || '',
                formatDateDDMMYYYY(m.prev_loan_date),
                prevAmt,
                area,
                m.crop || '',
                seed,
                fert,
                compost,
                pest,
                cash,
                currentAmt
            ];
            ws_data.push(row);
        });

        // Add totals row
        const totalsRow = [
            "மொத்தம்:",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            totalPrevLoan,
            totalArea,
            "",
            totalSeed,
            totalFert,
            totalCompost,
            totalPest,
            totalCash,
            totalCurrentLoan
        ];
        ws_data.push(totalsRow);

        // Convert array data to worksheet
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Apply cell merge configurations
        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }, // Title 1 merge
            { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } }, // Title 2 merge
            { s: { r: 2, c: 0 }, e: { r: 2, c: 16 } }, // Title 3 merge
            
            // Header Rowspans (Row 4 & Row 5)
            { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // வ.எண்
            { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // அ.எண்
            { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // SB
            { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // ERP
            
            // Header Colspans
            { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // உறுப்பினர் பெயர்
            { s: { r: 4, c: 6 }, e: { r: 4, c: 8 } }, // முன்கடன்
            
            // Header Rowspans (Remaining columns)
            { s: { r: 4, c: 9 }, e: { r: 5, c: 9 } },  // பரப்பு
            { s: { r: 4, c: 10 }, e: { r: 5, c: 10 } }, // பயிர்
            { s: { r: 4, c: 11 }, e: { r: 5, c: 11 } }, // விதை
            { s: { r: 4, c: 12 }, e: { r: 5, c: 12 } }, // இரசாயன உரம்
            { s: { r: 4, c: 13 }, e: { r: 5, c: 13 } }, // தொழு உரம்
            { s: { r: 4, c: 14 }, e: { r: 5, c: 14 } }, // பூச்சி மருந்து
            { s: { r: 4, c: 15 }, e: { r: 5, c: 15 } }, // ரொக்கம்
            { s: { r: 4, c: 16 }, e: { r: 5, c: 16 } }, // மொத்த தொகை
            
            // Totals row merge (A to H)
            { s: { r: ws_data.length - 1, c: 0 }, e: { r: ws_data.length - 1, c: 7 } }
        ];
        ws['!merges'] = merges;

        // Apply responsive, comfortable column widths
        ws['!cols'] = [
            { wch: 6 },  // வ.எண்
            { wch: 15 }, // அ.எண்
            { wch: 10 }, // SB
            { wch: 10 }, // ERP
            { wch: 6 },  // Ins
            { wch: 20 }, // பெயர்
            { wch: 12 }, // கடன் எண்
            { wch: 12 }, // தேதி
            { wch: 12 }, // தொகை
            { wch: 8 },  // பரப்பு
            { wch: 10 }, // பயிர்
            { wch: 10 }, // விதை
            { wch: 12 }, // இரசாயன உரம்
            { wch: 10 }, // தொழு உரம்
            { wch: 12 }, // பூச்சி மருந்து
            { wch: 12 }, // ரொக்கம்
            { wch: 15 }  // மொத்த தொகை
        ];

        // Format worksheet cells with borders, fonts, colors, and alignments
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let r = range.s.r; r <= range.e.r; ++r) {
            for (let c = range.s.c; c <= range.e.c; ++c) {
                const cell_address = { c: c, r: r };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                
                // If cell object doesn't exist, create it to ensure border rendering in merges
                if (!ws[cell_ref]) ws[cell_ref] = { t: 'z' };
                ws[cell_ref].s = {};

                // Apply Indian digit grouping currency format to amounts columns (Cols 8, 11-16) for data rows and totals
                if (r >= 6 && (c === 8 || c >= 11)) {
                    ws[cell_ref].z = '[>=100000]##\\,##\\,##0;##,##0';
                }

                // 1. Apply Thin Black Borders to table header, data, and total cells (Rows 4+)
                if (r >= 4) {
                    ws[cell_ref].s.border = {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    };
                }

                // 2. Format Header & Titles
                if (r < 3) {
                    // Titles (Rows 0, 1, 2)
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: r === 0 ? 15 : 13, bold: true, color: { rgb: "000000" } };
                    ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
                } else if (r === 4 || r === 5) {
                    // Table Headers (Rows 4 and 5)
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "000000" } };
                    ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
                    ws[cell_ref].s.fill = { fgColor: { rgb: "F2F2F2" } }; // Light gray header background
                } else if (r === range.e.r) {
                    // Totals Row
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "000000" } };
                    if (c === 8 || c >= 11) {
                        ws[cell_ref].s.alignment = { horizontal: "right", vertical: "center" };
                    } else {
                        ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
                    }
                } else {
                    // Data Rows (Row 6 to N-1)
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: 10, color: { rgb: "000000" } };
                    if (c === 5) {
                        // Member name left aligned
                        ws[cell_ref].s.alignment = { horizontal: "left", vertical: "center" };
                    } else if (c === 8 || c >= 11) {
                        // Amounts right aligned (Cols 8, 11, 12, 13, 14, 15, 16)
                        ws[cell_ref].s.alignment = { horizontal: "right", vertical: "center" };
                    } else {
                        // Other fields centered (including serial number, dates, and Area col 9)
                        ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
                    }
                }
            }
        }

        // Configure sheet grid lines view parameters
        ws['!views'] = [{ showGridLines: true }];

        // Append to workbook and trigger download
        XLSX.utils.book_append_sheet(wb, ws, "KCC 1");
        XLSX.writeFile(wb, `KCC_Disbursement_${rclNo.replace(/\//g, '-')}.xlsx`);
    }

    // Initialization on page load
    document.addEventListener('DOMContentLoaded', () => {
        initKccDisbursement();
        initAhDisbursement();
    });
})();