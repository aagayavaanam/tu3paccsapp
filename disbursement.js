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

    // Default Google Sheet Web App URL for automatic zero-configuration connectivity
    const DEFAULT_GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzHoOGzprsNkIWnuYHDVcUwMvcMq0UVYTfyh4VZpup1wsCxTZtevXougyWb0zAI9vDW/exec";

    function getSheetUrl() {
        return (localStorage.getItem('pacs_google_sheet_url') || DEFAULT_GOOGLE_SHEET_URL).trim();
    }

    // Helper: Format amount to Indian Rupees
    function formatCurrency(amt) {
        return "₹" + parseInt(amt).toLocaleString('en-IN');
    }

    // Helper: Lookup member details from global localMembers array
    function findMember(query) {
        const members = (typeof localMembers !== 'undefined') ? localMembers : null;
        if (query === undefined || query === null || !members || members.length === 0) return null;
        const queryStr = String(query).toLowerCase().trim();
        if (!queryStr) return null;

        const numOnlyQuery = queryStr.replace(/[^0-9]/g, '');

        return members.find(m => {
            if (!m || typeof m !== 'object') return false;
            const keys = Object.keys(m);
            
            // Check all keys in the member object
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const rawVal = String(m[k] || '').toLowerCase().trim();
                if (!rawVal) continue;

                // 1. Exact string match with any cell
                if (rawVal === queryStr) return true;

                // 2. Flexible numeric match (e.g. user typed 1024, cell has PACS-1024 or A-1024)
                if (numOnlyQuery && numOnlyQuery.length >= 1) {
                    const cellNumOnly = rawVal.replace(/[^0-9]/g, '');
                    if (cellNumOnly === numOnlyQuery) return true;
                }

                // 3. Name or A-Class partial text match
                const kl = k.toLowerCase();
                if ((kl.includes('name') || kl.includes('பெயர்') || kl.includes('aclass') || kl.includes('a class') || kl.includes('அ')) && rawVal.includes(queryStr)) {
                    return true;
                }
            }
            return false;
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

    // Fail-safe Google Sheets sync helper (combines fetch + hidden iframe form post fallback)
    function sendToGoogleSheet(sheetUrl, payload, onComplete) {
        if (!sheetUrl) {
            if (onComplete) onComplete(true);
            return;
        }
        const cleanUrl = sheetUrl.trim();
        
        try {
            fetch(cleanUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(payload)
            }).then(() => {
                if (onComplete) onComplete(true);
            }).catch(() => {
                submitViaHiddenForm(cleanUrl, payload);
                if (onComplete) onComplete(true);
            });
        } catch (e) {
            submitViaHiddenForm(cleanUrl, payload);
            if (onComplete) onComplete(true);
        }
    }

    function submitViaHiddenForm(cleanUrl, payload) {
        try {
            let iframe = document.getElementById('gform_hidden_iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'gform_hidden_iframe';
                iframe.name = 'gform_hidden_iframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = cleanUrl;
            form.target = 'gform_hidden_iframe';
            
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'postData';
            input.value = JSON.stringify(payload);
            form.appendChild(input);
            
            document.body.appendChild(form);
            form.submit();
            setTimeout(() => {
                if (form.parentNode) form.parentNode.removeChild(form);
            }, 1000);
        } catch (err) {
            console.error("Form post error:", err);
        }
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

        // Set default Disbursement Number (auto-increment or saved)
        const inputDisbNo = safeSelect('disb-kcc-disb-no');
        if (inputDisbNo) {
            let savedDisbNo = localStorage.getItem('pacs_kcc_disb_no');
            if (!savedDisbNo) {
                const history = JSON.parse(localStorage.getItem('pacs_disbursement_history') || '[]');
                if (history.length > 0) {
                    const maxNo = Math.max(...history.map(item => parseInt(item.disb_no) || 0));
                    savedDisbNo = String(maxNo + 1);
                } else {
                    savedDisbNo = "1";
                }
            }
            inputDisbNo.value = savedDisbNo;
            inputDisbNo.addEventListener('input', () => {
                localStorage.setItem('pacs_kcc_disb_no', inputDisbNo.value.trim());
            });
        }

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
                const mdcc = getFuzzyValue(kccSelectedMember, ['mdcc', 'எம்டிசிசி']) || '';

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
                    mdcc: mdcc,
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

                const disbNo = safeSelect('disb-kcc-disb-no')?.value.trim() || '1';
                const rclNo = safeSelect('disb-kcc-rcl-no').value.trim();
                const rclDate = safeSelect('disb-kcc-rcl-date').value;
                const resNo = safeSelect('disb-kcc-res-no').value.trim();
                const resDate = safeSelect('disb-kcc-res-date').value;

                // Save batch to pacs_disbursement_history in localStorage
                let history = JSON.parse(localStorage.getItem('pacs_disbursement_history') || '[]');
                const existingIndex = history.findIndex(item => String(item.disb_no) === disbNo);
                const batchRecord = {
                    disb_no: disbNo,
                    disb_date: todayStr,
                    rcl_no: rclNo,
                    rcl_date: rclDate,
                    res_no: resNo,
                    res_date: resDate,
                    members: JSON.parse(JSON.stringify(kccBatchMembers))
                };

                if (existingIndex >= 0) {
                    history[existingIndex] = batchRecord;
                } else {
                    history.push(batchRecord);
                }
                localStorage.setItem('pacs_disbursement_history', JSON.stringify(history));

                // Auto-increment next disb_no for future batches
                const nextDisbNo = String((parseInt(disbNo) || 0) + 1);
                localStorage.setItem('pacs_kcc_disb_no', nextDisbNo);
                const inputDisbNo = safeSelect('disb-kcc-disb-no');
                if (inputDisbNo) inputDisbNo.value = nextDisbNo;

                const statusDiv = safeSelect('disb-kcc-status');
                const sheetUrl = getSheetUrl();

                if (!sheetUrl) {
                    statusDiv.style.color = "var(--success)";
                    statusDiv.textContent = `✅ பட்டுவாடா எண் ${disbNo} உள்ளூரில் சேமிக்கப்பட்டது! (அடுத்த பட்டுவாடா எண்: ${nextDisbNo})`;
                    safeSelect('box-disb-kcc-print-actions').classList.remove('hidden');
                    return;
                }

                statusDiv.style.color = "var(--primary)";
                statusDiv.textContent = "⏳ கூகுள் சீட்டில் தகவல்கள் அனுப்பப்படுகின்றன...";

                const payload = {
                    action: "save_disbursement_batch",
                    sheet_name: "All KCC Paduvada Members",
                    disb_no: disbNo,
                    disb_date: todayStr,
                    doc_type: safeSelect('sel-disb-kcc-form').value,
                    headers: {
                        rcl_no: rclNo,
                        rcl_date: rclDate,
                        res_no: resNo,
                        res_date: resDate
                    },
                    members: kccBatchMembers
                };

                sendToGoogleSheet(sheetUrl, payload, () => {
                    statusDiv.style.color = "var(--success)";
                    statusDiv.textContent = `✅ பட்டுவாடா எண் ${disbNo} 'All KCC Paduvada Members' சீட்டில் வெற்றிகரமாகப் பதியப்பட்டது! (அடுத்த பட்டுவாடா எண்: ${nextDisbNo})`;
                    safeSelect('box-disb-kcc-print-actions').classList.remove('hidden');
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

                if (docType === "KCC2") {
                    statusDiv.textContent = "⏳ KCC 2 அச்சுக்கோப்பு தயாராகிறது...";
                    try {
                        printKcc2Html(kccBatchMembers);
                        statusDiv.textContent = "✅ KCC 2 அச்சு தயாராக உள்ளது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ அச்சு பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Cropwise") {
                    statusDiv.textContent = "⏳ பயிர்வாரி சுருக்கம் அச்சு தயாராகிறது...";
                    try {
                        printCropwiseHtml(kccBatchMembers);
                        statusDiv.textContent = "✅ பயிர்வாரி சுருக்கம் அச்சு தயாராக உள்ளது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ அச்சு பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Insurance") {
                    statusDiv.textContent = "⏳ காப்பீடு விபரம் அச்சு தயாராகிறது...";
                    try {
                        printInsuranceHtml(kccBatchMembers);
                        statusDiv.textContent = "✅ காப்பீடு விபரம் அச்சு தயாராக உள்ளது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ அச்சு பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Jabitha") {
                    statusDiv.textContent = "⏳ ஜாபிதா விபரம் அச்சு தயாராகிறது...";
                    try {
                        printJabithaHtml(kccBatchMembers);
                        statusDiv.textContent = "✅ ஜாபிதா விபரம் அச்சு தயாராக உள்ளது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ அச்சு பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Sign Page") {
                    statusDiv.textContent = "⏳ கையெழுத்துப் படிவம் அச்சு தயாராகிறது...";
                    try {
                        printSignPageHtml(kccBatchMembers);
                        statusDiv.textContent = "✅ கையெழுத்துப் படிவம் அச்சு தயாராக உள்ளது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ அச்சு பிழை: " + e.message;
                    }
                    return;
                }

                const sheetUrl = getSheetUrl();
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

                if (docType === "KCC2") {
                    try {
                        exportKcc2Excel(kccBatchMembers);
                        statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ எக்செல் பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Cropwise") {
                    try {
                        exportCropwiseExcel(kccBatchMembers);
                        statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ எக்செல் பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Insurance") {
                    try {
                        exportInsuranceExcel(kccBatchMembers);
                        statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ எக்செல் பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Jabitha") {
                    try {
                        exportJabithaExcel(kccBatchMembers);
                        statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ எக்செல் பிழை: " + e.message;
                    }
                    return;
                }

                if (docType === "Sign Page") {
                    try {
                        exportSignPageExcel(kccBatchMembers);
                        statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                    } catch (e) {
                        console.error(e);
                        statusDiv.textContent = "❌ எக்செல் பிழை: " + e.message;
                    }
                    return;
                }
                
                const sheetUrl = getSheetUrl();
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

        // Toggle 💾 சேமி button visibility based on selected form (Only visible for KCC2)
        const selForm = safeSelect('sel-disb-kcc-form');
        const btnSaveSheet = safeSelect('btn-disb-kcc-save-sheet');

        function updateSaveButtonVisibility() {
            if (!selForm || !btnSaveSheet) return;
            if (selForm.value === "KCC2") {
                btnSaveSheet.classList.remove('hidden');
            } else {
                btnSaveSheet.classList.add('hidden');
            }
        }

        if (selForm) {
            selForm.addEventListener('change', updateSaveButtonVisibility);
            updateSaveButtonVisibility();
        }

        // 5. Save to Google Sheets (All KCC Paduvada Members)
        if (btnSaveSheet) {
            btnSaveSheet.addEventListener('click', () => {
                if (kccBatchMembers.length === 0) {
                    alert("பட்டியலில் எந்த உறுப்பினரும் இல்லை!");
                    return;
                }

                const disbNo = safeSelect('disb-kcc-disb-no')?.value.trim() || '1';
                const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
                const rclDate = safeSelect('disb-kcc-rcl-date')?.value || todayStr;
                const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
                const resDate = safeSelect('disb-kcc-res-date')?.value || todayStr;
                const statusDiv = safeSelect('disb-kcc-status');

                statusDiv.style.color = "var(--primary)";
                statusDiv.textContent = "⏳ 'All KCC Paduvada Members' கூகுள் சீட்டில் தகவல்கள் சேமிக்கப்படுகின்றன...";

                // Save to local history
                let history = JSON.parse(localStorage.getItem('pacs_disbursement_history') || '[]');
                const existingIndex = history.findIndex(item => String(item.disb_no) === disbNo);
                const batchRecord = {
                    disb_no: disbNo,
                    disb_date: todayStr,
                    rcl_no: rclNo,
                    rcl_date: rclDate,
                    res_no: resNo,
                    res_date: resDate,
                    members: JSON.parse(JSON.stringify(kccBatchMembers))
                };

                if (existingIndex >= 0) {
                    history[existingIndex] = batchRecord;
                } else {
                    history.push(batchRecord);
                }
                localStorage.setItem('pacs_disbursement_history', JSON.stringify(history));

                const sheetUrl = getSheetUrl();
                const payload = {
                    action: "save_disbursement_batch",
                    sheet_name: "All KCC Paduvada Members",
                    disb_no: disbNo,
                    disb_date: "", // Leave date blank initially
                    doc_type: "KCC2",
                    headers: {
                        rcl_no: rclNo,
                        rcl_date: rclDate,
                        res_no: resNo,
                        res_date: resDate
                    },
                    members: kccBatchMembers
                };

                sendToGoogleSheet(sheetUrl, payload, () => {
                    statusDiv.style.color = "var(--success)";
                    statusDiv.textContent = `✅ பட்டுவாடா எண் ${disbNo} 'All KCC Paduvada Members' சீட்டில் வெற்றிகரமாகப் பதியப்பட்டது!`;

                    // Auto-increment next disb_no for future batches
                    const nextDisbNo = String((parseInt(disbNo) || 0) + 1);
                    localStorage.setItem('pacs_kcc_disb_no', nextDisbNo);
                    const inputDisbNo = safeSelect('disb-kcc-disb-no');
                    if (inputDisbNo) inputDisbNo.value = nextDisbNo;
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

                const sheetUrl = getSheetUrl();
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
                const sheetUrl = getSheetUrl();
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
                const sheetUrl = getSheetUrl();
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
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';

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
        
        <div class="print-meta" style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; padding-bottom: 4px; border-bottom: 2px solid #000; margin-bottom: 8px;">
            <div>மத்திய வங்கி RCL எண்: ${rclNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate) || '-'}</div>
            <div>தீர்மான எண்: ${resNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தீர்மான தேதி: ${formatDateDDMMYYYY(resDate) || '-'}</div>
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

    // HTML to Print local helper for KCC 2 Form
    function printKcc2Html(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';
        const rawDisbDate = safeSelect('disb-history-date-input')?.value || '';
        const displayDisbDate = rawDisbDate ? formatDateDDMMYYYY(rawDisbDate) : '____________________';

        // Open print window
        const w = window.open('', '_blank');
        if (!w) {
            alert("Popup blocker தடுத்துள்ளது! தயவுசெய்து Popups அனுமதித்து மீண்டும் முயற்சிக்கவும்.");
            return;
        }

        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalCurrentLoan = 0;
        let totalCc6 = 0;
        let totalBookFee = 0;
        let totalInsurance = 0;
        let totalShare = 0;
        let totalDeductions = 0;
        let totalNetDisb = 0;

        let rowsHtml = "";
        members.forEach((m, idx) => {
            const area = parseFloat(String(m.area || '0')) || 0;
            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;
            
            const cc6 = fert;
            const bookFee = parseFloat(String(m.book_fee || '0').replace(/,/g, '')) || 0;
            const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;
            const share = parseFloat(String(m.share_amount || '0').replace(/,/g, '')) || 0;
            
            const totDed = cc6 + bookFee + insurance + share;
            const netDisb = totalLoan - totDed;
            const mdccAcc = m.mdcc || (findMember(m.aclass) ? getFuzzyValue(findMember(m.aclass), ['mdcc', 'எம்டிசிசி']) : '') || '';

            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalCurrentLoan += totalLoan;
            totalCc6 += cc6;
            totalBookFee += bookFee;
            totalInsurance += insurance;
            totalShare += share;
            totalDeductions += totDed;
            totalNetDisb += netDisb;

            rowsHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td class="font-bold">${m.aclass || ''}</td>
                    <td>${m.sb || ''}</td>
                    <td>${m.erp || ''}</td>
                    <td>${m.initials || ''}</td>
                    <td class="text-left font-bold">${m.name || ''}</td>
                    <td>${m.survey_no || ''}</td>
                    <td>${area.toFixed(2)}</td>
                    <td>${m.crop || ''}</td>
                    <td class="text-right">${seed > 0 ? seed.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${fert > 0 ? fert.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${compost > 0 ? compost.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${pest > 0 ? pest.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${cash > 0 ? cash.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right font-bold">${totalLoan.toLocaleString('en-IN')}</td>
                    <td class="text-right">${cc6 > 0 ? cc6.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${bookFee > 0 ? bookFee.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${insurance > 0 ? insurance.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${share > 0 ? share.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right font-bold">${totDed.toLocaleString('en-IN')}</td>
                    <td class="text-right font-bold">${netDisb.toLocaleString('en-IN')}</td>
                    <td>${mdccAcc}</td>
                </tr>
            `;
        });

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>கேசிசி 2 - பட்டுவாடா பட்டியல்</title>
    <style>
        @page {
            size: legal landscape;
            margin: 0.3in;
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
            margin-bottom: 8px;
        }
        .print-header h1 {
            font-size: 17px;
            margin: 0 0 3px 0;
            font-weight: bold;
            color: #000;
        }
        .print-header h2 {
            font-size: 15px;
            margin: 0;
            font-weight: 600;
        }
        .print-meta {
            text-align: center;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: bold;
            padding-bottom: 3px;
            border-bottom: 2px solid #000;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        th, td {
            border: 1px solid #000;
            padding: 4px 5px;
            text-align: center;
            vertical-align: middle;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
            font-size: 12px;
        }
        td {
            font-size: 11px;
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
            margin-top: 50px;
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
            <h2>பயிர்க்கடன் பட்டுவாடா விபரம்</h2>
        </div>
        
        <div class="print-meta" style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold; padding-bottom: 4px; border-bottom: 2px solid #000; margin-bottom: 6px;">
            <div>மத்திய வங்கி RCL எண்: ${rclNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate) || '-'}</div>
            <div>தீர்மான எண்: ${resNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தீர்மான தேதி: ${formatDateDDMMYYYY(resDate) || '-'}</div>
            <div>பட்டுவாடா தேதி: ${displayDisbDate}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 30px;">வ.எண்</th>
                    <th style="width: 65px;">அ.எண்</th>
                    <th style="width: 45px;">SB</th>
                    <th style="width: 60px;">ERP</th>
                    <th style="width: 35px;">Ins</th>
                    <th>பெயர்</th>
                    <th style="width: 70px;">சர்வே எண்</th>
                    <th style="width: 45px;">பரப்பு</th>
                    <th style="width: 55px;">பயிர்</th>
                    <th style="width: 55px;">விதை</th>
                    <th style="width: 60px;">இரசாயன உரம்</th>
                    <th style="width: 55px;">தொழு உரம்</th>
                    <th style="width: 55px;">பூச்சி மருந்து</th>
                    <th style="width: 65px;">ரொக்கம்</th>
                    <th style="width: 75px;">மொத்த கடன்</th>
                    <th style="width: 55px;">CC6</th>
                    <th style="width: 55px;">புத்தக பாரம்</th>
                    <th style="width: 55px;">காப்பீடு</th>
                    <th style="width: 60px;">பங்குத்தொகை</th>
                    <th style="width: 70px;">மொத்த பிடித்தம்</th>
                    <th style="width: 75px;">நிகர பட்டுவாடா</th>
                    <th style="width: 95px;">மத்திய வங்கி கணக்கு எண்</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
                <tr class="font-bold" style="background-color: #f9f9f9;">
                    <td colspan="7">மொத்தம்:</td>
                    <td>${totalArea.toFixed(2)}</td>
                    <td></td>
                    <td class="text-right">${totalSeed > 0 ? totalSeed.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalFert > 0 ? totalFert.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalCompost > 0 ? totalCompost.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalPest > 0 ? totalPest.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalCash > 0 ? totalCash.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalCurrentLoan.toLocaleString('en-IN')}</td>
                    <td class="text-right">${totalCc6 > 0 ? totalCc6.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalBookFee > 0 ? totalBookFee.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalInsurance > 0 ? totalInsurance.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalShare > 0 ? totalShare.toLocaleString('en-IN') : '0'}</td>
                    <td class="text-right">${totalDeductions.toLocaleString('en-IN')}</td>
                    <td class="text-right">${totalNetDisb.toLocaleString('en-IN')}</td>
                    <td></td>
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

    // Client-side structured Excel exporter for KCC 2 Form using SheetJS
    function exportKcc2Excel(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';
        const rawDisbDate = safeSelect('disb-history-date-input')?.value || '';
        const displayDisbDate = rawDisbDate ? formatDateDDMMYYYY(rawDisbDate) : '';

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws_data = [];

        ws_data.push(["T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்."]);
        ws_data.push(["KCC 2 - பயிர்க்கடன் பட்டுவாடா விபரம்"]);
        ws_data.push([`மத்திய வங்கி RCL எண்: ${rclNo}  தேதி: ${formatDateDDMMYYYY(rclDate)}`, "", "", "", "", `தீர்மானம் எண்: ${resNo}  தேதி: ${formatDateDDMMYYYY(resDate)}`, "", "", "", "", "", "", "", "", "", "", "", "", "", `பட்டுவாடா தேதி : ${displayDisbDate}`]);
        ws_data.push([]); // Spacing row

        const headerRow = [
            "வ.எண்", 
            "அ.எண் (A Class)", 
            "SB", 
            "ERP", 
            "Ins",
            "பெயர்", 
            "சர்வே எண்",
            "பரப்பு", 
            "பயிர்", 
            "விதை", 
            "இரசாயன உரம்", 
            "தொழு உரம்", 
            "பூச்சி மருந்து", 
            "ரொக்கம்", 
            "மொத்த கடன்",
            "CC6",
            "புத்தக பாரம்",
            "காப்பீடு",
            "பங்குத்தொகை",
            "மொத்த பிடித்தம்",
            "நிகர பட்டுவாடா",
            "மத்திய வங்கி கணக்கு எண் (MDCC)"
        ];
        ws_data.push(headerRow);

        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalCurrentLoan = 0;
        let totalCc6 = 0;
        let totalBookFee = 0;
        let totalInsurance = 0;
        let totalShare = 0;
        let totalDeductions = 0;
        let totalNetDisb = 0;

        members.forEach((m, idx) => {
            const area = parseFloat(String(m.area || '0')) || 0;
            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;
            
            const cc6 = fert;
            const bookFee = parseFloat(String(m.book_fee || '0').replace(/,/g, '')) || 0;
            const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;
            const share = parseFloat(String(m.share_amount || '0').replace(/,/g, '')) || 0;
            
            const totDed = cc6 + bookFee + insurance + share;
            const netDisb = totalLoan - totDed;
            const mdccAcc = m.mdcc || (findMember(m.aclass) ? getFuzzyValue(findMember(m.aclass), ['mdcc', 'எம்டிசிசி']) : '') || '';

            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalCurrentLoan += totalLoan;
            totalCc6 += cc6;
            totalBookFee += bookFee;
            totalInsurance += insurance;
            totalShare += share;
            totalDeductions += totDed;
            totalNetDisb += netDisb;

            const row = [
                idx + 1,
                m.aclass || '',
                m.sb || '',
                m.erp || '',
                m.initials || '',
                m.name || '',
                m.survey_no || '',
                area,
                m.crop || '',
                seed,
                fert,
                compost,
                pest,
                cash,
                totalLoan,
                cc6,
                bookFee,
                insurance,
                share,
                totDed,
                netDisb,
                mdccAcc
            ];
            ws_data.push(row);
        });

        // Totals row
        const totalsRow = [
            "மொத்தம்:",
            "",
            "",
            "",
            "",
            "",
            "",
            totalArea,
            "",
            totalSeed,
            totalFert,
            totalCompost,
            totalPest,
            totalCash,
            totalCurrentLoan,
            totalCc6,
            totalBookFee,
            totalInsurance,
            totalShare,
            totalDeductions,
            totalNetDisb,
            ""
        ];
        ws_data.push(totalsRow);

        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Merges for titles (Cols 0 to 21) and Totals (Cols 0 to 6)
        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 21 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 21 } },
            { s: { r: ws_data.length - 1, c: 0 }, e: { r: ws_data.length - 1, c: 6 } }
        ];
        ws['!merges'] = merges;

        // Column widths for 22 columns
        ws['!cols'] = [
            { wch: 6 },  // வ.எண்
            { wch: 12 }, // அ.எண்
            { wch: 10 }, // SB
            { wch: 10 }, // ERP
            { wch: 6 },  // Ins
            { wch: 20 }, // பெயர்
            { wch: 12 }, // சர்வே எண்
            { wch: 8 },  // பரப்பு
            { wch: 10 }, // பயிர்
            { wch: 10 }, // விதை
            { wch: 12 }, // இரசாயன உரம்
            { wch: 10 }, // தொழு உரம்
            { wch: 12 }, // பூச்சி மருந்து
            { wch: 12 }, // ரொக்கம்
            { wch: 14 }, // மொத்த கடன்
            { wch: 10 }, // CC6
            { wch: 12 }, // புத்தக பாரம்
            { wch: 10 }, // காப்பீடு
            { wch: 12 }, // பங்குத்தொகை
            { wch: 14 }, // மொத்த பிடித்தம்
            { wch: 14 }, // நிகர பட்டுவாடா
            { wch: 25 }  // மத்திய வங்கி கணக்கு எண் (MDCC)
        ];

        // Format worksheet cells with borders, fonts, colors, and alignments
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let r = range.s.r; r <= range.e.r; ++r) {
            for (let c = range.s.c; c <= range.e.c; ++c) {
                const cell_address = { c: c, r: r };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                
                if (!ws[cell_ref]) ws[cell_ref] = { t: 'z' };
                ws[cell_ref].s = {};

                // Apply Indian currency format to amount columns (Cols 9 to 20) for data rows and totals
                if (r >= 5 && c >= 9 && c <= 20) {
                    ws[cell_ref].z = '[>=100000]##\\,##\\,##0;##,##0';
                }

                // Thin black borders for table cells (Row 4+)
                if (r >= 4) {
                    ws[cell_ref].s.border = {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    };
                }

                if (r < 3) {
                    // Titles
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: r === 0 ? 15 : 13, bold: true, color: { rgb: "000000" } };
                    ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
                } else if (r === 4) {
                    // Header row
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "000000" } };
                    ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
                    ws[cell_ref].s.fill = { fgColor: { rgb: "F2F2F2" } };
                } else if (r === range.e.r) {
                    // Totals Row
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "000000" } };
                    if (c >= 9 && c <= 20) {
                        ws[cell_ref].s.alignment = { horizontal: "right", vertical: "center" };
                    } else {
                        ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
                    }
                } else {
                    // Data Rows
                    ws[cell_ref].s.font = { name: "Segoe UI", sz: 10, color: { rgb: "000000" } };
                    if (c === 5) {
                        // Name column left aligned
                        ws[cell_ref].s.alignment = { horizontal: "left", vertical: "center" };
                    } else if (c >= 9 && c <= 20) {
                        // Amount columns right aligned
                        ws[cell_ref].s.alignment = { horizontal: "right", vertical: "center" };
                    } else {
                        // All other columns centered
                        ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
                    }
                }
            }
        }

        ws['!views'] = [{ showGridLines: true }];

        XLSX.utils.book_append_sheet(wb, ws, "KCC 2");
        XLSX.writeFile(wb, `KCC2_Disbursement_${rclNo.replace(/\//g, '-')}.xlsx`);
    }

    /* ==========================================================================
       DISBURSEMENT HISTORY, QUERY & GOOGLE SHEETS SYNC LOGIC
       ========================================================================== */
    function initDisbursementHistory() {
        const inputHistoryNo = safeSelect('disb-history-no-input');
        const inputHistoryDate = safeSelect('disb-history-date-input');
        const btnSearch = safeSelect('btn-disb-history-search');
        const btnSync = safeSelect('btn-disb-history-sync');
        const btnPrint = safeSelect('btn-disb-history-print');
        const btnExcel = safeSelect('btn-disb-history-excel');
        const statusDiv = safeSelect('disb-history-status');
        const tableBody = safeSelect('tbl-disb-history-members')?.querySelector('tbody');
        const countBadge = safeSelect('lbl-disb-history-count');
        const boxActions = safeSelect('box-disb-history-actions');

        if (inputHistoryDate) inputHistoryDate.value = todayStr;

        let activeHistoryBatch = null;

        function renderHistoryTable(members) {
            if (!tableBody) return;
            if (!members || members.length === 0) {
                tableBody.innerHTML = `<tr class="empty-row"><td colspan="7" class="text-center text-muted">பட்டுவாடா உறுப்பினர்கள் யாரும் இல்லை</td></tr>`;
                if (countBadge) countBadge.textContent = `0 உறுப்பினர்கள்`;
                if (boxActions) boxActions.classList.add('hidden');
                return;
            }

            let totalCurrentLoan = 0;
            let totalDeductions = 0;
            let totalNetDisb = 0;

            let html = "";
            members.forEach((m, idx) => {
                const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
                const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;
                const cc6 = fert;
                const bookFee = parseFloat(String(m.book_fee || '0').replace(/,/g, '')) || 0;
                const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;
                const share = parseFloat(String(m.share_amount || '0').replace(/,/g, '')) || 0;
                
                const totDed = cc6 + bookFee + insurance + share;
                const netDisb = totalLoan - totDed;

                totalCurrentLoan += totalLoan;
                totalDeductions += totDed;
                totalNetDisb += netDisb;

                html += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td class="font-bold">${m.aclass || ''}</td>
                        <td class="text-left font-bold">${m.name || ''}</td>
                        <td>${m.crop || ''}</td>
                        <td class="text-right font-bold">${totalLoan.toLocaleString('en-IN')}</td>
                        <td class="text-right font-bold">${totDed.toLocaleString('en-IN')}</td>
                        <td class="text-right font-bold text-success" style="color: var(--success);">${netDisb.toLocaleString('en-IN')}</td>
                    </tr>
                `;
            });

            // Summary Totals Row
            html += `
                <tr class="font-bold" style="background-color: var(--bg-hover);">
                    <td colspan="4">மொத்தம்:</td>
                    <td class="text-right">${totalCurrentLoan.toLocaleString('en-IN')}</td>
                    <td class="text-right">${totalDeductions.toLocaleString('en-IN')}</td>
                    <td class="text-right text-success" style="color: var(--success);">${totalNetDisb.toLocaleString('en-IN')}</td>
                </tr>
            `;

            tableBody.innerHTML = html;
            if (countBadge) countBadge.textContent = `${members.length} உறுப்பினர்கள்`;
            if (boxActions) boxActions.classList.remove('hidden');
        }

        // Helper function for local storage fallback
        function searchLocalStorage(searchNo) {
            const history = JSON.parse(localStorage.getItem('pacs_disbursement_history') || '[]');
            const found = history.find(item => String(item.disb_no) === searchNo);
            if (found) {
                activeHistoryBatch = found;
                if (inputHistoryNo) inputHistoryNo.value = found.disb_no || searchNo;
                if (inputHistoryDate) inputHistoryDate.value = found.disb_date || '';
                renderHistoryTable(found.members);
                if (statusDiv) {
                    statusDiv.style.color = "var(--success)";
                    statusDiv.textContent = `✅ பட்டுவாடா எண் ${found.disb_no}-இல் ${found.members.length} உறுப்பினர்கள் உள்ளூர் நினைவகத்திலிருந்து பெறப்பட்டனர்.`;
                }
            } else {
                activeHistoryBatch = null;
                renderHistoryTable([]);
                if (statusDiv) {
                    statusDiv.style.color = "var(--danger)";
                    statusDiv.textContent = `❌ பட்டுவாடா எண் (${searchNo || '-'}) விபரங்கள் எதுவும் கிடைக்கவில்லை.`;
                }
            }
        }

        // Search Button Handler (Live Sheet Sync First)
        if (btnSearch) {
            btnSearch.addEventListener('click', () => {
                const searchNo = inputHistoryNo.value.trim();

                if (!searchNo) {
                    alert("பட்டுவாடா எண்ணை உள்ளிடவும்!");
                    return;
                }

                const sheetUrl = getSheetUrl();
                if (statusDiv) {
                    statusDiv.style.color = "var(--primary)";
                    statusDiv.textContent = `⏳ பட்டுவாடா எண் ${searchNo} கூகுள் சீட்டில் நேரலையாகத் தேடப்படுகிறது...`;
                }

                if (sheetUrl) {
                    const queryUrl = `${sheetUrl}?sheet_name=All%20KCC%20Paduvada%20Members&disb_no=${encodeURIComponent(searchNo)}`;
                    fetch(queryUrl)
                        .then(res => res.json())
                        .then(resData => {
                            if (resData && resData.members && resData.members.length > 0) {
                                activeHistoryBatch = {
                                    disb_no: searchNo,
                                    disb_date: resData.disb_date || '',
                                    members: resData.members
                                };
                                if (inputHistoryDate) inputHistoryDate.value = resData.disb_date || todayStr;
                                renderHistoryTable(resData.members);
                                if (statusDiv) {
                                    statusDiv.style.color = "var(--success)";
                                    statusDiv.textContent = `✅ பட்டுவாடா எண் ${searchNo}-இல் ${resData.members.length} உறுப்பினர்கள் கூகுள் சீட்டிலிருந்து கண்டறியப்பட்டனர்.`;
                                }
                            } else {
                                // If deleted from Google Sheets, clear from local history as well!
                                let history = JSON.parse(localStorage.getItem('pacs_disbursement_history') || '[]');
                                history = history.filter(item => String(item.disb_no) !== searchNo);
                                localStorage.setItem('pacs_disbursement_history', JSON.stringify(history));

                                activeHistoryBatch = null;
                                renderHistoryTable([]);
                                if (statusDiv) {
                                    statusDiv.style.color = "var(--danger)";
                                    statusDiv.textContent = `❌ பட்டுவாடா எண் (${searchNo}) கூகுள் சீட்டில் இல்லை (டெலிட் செய்யப்பட்டுள்ளது).`;
                                }
                            }
                        })
                        .catch(err => {
                            console.warn("Live sheet fetch failed, falling back to local storage", err);
                            searchLocalStorage(searchNo);
                        });
                } else {
                    searchLocalStorage(searchNo);
                }
            });
        }

        // Sync to Google Sheets Handler
        if (btnSync) {
            btnSync.addEventListener('click', () => {
                const disbNo = inputHistoryNo.value.trim();
                const disbDate = inputHistoryDate.value;

                if (!disbNo) {
                    alert("பட்டுவாடா எண்ணை உள்ளிடவும்!");
                    return;
                }

                if (!activeHistoryBatch || !activeHistoryBatch.members || activeHistoryBatch.members.length === 0) {
                    alert("முதலில் பட்டுவாடா எண்ணை உள்ளிட்டு 'விபரம் காட்டு' அழுத்தவும்!");
                    return;
                }

                // Update date in local history record
                activeHistoryBatch.disb_date = disbDate;
                let history = JSON.parse(localStorage.getItem('pacs_disbursement_history') || '[]');
                const idx = history.findIndex(item => String(item.disb_no) === disbNo);
                if (idx >= 0) {
                    history[idx].disb_date = disbDate;
                } else {
                    history.push(activeHistoryBatch);
                }
                localStorage.setItem('pacs_disbursement_history', JSON.stringify(history));

                const sheetUrl = getSheetUrl();
                if (!sheetUrl) {
                    alert("கூகுள் சீட் URL அமைக்கப்படவில்லை!");
                    return;
                }

                if (statusDiv) {
                    statusDiv.style.color = "var(--text-muted)";
                    statusDiv.textContent = "⏳ 'All KCC Paduvada Members' கூகுள் சீட்டில் பதிவு செய்யப்படுகிறது...";
                }

                const payload = {
                    action: "save_disbursement_batch",
                    sheet_name: "All KCC Paduvada Members",
                    disb_no: disbNo,
                    disb_date: disbDate,
                    doc_type: "KCC2",
                    headers: {
                        rcl_no: activeHistoryBatch.rcl_no || "",
                        rcl_date: activeHistoryBatch.rcl_date || "",
                        res_no: activeHistoryBatch.res_no || "",
                        res_date: activeHistoryBatch.res_date || ""
                    },
                    members: activeHistoryBatch.members
                };

                sendToGoogleSheet(sheetUrl, payload, () => {
                    if (statusDiv) {
                        statusDiv.style.color = "var(--success)";
                        statusDiv.textContent = `✅ பட்டுவாடா எண் ${disbNo} (தேதி: ${formatDateDDMMYYYY(disbDate)}) 'All KCC Paduvada Members' சீட்டில் வெற்றிகரமாகப் பதியப்பட்டது!`;
                    }
                });
            });
        }

        // Form Dropdown Selection Handler
        const selHistoryForm = safeSelect('sel-disb-history-form');
        if (selHistoryForm && btnSync) {
            selHistoryForm.addEventListener('change', () => {
                const docType = selHistoryForm.value;
                if (docType === 'KCC2') {
                    btnSync.style.display = 'inline-flex';
                } else {
                    btnSync.style.display = 'none';
                }
            });
        }

        // Print Handler for History Page
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                if (!activeHistoryBatch || !activeHistoryBatch.members || activeHistoryBatch.members.length === 0) {
                    alert("அச்சிட உறுப்பினர்கள் யாரும் இல்லை!");
                    return;
                }

                // Populate headers from active history batch if main inputs are empty
                if (activeHistoryBatch.rcl_no && safeSelect('disb-kcc-rcl-no')) safeSelect('disb-kcc-rcl-no').value = activeHistoryBatch.rcl_no;
                if (activeHistoryBatch.rcl_date && safeSelect('disb-kcc-rcl-date')) safeSelect('disb-kcc-rcl-date').value = activeHistoryBatch.rcl_date;
                if (activeHistoryBatch.res_no && safeSelect('disb-kcc-res-no')) safeSelect('disb-kcc-res-no').value = activeHistoryBatch.res_no;
                if (activeHistoryBatch.res_date && safeSelect('disb-kcc-res-date')) safeSelect('disb-kcc-res-date').value = activeHistoryBatch.res_date;

                const docType = selHistoryForm ? selHistoryForm.value : "KCC2";

                if (docType === "KCC1") {
                    printKcc1Html(activeHistoryBatch.members);
                } else if (docType === "KCC2") {
                    printKcc2Html(activeHistoryBatch.members);
                } else if (docType === "Cropwise") {
                    printCropwiseHtml(activeHistoryBatch.members);
                } else if (docType === "Insurance") {
                    printInsuranceHtml(activeHistoryBatch.members);
                } else if (docType === "Jabitha") {
                    printJabithaHtml(activeHistoryBatch.members);
                } else if (docType === "Sign Page") {
                    printSignPageHtml(activeHistoryBatch.members);
                } else {
                    // Repost to Apps Script for Google Sheet prepared layouts
                    const sheetUrl = getSheetUrl();
                    if (!sheetUrl) {
                        alert("கூகுள் சீட் URL அமைக்கப்படவில்லை!");
                        return;
                    }
                    if (statusDiv) statusDiv.textContent = "⏳ அச்சுக்கோப்பு தயாராகிறது...";
                    const payload = {
                        action: "prepare_disbursement_print",
                        doc_type: docType,
                        headers: {
                            rcl_no: activeHistoryBatch.rcl_no || "",
                            rcl_date: activeHistoryBatch.rcl_date || "",
                            res_no: activeHistoryBatch.res_no || "",
                            res_date: activeHistoryBatch.res_date || ""
                        },
                        members: activeHistoryBatch.members
                    };
                    sendToGoogleSheet(sheetUrl, payload, (res) => {
                        if (res && res.download_url) {
                            window.open(res.download_url, '_blank');
                            if (statusDiv) statusDiv.textContent = "✅ அச்சுக்கோப்பு தயாராக உள்ளது!";
                        } else {
                            if (statusDiv) statusDiv.textContent = "❌ அச்சுக்கோப்பு தயாரிப்பில் பிழை ஏற்பட்டுள்ளது.";
                        }
                    });
                }
            });
        }

        // Excel Handler for History Page
        if (btnExcel) {
            btnExcel.addEventListener('click', () => {
                if (!activeHistoryBatch || !activeHistoryBatch.members || activeHistoryBatch.members.length === 0) {
                    alert("பதிவிறக்க உறுப்பினர்கள் யாரும் இல்லை!");
                    return;
                }

                // Populate headers from active history batch if main inputs are empty
                if (activeHistoryBatch.rcl_no && safeSelect('disb-kcc-rcl-no')) safeSelect('disb-kcc-rcl-no').value = activeHistoryBatch.rcl_no;
                if (activeHistoryBatch.rcl_date && safeSelect('disb-kcc-rcl-date')) safeSelect('disb-kcc-rcl-date').value = activeHistoryBatch.rcl_date;
                if (activeHistoryBatch.res_no && safeSelect('disb-kcc-res-no')) safeSelect('disb-kcc-res-no').value = activeHistoryBatch.res_no;
                if (activeHistoryBatch.res_date && safeSelect('disb-kcc-res-date')) safeSelect('disb-kcc-res-date').value = activeHistoryBatch.res_date;

                const docType = selHistoryForm ? selHistoryForm.value : "KCC2";

                if (docType === "KCC1") {
                    exportKcc1Excel(activeHistoryBatch.members);
                } else if (docType === "KCC2") {
                    exportKcc2Excel(activeHistoryBatch.members);
                } else if (docType === "Cropwise") {
                    exportCropwiseExcel(activeHistoryBatch.members);
                } else if (docType === "Insurance") {
                    exportInsuranceExcel(activeHistoryBatch.members);
                } else if (docType === "Jabitha") {
                    exportJabithaExcel(activeHistoryBatch.members);
                } else if (docType === "Sign Page") {
                    exportSignPageExcel(activeHistoryBatch.members);
                } else {
                    const sheetUrl = getSheetUrl();
                    if (!sheetUrl) {
                        alert("கூகுள் சீட் URL அமைக்கப்படவில்லை!");
                        return;
                    }
                    if (statusDiv) statusDiv.textContent = "⏳ எக்செல் தயாரிப்பில் உள்ளது...";
                    const payload = {
                        action: "prepare_disbursement_print",
                        doc_type: docType,
                        headers: {
                            rcl_no: activeHistoryBatch.rcl_no || "",
                            rcl_date: activeHistoryBatch.rcl_date || "",
                            res_no: activeHistoryBatch.res_no || "",
                            res_date: activeHistoryBatch.res_date || ""
                        },
                        members: activeHistoryBatch.members
                    };
                    sendToGoogleSheet(sheetUrl, payload, (res) => {
                        if (res && res.download_url) {
                            window.open(res.download_url, '_blank');
                            if (statusDiv) statusDiv.textContent = "✅ எக்செல் கோப்பு பதிவிறக்கம் செய்யப்பட்டது!";
                        } else {
                            if (statusDiv) statusDiv.textContent = "❌ எக்செல் தயாரிப்பில் பிழை ஏற்பட்டுள்ளது.";
                        }
                    });
                }
            });
        }
    }

    /* ==========================================================================
       CROPWISE SUMMARY PRINT & EXCEL ENGINE
       ========================================================================== */
    function printCropwiseHtml(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';

        // Group members by Crop
        const cropMap = {};
        let newMemberCount = 0, newMemberAmt = 0;
        let scStCount = 0, scStAmt = 0;
        let otherCommunityCount = 0, otherCommunityAmt = 0;
        let mfCount = 0, mfAmt = 0;
        let sfCount = 0, sfAmt = 0;
        let ofCount = 0, ofAmt = 0;
        let femaleCount = 0, femaleAmt = 0;

        members.forEach(m => {
            const cropName = (m.crop || 'மற்றவை').trim();
            if (!cropMap[cropName]) {
                cropMap[cropName] = {
                    count: 0,
                    area: 0,
                    seed: 0,
                    fertilizer: 0,
                    compost: 0,
                    pesticide: 0,
                    cash: 0,
                    amount: 0
                };
            }

            const area = parseFloat(String(m.area || '0')) || 0;
            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            cropMap[cropName].count += 1;
            cropMap[cropName].area += area;
            cropMap[cropName].seed += seed;
            cropMap[cropName].fertilizer += fert;
            cropMap[cropName].compost += compost;
            cropMap[cropName].pesticide += pest;
            cropMap[cropName].cash += cash;
            cropMap[cropName].amount += totalLoan;

            // Calculate Category & Demographic Breakdown
            const rawCat = (m.community || m.category || getFuzzyValue(m, ['community', 'category', 'சாதி', 'பிரிவு']) || '').toUpperCase();
            const rawFarmer = (m.farmer_type || getFuzzyValue(m, ['farmer_type', 'farmer', 'விவசாயி பிரிவு']) || '').toUpperCase();
            const rawGender = (m.gender || m.sex || getFuzzyValue(m, ['gender', 'sex', 'பாலினம்']) || '').toUpperCase();
            const isNew = m.is_new || getFuzzyValue(m, ['is_new', 'new', 'புதிய']) === true || String(getFuzzyValue(m, ['is_new', 'new', 'புதிய'])).toLowerCase().includes('புதிய');

            if (isNew) {
                newMemberCount++;
                newMemberAmt += totalLoan;
            }

            if (rawCat.includes('SC') || rawCat.includes('ST') || rawCat.includes('எஸ்டி') || rawCat.includes('எஸ்.சி')) {
                scStCount++;
                scStAmt += totalLoan;
            } else {
                otherCommunityCount++;
                otherCommunityAmt += totalLoan;
            }

            if (rawFarmer.includes('MF') || rawFarmer.includes('குறு') || (area > 0 && area <= 2.5)) {
                mfCount++;
                mfAmt += totalLoan;
            } else if (rawFarmer.includes('SF') || rawFarmer.includes('சிறு') || (area > 2.5 && area <= 5.0)) {
                sfCount++;
                sfAmt += totalLoan;
            } else {
                ofCount++;
                ofAmt += totalLoan;
            }

            if (rawGender.includes('F') || rawGender.includes('FEMALE') || rawGender.includes('பெண்')) {
                femaleCount++;
                femaleAmt += totalLoan;
            }
        });

        // Open print window
        const w = window.open('', '_blank');
        if (!w) {
            alert("Popup blocker தடுத்துள்ளது! தயவுசெய்து Popups அனுமதித்து மீண்டும் முயற்சிக்கவும்.");
            return;
        }

        let totalMembers = 0;
        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalLoan = 0;

        let rowsHtml = "";
        let idx = 1;
        for (const cropName in cropMap) {
            const c = cropMap[cropName];

            totalMembers += c.count;
            totalArea += c.area;
            totalSeed += c.seed;
            totalFert += c.fertilizer;
            totalCompost += c.compost;
            totalPest += c.pesticide;
            totalCash += c.cash;
            totalLoan += c.amount;

            rowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx++}</td>
                    <td style="text-align: left; font-weight: bold;">${cropName}</td>
                    <td style="text-align: center;">${c.count}</td>
                    <td style="text-align: center;">${c.area.toFixed(2)}</td>
                    <td style="text-align: right;">${c.seed > 0 ? c.seed.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${c.fertilizer > 0 ? c.fertilizer.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${c.compost > 0 ? c.compost.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${c.pesticide > 0 ? c.pesticide.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${c.cash > 0 ? c.cash.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right; font-weight: bold;">${c.amount.toLocaleString('en-IN')}</td>
                </tr>
            `;
        }

        const html = `
<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <title>பயிர்வாரி சுருக்கம் - T.U.3 தேவாரம்</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            color: #000;
            margin: 0;
            padding: 5px;
        }
        .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
        }
        .header h2 {
            margin: 0 0 4px 0;
            font-size: 14pt;
        }
        .header h3 {
            margin: 0;
            font-size: 12pt;
            color: #222;
        }
        .top-summary-container {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 12px;
        }
        .summary-box-left {
            flex: 1.3;
        }
        .summary-box-right {
            flex: 0.9;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        th, td {
            border: 1px solid #000;
            padding: 5px 6px;
            font-size: 9.5pt;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
        }
        .declaration-text {
            margin: 15px 0 35px 0;
            font-size: 9.5pt;
            line-height: 1.5;
            text-align: justify;
        }
        .signature-block {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding: 0 10px;
            font-weight: bold;
            font-size: 10pt;
        }
        .signature-box {
            text-align: center;
            width: 30%;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்.</h2>
        <h3>KCC பயிர்க்கடன் பட்டுவாடா - பயிர்வாரியாக கடன் விபரம்</h3>
    </div>

    <!-- RCL Metadata Line (Centered) -->
    <div style="text-align: center; margin-bottom: 12px; font-weight: bold; font-size: 10.5pt;">
        RCL எண்: ${rclNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate) || '-'}
    </div>

    <!-- Top Summary Tables Section -->
    <div class="top-summary-container">
        <!-- Left Side: Member Demographics & Category Breakdown -->
        <div class="summary-box-left">
            <table>
                <thead>
                    <tr>
                        <th colspan="3">உறுப்பினர்கள் பிரிவுவாரி சுருக்கம்</th>
                    </tr>
                    <tr>
                        <th>பிரிவு</th>
                        <th>நபர்கள்</th>
                        <th>தொகை (ரூ.)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>புதிய உறுப்பினர் விபரம்</td>
                        <td style="text-align: center;">${newMemberCount}</td>
                        <td style="text-align: right;">${newMemberAmt > 0 ? newMemberAmt.toLocaleString('en-IN') : '0'}</td>
                    </tr>
                    <tr>
                        <td>எஸ்ஸி / எஸ்டி உறுப்பினர் விபரம்</td>
                        <td style="text-align: center;">${scStCount}</td>
                        <td style="text-align: right;">${scStAmt > 0 ? scStAmt.toLocaleString('en-IN') : '0'}</td>
                    </tr>
                    <tr>
                        <td>மற்ற உறுப்பினர்கள் விபரம்</td>
                        <td style="text-align: center;">${otherCommunityCount}</td>
                        <td style="text-align: right;">${otherCommunityAmt > 0 ? otherCommunityAmt.toLocaleString('en-IN') : '0'}</td>
                    </tr>
                    <tr>
                        <td>SF / MF (சிறு / குறு விவசாயி) உறுப்பினர்</td>
                        <td style="text-align: center;">${sfCount + mfCount}</td>
                        <td style="text-align: right;">${(sfAmt + mfAmt) > 0 ? (sfAmt + mfAmt).toLocaleString('en-IN') : '0'}</td>
                    </tr>
                    <tr>
                        <td>OF (இதர விவசாயி) உறுப்பினர்</td>
                        <td style="text-align: center;">${ofCount}</td>
                        <td style="text-align: right;">${ofAmt > 0 ? ofAmt.toLocaleString('en-IN') : '0'}</td>
                    </tr>
                    <tr>
                        <td>பெண் உறுப்பினர் விபரம்</td>
                        <td style="text-align: center;">${femaleCount}</td>
                        <td style="text-align: right;">${femaleAmt > 0 ? femaleAmt.toLocaleString('en-IN') : '0'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Right Side: MDCC Bank Remittance Details Table (Always 3 Empty Rows) -->
        <div class="summary-box-right">
            <table>
                <thead>
                    <tr>
                        <th colspan="3">மத்திய வங்கியில் இருசால் செய்த தேதி & தொகை</th>
                    </tr>
                    <tr>
                        <th>வ.எண்</th>
                        <th>இருசால் தேதி</th>
                        <th>இருசால் தொகை (ரூ.)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align: center;">1</td>
                        <td style="text-align: center;"></td>
                        <td style="text-align: right;"></td>
                    </tr>
                    <tr>
                        <td style="text-align: center;">2</td>
                        <td style="text-align: center;"></td>
                        <td style="text-align: right;"></td>
                    </tr>
                    <tr>
                        <td style="text-align: center;">3</td>
                        <td style="text-align: center;"></td>
                        <td style="text-align: right;"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Main Cropwise Summary Table -->
    <table>
        <thead>
            <tr>
                <th style="width: 5%;">வ.எண்</th>
                <th style="width: 20%;">பயிர் பெயர்</th>
                <th style="width: 10%;">உறுப்பினர்கள்</th>
                <th style="width: 10%;">மொத்த பரப்பு (ஏக்கர்)</th>
                <th style="width: 9%;">விதை (ரூ.)</th>
                <th style="width: 9%;">இரசாயன உரம் (ரூ.)</th>
                <th style="width: 9%;">தொழு உரம் (ரூ.)</th>
                <th style="width: 9%;">பூச்சி மருந்து (ரூ.)</th>
                <th style="width: 9%;">ரொக்கம் (ரூ.)</th>
                <th style="width: 10%;">மொத்த கடன் (ரூ.)</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="2" style="text-align: center;">மொத்தம்</td>
                <td style="text-align: center;">${totalMembers}</td>
                <td style="text-align: center;">${totalArea.toFixed(2)}</td>
                <td style="text-align: right;">${totalSeed > 0 ? totalSeed.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalFert > 0 ? totalFert.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCompost > 0 ? totalCompost.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalPest > 0 ? totalPest.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCash > 0 ? totalCash.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalLoan.toLocaleString('en-IN')}</td>
            </tr>
        </tbody>
    </table>

    <!-- Declaration Statement Text (Centered, No Prefix) -->
    <div style="margin: 20px auto 35px auto; font-size: 10pt; line-height: 1.6; text-align: center; max-width: 92%; font-weight: 500;">
        மேலே கண்ட உறுப்பினர்கள் நிலங்களை ஆய்வு செய்து சிட்டா அடங்களில் குறிப்பிட்டுள்ள பயிர்களை பயிரிட்டுள்ளனர் என நேரில் சென்று ஆய்வு செய்தேன் என சான்று செய்கிறோம்.
    </div>

    <!-- Official Signatures Block -->
    <div class="signature-block">
        <div class="signature-box">
            <br><br>
            செயலாளர்
        </div>
        <div class="signature-box">
            <br><br>
            செயலாட்சியர்
        </div>
        <div class="signature-box">
            <br><br>
            சரக மேற்பார்வையாளர்
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
        `;

        w.document.write(html);
        w.document.close();
    }

    function exportCropwiseExcel(members) {
        if (!members || members.length === 0) {
            alert("பதிவிறக்க உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';

        // Group members by Crop
        const cropMap = {};
        members.forEach(m => {
            const cropName = (m.crop || 'மற்றவை').trim();
            if (!cropMap[cropName]) {
                cropMap[cropName] = {
                    count: 0,
                    area: 0,
                    seed: 0,
                    fertilizer: 0,
                    compost: 0,
                    pesticide: 0,
                    cash: 0,
                    amount: 0
                };
            }

            const area = parseFloat(String(m.area || '0')) || 0;
            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            cropMap[cropName].count += 1;
            cropMap[cropName].area += area;
            cropMap[cropName].seed += seed;
            cropMap[cropName].fertilizer += fert;
            cropMap[cropName].compost += compost;
            cropMap[cropName].pesticide += pest;
            cropMap[cropName].cash += cash;
            cropMap[cropName].amount += totalLoan;
        });

        const dataRows = [
            ["துருவை தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம் லிமிடெட்"],
            ["கேசிசி கடன் பட்டுவாடா - பயிர்வாரி கடன் சுருக்கம் (Cropwise Summary)"],
            [`RCL எண்: ${rclNo} (தேதி: ${formatDateDDMMYYYY(rclDate)})  |  தீர்மானம் எண்: ${resNo} (தேதி: ${formatDateDDMMYYYY(resDate)})`],
            [],
            ["வ.எண்", "பயிர் பெயர்", "உறுப்பினர்கள்", "மொத்த பரப்பு (ஏக்கர்)", "விதை (ரூ.)", "இரசாயன உரம் (ரூ.)", "தொழு உரம் (ரூ.)", "பூச்சி மருந்து (ரூ.)", "ரொக்கம் (ரூ.)", "மொத்த கடன் (ரூ.)"]
        ];

        let totalMembers = 0;
        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalLoan = 0;

        let idx = 1;
        for (const cropName in cropMap) {
            const c = cropMap[cropName];
            totalMembers += c.count;
            totalArea += c.area;
            totalSeed += c.seed;
            totalFert += c.fertilizer;
            totalCompost += c.compost;
            totalPest += c.pesticide;
            totalCash += c.cash;
            totalLoan += c.amount;

            dataRows.push([
                idx++,
                cropName,
                c.count,
                parseFloat(c.area.toFixed(2)),
                c.seed,
                c.fertilizer,
                c.compost,
                c.pesticide,
                c.cash,
                c.amount
            ]);
        }

        // Totals row
        dataRows.push([
            "மொத்தம்",
            "",
            totalMembers,
            parseFloat(totalArea.toFixed(2)),
            totalSeed,
            totalFert,
            totalCompost,
            totalPest,
            totalCash,
            totalLoan
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
            { s: { r: dataRows.length - 1, c: 0 }, e: { r: dataRows.length - 1, c: 1 } }
        ];

        ws['!cols'] = [
            { wch: 8 },  // வ.எண்
            { wch: 22 }, // பயிர் பெயர்
            { wch: 14 }, // உறுப்பினர்கள்
            { wch: 18 }, // பரப்பு
            { wch: 14 }, // விதை
            { wch: 16 }, // உரம்
            { wch: 14 }, // தொழு உரம்
            { wch: 16 }, // பூச்சி மருந்து
            { wch: 14 }, // ரொக்கம்
            { wch: 16 }  // மொத்த கடன்
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Cropwise Summary");
        XLSX.writeFile(wb, `Cropwise_Summary_${rclNo.replace(/\//g, '-')}.xlsx`);
    }

    /* ==========================================================================
       INSURANCE SUMMARY PRINT & EXCEL ENGINE
       ========================================================================== */
    function printInsuranceHtml(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';

        // Open print window
        const w = window.open('', '_blank');
        if (!w) {
            alert("Popup blocker தடுத்துள்ளது! தயவுசெய்து Popups அனுமதித்து மீண்டும் முயற்சிக்கவும்.");
            return;
        }

        let totalInsurance = 0;
        let rowsHtml = "";

        members.forEach((m, idx) => {
            const masterM = typeof findMember === 'function' ? findMember(m.aclass) : null;

            const sb = m.sb || m.sb_no || (masterM ? getFuzzyValue(masterM, ['sb', 'sb_account', 'சேமிப்பு எண்']) : '') || '';
            const erp = m.erp || m.erp_no || (masterM ? getFuzzyValue(masterM, ['erp', 'erp_no']) : '') || '';
            const name = m.name || (masterM ? getFuzzyValue(masterM, ['name', 'பெயர்']) : '') || '';
            const fatherName = m.father_name || m.husband_name || (masterM ? getFuzzyValue(masterM, ['c/o', 'co', 'c_o', 'care_of', 'father', 'father_name', 'husband', 'தகப்பனார்', 'கணவர்']) : '') || '';
            const village = m.village || m.address || (masterM ? getFuzzyValue(masterM, ['village', 'address', 'கிராமம்', 'முகவரி']) : '') || '';
            const ration = m.ration || m.smart_card || (masterM ? getFuzzyValue(masterM, ['ration', 'smart_card', 'குடும்ப அட்டை']) : '') || '';
            const disability = m.disability || (masterM ? getFuzzyValue(masterM, ['disability', 'குறைபாடு']) : '0') || '0';
            const nomineeName = m.nominee_name || (masterM ? getFuzzyValue(masterM, ['namini', 'nominee', 'nominee_name', 'நாமினி']) : '') || '';
            const nomineeRelation = m.nominee_relation || (masterM ? getFuzzyValue(masterM, ['relation', 'nominee_relation', 'உறவு', 'உறவுமுறை']) : '') || '';
            const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;

            totalInsurance += insurance;

            rowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: center; font-weight: bold;">${m.aclass || ''}</td>
                    <td style="text-align: center;">${sb}</td>
                    <td style="text-align: center;">${erp}</td>
                    <td style="text-align: left; font-weight: bold;">${name}</td>
                    <td style="text-align: left;">${fatherName}</td>
                    <td style="text-align: left;">${village}</td>
                    <td style="text-align: center;">${ration}</td>
                    <td style="text-align: center;">${disability}</td>
                    <td style="text-align: left;">${nomineeName}</td>
                    <td style="text-align: center;">${nomineeRelation}</td>
                    <td style="text-align: right; font-weight: bold;">${insurance > 0 ? insurance.toLocaleString('en-IN') : '0'}</td>
                </tr>
            `;
        });

        const html = `
<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <title>காப்பீடு விவரம் - T.U.3 தேவாரம்</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 8mm;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 9.5pt;
            color: #000;
            margin: 0;
            padding: 5px;
        }
        .header {
            text-align: center;
            margin-bottom: 12px;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
        }
        .header h2 {
            margin: 0 0 4px 0;
            font-size: 15pt;
        }
        .header h3 {
            margin: 0 0 4px 0;
            font-size: 13pt;
        }
        .header h4 {
            margin: 0;
            font-size: 11pt;
            font-weight: normal;
            color: #333;
        }
        .header-letter {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            font-size: 10pt;
            line-height: 1.5;
            padding: 0 40px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        th, td {
            border: 1px solid #000;
            padding: 4px 5px;
            font-size: 9pt;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
        }
        .signature-block {
            display: flex;
            justify-content: flex-end;
            margin-top: 35px;
            padding-right: 30px;
            font-weight: bold;
            font-size: 10pt;
        }
        .signature-box {
            text-align: center;
            width: 200px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்.</h2>
        <h3>பயிர்க்கடன் பட்டுவாடா விபரம்</h3>
        <h4>(காசுகடன் KCC - உறுப்பினர்கள் விபத்துக் காப்பீடு விவரம்)</h4>
    </div>

    <!-- From / To Letter Section -->
    <div class="header-letter">
        <div style="padding-left: 20px;">
            <strong>அனுப்புநர்</strong><br>
            <div style="padding-left: 15px;">
                செயலாளர்<br>
                TU3 தேவாரம் PACCS<br>
                தேவாரம்
            </div>
        </div>
        <div style="padding-right: 20px;">
            <strong>பெறுநர்</strong><br>
            <div style="padding-left: 15px;">
                கிளை மேலாளர் அவர்கள்<br>
                மதுரை மாவட்ட மத்திய கூட்டுறவு வங்கி,<br>
                தேவாரம் கிளை
            </div>
        </div>
    </div>

    <!-- RCL Metadata Line -->
    <div style="text-align: center; font-weight: bold; font-size: 10.5pt; margin-bottom: 12px;">
        RCL எண்: ${rclNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate) || '-'}
    </div>

    <table>
        <thead>
            <tr>
                <th rowspan="2" style="width: 35px;">வ.எண்</th>
                <th colspan="4">உறுப்பினர்</th>
                <th rowspan="2">தகப்பனார்/ கணவர் பெயர்</th>
                <th rowspan="2">கிராமம்</th>
                <th rowspan="2">குடும்ப அட்டை எண்</th>
                <th rowspan="2" style="width: 65px;">உடலில் உள்ள குறைபாடு</th>
                <th rowspan="2">நாமினியின் பெயர்</th>
                <th rowspan="2">உறவு</th>
                <th rowspan="2" style="width: 75px;">சந்தாத் தொகை</th>
            </tr>
            <tr>
                <th style="width: 55px;">எண்</th>
                <th style="width: 65px;">சேமிப்பு எண்</th>
                <th style="width: 55px;">ERP</th>
                <th>பெயர்</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="11" style="text-align: center;">மொத்தம்</td>
                <td style="text-align: right;">${totalInsurance > 0 ? totalInsurance.toLocaleString('en-IN') : '0'}</td>
            </tr>
        </tbody>
    </table>

    <div class="signature-block">
        <div class="signature-box">
            <br><br>
            செயலாளர்
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
        `;

        w.document.write(html);
        w.document.close();
    }

    function exportInsuranceExcel(members) {
        if (!members || members.length === 0) {
            alert("பதிவிறக்க உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';

        const dataRows = [
            ["அனுப்புநர்", "", "", "", "", "", "", "", "", "", "பெறுநர்", "", ""],
            ["செயலாளர்\nTU3 தேவாரம் PACCS\nதேவாரம்", "", "", "", "", "", "", "", "", "", "கிளை மேலாளர் அவர்கள்\nமதுரை மாவட்ட மத்திய கூட்டுறவு வங்கி, \nதேவாரம் கிளை", "", ""],
            [],
            [],
            [],
            [],
            [],
            ["காசுகடன் KCC - உறுப்பினர்கள் விபத்துக் காப்பீடு விவரம்"],
            ["வ எண்", "உறுப்பினர்", "", "", "", "தகப்பனார்/ கணவர் பெயர்", "கிராமம்", "குடும்ப அட்டை எண்", "உடலில் உள்ள குறைபாடு", "நாமினியின் பெயர்", "உறவு", "சந்தாத் தொகை"],
            ["", "எண்", "சேமிப்பு எண்", "ERP", "பெயர்", "", "", "", "", "", "", ""]
        ];

        let totalInsurance = 0;
        members.forEach((m, idx) => {
            const masterM = typeof findMember === 'function' ? findMember(m.aclass) : null;

            const sb = m.sb || m.sb_no || (masterM ? getFuzzyValue(masterM, ['sb', 'sb_account', 'சேமிப்பு எண்']) : '') || '';
            const erp = m.erp || m.erp_no || (masterM ? getFuzzyValue(masterM, ['erp', 'erp_no']) : '') || '';
            const name = m.name || (masterM ? getFuzzyValue(masterM, ['name', 'பெயர்']) : '') || '';
            const fatherName = m.father_name || m.husband_name || (masterM ? getFuzzyValue(masterM, ['father', 'father_name', 'husband', 'தகப்பனார்', 'கணவர்']) : '') || '';
            const village = m.village || m.address || (masterM ? getFuzzyValue(masterM, ['village', 'address', 'கிராமம்', 'முகவரி']) : '') || '';
            const ration = m.ration || m.smart_card || (masterM ? getFuzzyValue(masterM, ['ration', 'smart_card', 'குடும்ப அட்டை']) : '') || '';
            const disability = m.disability || (masterM ? getFuzzyValue(masterM, ['disability', 'குறைபாடு']) : '0') || '0';
            const nomineeName = m.nominee_name || (masterM ? getFuzzyValue(masterM, ['nominee', 'nominee_name', 'நாமினி']) : '') || '';
            const nomineeRelation = m.nominee_relation || (masterM ? getFuzzyValue(masterM, ['nominee_relation', 'relation', 'உறவு']) : '') || '';
            const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;

            totalInsurance += insurance;

            dataRows.push([
                idx + 1,
                m.aclass || '',
                sb,
                erp,
                name,
                fatherName,
                village,
                ration,
                disability,
                nomineeName,
                nomineeRelation,
                insurance
            ]);
        });

        // Totals row
        dataRows.push([
            "மொத்தம்",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            totalInsurance
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        ws['!merges'] = [
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
            { s: { r: 1, c: 10 }, e: { r: 1, c: 11 } },
            { s: { r: 7, c: 0 }, e: { r: 7, c: 11 } },
            { s: { r: 8, c: 1 }, e: { r: 8, c: 4 } },
            { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },
            { s: { r: 8, c: 5 }, e: { r: 9, c: 5 } },
            { s: { r: 8, c: 6 }, e: { r: 9, c: 6 } },
            { s: { r: 8, c: 7 }, e: { r: 9, c: 7 } },
            { s: { r: 8, c: 8 }, e: { r: 9, c: 8 } },
            { s: { r: 8, c: 9 }, e: { r: 9, c: 9 } },
            { s: { r: 8, c: 10 }, e: { r: 9, c: 10 } },
            { s: { r: 8, c: 11 }, e: { r: 9, c: 11 } },
            { s: { r: dataRows.length - 1, c: 0 }, e: { r: dataRows.length - 1, c: 10 } }
        ];

        ws['!cols'] = [
            { wch: 8 },  // வ.எண்
            { wch: 12 }, // உறுப்பினர் எண்
            { wch: 14 }, // சேமிப்பு எண்
            { wch: 12 }, // ERP
            { wch: 22 }, // பெயர்
            { wch: 22 }, // தகப்பனார்/கணவர் பெயர்
            { wch: 18 }, // கிராமம்
            { wch: 18 }, // குடும்ப அட்டை எண்
            { wch: 14 }, // குறைபாடு
            { wch: 20 }, // நாமினி பெயர்
            { wch: 14 }, // உறவு
            { wch: 14 }  // சந்தாத் தொகை
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Insurance Summary");
        XLSX.writeFile(wb, `Insurance_${rclNo.replace(/\//g, '-')}.xlsx`);
    }

    /* ==========================================================================
       JABITHA SUMMARY PRINT & EXCEL ENGINE
       ========================================================================== */
    function printJabithaHtml(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const rawDisbDate = safeSelect('disb-history-date-input')?.value || '';
        const displayDisbDate = rawDisbDate ? formatDateDDMMYYYY(rawDisbDate) : '____________________';

        // Open print window
        const w = window.open('', '_blank');
        if (!w) {
            alert("Popup blocker தடுத்துள்ளது! தயவுசெய்து Popups அனுமதித்து மீண்டும் முயற்சிக்கவும்.");
            return;
        }

        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalAmount = 0;

        let rowsHtml = "";

        members.forEach((m, idx) => {
            const masterM = typeof findMember === 'function' ? findMember(m.aclass) : null;

            const sb = m.sb || m.sb_no || (masterM ? getFuzzyValue(masterM, ['sb', 'sb_account', 'சேமிப்பு எண்']) : '') || '';
            const erp = m.erp || m.erp_no || (masterM ? getFuzzyValue(masterM, ['erp', 'erp_no']) : '') || '';
            const name = m.name || (masterM ? getFuzzyValue(masterM, ['name', 'பெயர்']) : '') || '';
            const surveyNo = m.survey_no || m.survey || (masterM ? getFuzzyValue(masterM, ['survey', 'survey_no', 'சர்வே']) : '') || '';
            const area = parseFloat(String(m.area || '0')) || 0;
            const crop = m.crop || (masterM ? getFuzzyValue(masterM, ['crop', 'பயிர்']) : '') || '';

            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const amount = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalAmount += amount;

            rowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: center; font-weight: bold;">${m.aclass || ''}</td>
                    <td style="text-align: center;">${sb}</td>
                    <td style="text-align: center;">${erp}</td>
                    <td style="text-align: left; font-weight: bold;">${name}</td>
                    <td style="text-align: center;">${surveyNo}</td>
                    <td style="text-align: center;">${area.toFixed(2)}</td>
                    <td style="text-align: left;">${crop}</td>
                    <td style="text-align: right;">${seed > 0 ? seed.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${fert > 0 ? fert.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${compost > 0 ? compost.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${pest > 0 ? pest.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${cash > 0 ? cash.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right; font-weight: bold;">${amount.toLocaleString('en-IN')}</td>
                    <td style="text-align: center; width: 150px;"></td>
                </tr>
            `;
        });

        const html = `
<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <title>ஜாபிதா விபரம் - T.U.3 தேவாரம்</title>
    <style>
        @page {
            size: legal landscape;
            margin: 8mm;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 9.5pt;
            color: #000;
            margin: 0;
            padding: 5px;
        }
        .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
        }
        .header h2 {
            margin: 0 0 3px 0;
            font-size: 15pt;
        }
        .header h3 {
            margin: 0;
            font-size: 13pt;
        }
        .meta-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-weight: bold;
            font-size: 10pt;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        th, td {
            border: 1px solid #000;
            padding: 4px 5px;
            font-size: 9pt;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
        }
        .signature-block {
            display: flex;
            justify-content: space-between;
            margin-top: 35px;
            padding: 0 20px;
            font-weight: bold;
            font-size: 10pt;
        }
        .signature-box {
            text-align: center;
            width: 200px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்.</h2>
        <h3>பயிர்க்கடன் பட்டுவாடா - ஜாபிதா விபரம்</h3>
    </div>

    <div class="meta-line">
        <div>மத்திய வங்கி RCL எண்: ${rclNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate) || '-'}</div>
        <div>பட்டுவாடா தேதி: ${displayDisbDate}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 35px;">வ.எண்</th>
                <th style="width: 55px;">அ.எண்</th>
                <th style="width: 65px;">SB</th>
                <th style="width: 55px;">ERP</th>
                <th>பெயர்</th>
                <th style="width: 65px;">சர்வே எண்</th>
                <th style="width: 55px;">பரப்பு.செ</th>
                <th style="width: 70px;">பயிர்</th>
                <th style="width: 65px;">விதை பகுதி</th>
                <th style="width: 75px;">இரசாயன உரம் 50%</th>
                <th style="width: 70px;">தொழுஉரம் 50%</th>
                <th style="width: 70px;">பூச்சி மருந்து</th>
                <th style="width: 70px;">ரொக்கம்</th>
                <th style="width: 80px;">மொத்தம்</th>
                <th style="width: 150px;">கையொப்பம்</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="6" style="text-align: center;">மொத்தம்</td>
                <td style="text-align: center;">${totalArea.toFixed(2)}</td>
                <td></td>
                <td style="text-align: right;">${totalSeed > 0 ? totalSeed.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalFert > 0 ? totalFert.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCompost > 0 ? totalCompost.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalPest > 0 ? totalPest.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCash > 0 ? totalCash.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalAmount.toLocaleString('en-IN')}</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    <div class="signature-block">
        <div class="signature-box">
            <br><br>
            செயலாளர்
        </div>
        <div class="signature-box">
            <br><br>
            செயலாட்சியர்
        </div>
        <div class="signature-box">
            <br><br>
            சரக மேற்பார்வையாளர்
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
        `;

        w.document.write(html);
        w.document.close();
    }

    function exportJabithaExcel(members) {
        if (!members || members.length === 0) {
            alert("பதிவிறக்க உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const disbDate = safeSelect('disb-history-date-input')?.value || safeSelect('disb-kcc-rcl-date')?.value || '';

        const dataRows = [
            ["T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்."],
            [`ஜாபிதா விபரம்`, ``, ``, ``, `மத்திய வங்கி RCL எண்: ${rclNo}  தேதி: ${formatDateDDMMYYYY(rclDate)}`, ``, ``, ``, ``, ``, ``, ``, `பட்டுவாடா தேதி : ${formatDateDDMMYYYY(disbDate)}`],
            ["வ.எண்", "அ.எண்", "SB", "ERP", "பெயர்", "சர்வே எண்", "பரப்பு.செ", "பயிர்", "விதை பகுதி", "இரசாயன உரம் 50%", "தொழுஉரம் 50%", "பூச்சி மருந்து", "ரொக்கம்", "மொத்தம்", "கையொப்பம்"]
        ];

        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalAmount = 0;

        members.forEach((m, idx) => {
            const masterM = typeof findMember === 'function' ? findMember(m.aclass) : null;

            const sb = m.sb || m.sb_no || (masterM ? getFuzzyValue(masterM, ['sb', 'sb_account', 'சேமிப்பு எண்']) : '') || '';
            const erp = m.erp || m.erp_no || (masterM ? getFuzzyValue(masterM, ['erp', 'erp_no']) : '') || '';
            const name = m.name || (masterM ? getFuzzyValue(masterM, ['name', 'பெயர்']) : '') || '';
            const surveyNo = m.survey_no || m.survey || (masterM ? getFuzzyValue(masterM, ['survey', 'survey_no', 'சர்வே']) : '') || '';
            const area = parseFloat(String(m.area || '0')) || 0;
            const crop = m.crop || (masterM ? getFuzzyValue(masterM, ['crop', 'பயிர்']) : '') || '';

            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const amount = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalAmount += amount;

            dataRows.push([
                idx + 1,
                m.aclass || '',
                sb,
                erp,
                name,
                surveyNo,
                area,
                crop,
                seed,
                fert,
                compost,
                pest,
                cash,
                amount,
                ""
            ]);
        });

        // Totals row
        dataRows.push([
            "மொத்தம்",
            "",
            "",
            "",
            "",
            "",
            totalArea,
            "",
            totalSeed,
            totalFert,
            totalCompost,
            totalPest,
            totalCash,
            totalAmount,
            ""
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
            { s: { r: dataRows.length - 1, c: 0 }, e: { r: dataRows.length - 1, c: 5 } }
        ];

        ws['!cols'] = [
            { wch: 8 },  // வ.எண்
            { wch: 12 }, // அ.எண்
            { wch: 14 }, // SB
            { wch: 12 }, // ERP
            { wch: 22 }, // பெயர்
            { wch: 14 }, // சர்வே எண்
            { wch: 12 }, // பரப்பு.செ
            { wch: 16 }, // பயிர்
            { wch: 14 }, // விதை பகுதி
            { wch: 16 }, // இரசாயன உரம் 50%
            { wch: 14 }, // தொழுஉரம் 50%
            { wch: 14 }, // பூச்சி மருந்து
            { wch: 14 }, // ரொக்கம்
            { wch: 16 }, // மொத்தம்
            { wch: 25 }  // கையொப்பம்
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Jabitha Summary");
        XLSX.writeFile(wb, `Jabitha_${rclNo.replace(/\//g, '-')}.xlsx`);
    }

    /* ==========================================================================
       SIGN PAGE SUMMARY PRINT & EXCEL ENGINE
       ========================================================================== */
    function printSignPageHtml(members) {
        if (!members || members.length === 0) {
            alert("பட்டியலில் உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';
        const rawDisbDate = safeSelect('disb-history-date-input')?.value || '';
        const displayDisbDate = rawDisbDate ? formatDateDDMMYYYY(rawDisbDate) : '____________________';

        // Open print window
        const w = window.open('', '_blank');
        if (!w) {
            alert("Popup blocker தடுத்துள்ளது! தயவுசெய்து Popups அனுமதித்து மீண்டும் முயற்சிக்கவும்.");
            return;
        }

        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalCurrentLoan = 0;
        let totalBookFee = 0;
        let totalInsurance = 0;
        let totalShare = 0;
        let totalDeductions = 0;
        let totalNetDisb = 0;

        let rowsHtml = "";

        members.forEach((m, idx) => {
            const masterM = typeof findMember === 'function' ? findMember(m.aclass) : null;

            const sb = m.sb || m.sb_no || (masterM ? getFuzzyValue(masterM, ['sb', 'sb_account', 'சேமிப்பு எண்']) : '') || '';
            const erp = m.erp || m.erp_no || (masterM ? getFuzzyValue(masterM, ['erp', 'erp_no']) : '') || '';
            const name = m.name || (masterM ? getFuzzyValue(masterM, ['name', 'பெயர்']) : '') || '';
            const surveyNo = m.survey_no || m.survey || (masterM ? getFuzzyValue(masterM, ['survey', 'survey_no', 'சர்வே']) : '') || '';
            const area = parseFloat(String(m.area || '0')) || 0;
            const crop = m.crop || (masterM ? getFuzzyValue(masterM, ['crop', 'பயிர்']) : '') || '';

            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            const bookFee = parseFloat(String(m.book_fee || '0').replace(/,/g, '')) || 0;
            const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;
            const share = parseFloat(String(m.share_amount || '0').replace(/,/g, '')) || 0;
            
            const totDed = fert + bookFee + insurance + share;
            const netDisb = totalLoan - totDed;

            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalCurrentLoan += totalLoan;

            totalBookFee += bookFee;
            totalInsurance += insurance;
            totalShare += share;
            totalDeductions += totDed;
            totalNetDisb += netDisb;

            rowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: center; font-weight: bold;">${m.aclass || ''}</td>
                    <td style="text-align: center;">${sb}</td>
                    <td style="text-align: center;">${erp}</td>
                    <td style="text-align: left; font-weight: bold;">${name}</td>
                    <td style="text-align: center;">${surveyNo}</td>
                    <td style="text-align: center;">${area.toFixed(2)}</td>
                    <td style="text-align: left;">${crop}</td>
                    <td style="text-align: right;">${seed > 0 ? seed.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${fert > 0 ? fert.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${compost > 0 ? compost.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${pest > 0 ? pest.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${cash > 0 ? cash.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right; font-weight: bold;">${totalLoan.toLocaleString('en-IN')}</td>
                    <td style="text-align: right;">${bookFee > 0 ? bookFee.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${insurance > 0 ? insurance.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right;">${share > 0 ? share.toLocaleString('en-IN') : '0'}</td>
                    <td style="text-align: right; font-weight: bold;">${totDed.toLocaleString('en-IN')}</td>
                    <td style="text-align: right; font-weight: bold;">${netDisb.toLocaleString('en-IN')}</td>
                    <td style="text-align: center; width: 150px;"></td>
                </tr>
            `;
        });

        const html = `
<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <title>கையெழுத்துப் படிவம் - T.U.3 தேவாரம்</title>
    <style>
        @page {
            size: legal landscape;
            margin: 6mm;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 8.5pt;
            color: #000;
            margin: 0;
            padding: 4px;
        }
        .header {
            text-align: center;
            margin-bottom: 6px;
            border-bottom: 2px solid #000;
            padding-bottom: 3px;
        }
        .header h2 {
            margin: 0 0 2px 0;
            font-size: 14pt;
        }
        .header h3 {
            margin: 0;
            font-size: 12pt;
        }
        .meta-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-weight: bold;
            font-size: 9pt;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        th, td {
            border: 1px solid #000;
            padding: 3px 4px;
            font-size: 8.5pt;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
        }
        .signature-block {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding: 0 20px;
            font-weight: bold;
            font-size: 9.5pt;
        }
        .signature-box {
            text-align: center;
            width: 180px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்.</h2>
        <h3>பயிர்க்கடன் பட்டுவாடா விபரம் (கையெழுத்துப் படிவம்)</h3>
    </div>

    <div class="meta-line">
        <div>மத்திய வங்கி RCL எண்: ${rclNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(rclDate) || '-'}</div>
        <div>தீர்மானம் எண்: ${resNo || '-'} &nbsp;&nbsp;&nbsp;&nbsp; தேதி: ${formatDateDDMMYYYY(resDate) || '-'}</div>
        <div>பட்டுவாடா நபர்கள்: ${members.length}</div>
        <div>பட்டுவாடா தேதி: ${displayDisbDate}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25px;">வ.எண்</th>
                <th style="width: 45px;">அ.எண்</th>
                <th style="width: 50px;">SB</th>
                <th style="width: 45px;">ERP</th>
                <th>பெயர்</th>
                <th style="width: 50px;">சர்வே எண்</th>
                <th style="width: 40px;">பரப்பு</th>
                <th style="width: 55px;">பயிர்</th>
                <th style="width: 50px;">விதை பகுதி</th>
                <th style="width: 55px;">இரசாயன உரம்</th>
                <th style="width: 50px;">தொழு உரம்</th>
                <th style="width: 50px;">பூச்சி மருந்து</th>
                <th style="width: 55px;">ரொக்கம்</th>
                <th style="width: 60px;">மொத்தம்</th>
                <th style="width: 45px;">புத்தக பாரம்</th>
                <th style="width: 45px;">காப்பீடு</th>
                <th style="width: 45px;">பங்கு தொகை</th>
                <th style="width: 60px;">மொத்த பிடித்தம்</th>
                <th style="width: 65px;">நிகர பட்டுவாடா</th>
                <th style="width: 150px;">கையொப்பம்</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="6" style="text-align: center;">மொத்தம்</td>
                <td style="text-align: center;">${totalArea.toFixed(2)}</td>
                <td></td>
                <td style="text-align: right;">${totalSeed > 0 ? totalSeed.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalFert > 0 ? totalFert.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCompost > 0 ? totalCompost.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalPest > 0 ? totalPest.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCash > 0 ? totalCash.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalCurrentLoan.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">${totalBookFee > 0 ? totalBookFee.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalInsurance > 0 ? totalInsurance.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalShare > 0 ? totalShare.toLocaleString('en-IN') : '0'}</td>
                <td style="text-align: right;">${totalDeductions.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">${totalNetDisb.toLocaleString('en-IN')}</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    <div class="signature-block">
        <div class="signature-box">
            <br><br>
            செயலாளர்
        </div>
        <div class="signature-box">
            <br><br>
            செயலாட்சியர்
        </div>
        <div class="signature-box">
            <br><br>
            சரக மேற்பார்வையாளர்
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
        `;

        w.document.write(html);
        w.document.close();
    }

    function exportSignPageExcel(members) {
        if (!members || members.length === 0) {
            alert("பதிவிறக்க உறுப்பினர்கள் யாரும் இல்லை!");
            return;
        }

        const rclNo = safeSelect('disb-kcc-rcl-no')?.value.trim() || '';
        const rclDate = safeSelect('disb-kcc-rcl-date')?.value || '';
        const resNo = safeSelect('disb-kcc-res-no')?.value.trim() || '';
        const resDate = safeSelect('disb-kcc-res-date')?.value || '';
        const rawDisbDate = safeSelect('disb-history-date-input')?.value || '';
        const displayDisbDate = rawDisbDate ? formatDateDDMMYYYY(rawDisbDate) : '';

        const dataRows = [
            ["T.U.3 தேவாரம் தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம், தேவாரம்."],
            ["", "", "", "", "", "தீர்மானம் எண்", "", resNo, "", "", "", "", "", "", "தீர்மானம் தேதி", "", formatDateDDMMYYYY(resDate)],
            [`மத்திய வங்கி RCL எண்: ${rclNo}  தேதி: ${formatDateDDMMYYYY(rclDate)}`, "", "", "", "", "", "", "", "", "", `பட்டுவாடா நபர்கள்: ${members.length}`, "", "", "", "", "", `பட்டுவாடா தேதி : ${displayDisbDate}`],
            [],
            ["வ.எண்", "அ.எண்", "SB", "ERP", "பெயர்", "சர்வே எண்", "பரப்பு", "பயிர்", "விதை பகுதி", "இரசாயன உரம்", "தொழு உரம்", "பூச்சி மருந்து", "ரொக்கம்", "மொத்தம்", "புத்தக பாரம்", "காப்பீடு", "பங்கு தொகை", "மொத்த பிடித்தம்", "நிகர பட்டுவாடா", "கையொப்பம்"]
        ];

        let totalArea = 0;
        let totalSeed = 0;
        let totalFert = 0;
        let totalCompost = 0;
        let totalPest = 0;
        let totalCash = 0;
        let totalCurrentLoan = 0;
        let totalBookFee = 0;
        let totalInsurance = 0;
        let totalShare = 0;
        let totalDeductions = 0;
        let totalNetDisb = 0;

        members.forEach((m, idx) => {
            const masterM = typeof findMember === 'function' ? findMember(m.aclass) : null;

            const sb = m.sb || m.sb_no || (masterM ? getFuzzyValue(masterM, ['sb', 'sb_account', 'சேமிப்பு எண்']) : '') || '';
            const erp = m.erp || m.erp_no || (masterM ? getFuzzyValue(masterM, ['erp', 'erp_no']) : '') || '';
            const name = m.name || (masterM ? getFuzzyValue(masterM, ['name', 'பெயர்']) : '') || '';
            const surveyNo = m.survey_no || m.survey || (masterM ? getFuzzyValue(masterM, ['survey', 'survey_no', 'சர்வே']) : '') || '';
            const area = parseFloat(String(m.area || '0')) || 0;
            const crop = m.crop || (masterM ? getFuzzyValue(masterM, ['crop', 'பயிர்']) : '') || '';

            const seed = parseFloat(String(m.seed || '0').replace(/,/g, '')) || 0;
            const fert = parseFloat(String(m.fertilizer || '0').replace(/,/g, '')) || 0;
            const compost = parseFloat(String(m.compost || '0').replace(/,/g, '')) || 0;
            const pest = parseFloat(String(m.pesticide || '0').replace(/,/g, '')) || 0;
            const cash = parseFloat(String(m.cash || '0').replace(/,/g, '')) || 0;
            const totalLoan = parseFloat(String(m.amount || '0').replace(/,/g, '')) || 0;

            const bookFee = parseFloat(String(m.book_fee || '0').replace(/,/g, '')) || 0;
            const insurance = parseFloat(String(m.insurance || '0').replace(/,/g, '')) || 0;
            const share = parseFloat(String(m.share_amount || '0').replace(/,/g, '')) || 0;

            const totDed = fert + bookFee + insurance + share;
            const netDisb = totalLoan - totDed;

            totalArea += area;
            totalSeed += seed;
            totalFert += fert;
            totalCompost += compost;
            totalPest += pest;
            totalCash += cash;
            totalCurrentLoan += totalLoan;

            totalBookFee += bookFee;
            totalInsurance += insurance;
            totalShare += share;
            totalDeductions += totDed;
            totalNetDisb += netDisb;

            dataRows.push([
                idx + 1,
                m.aclass || '',
                sb,
                erp,
                name,
                surveyNo,
                area,
                crop,
                seed,
                fert,
                compost,
                pest,
                cash,
                totalLoan,
                bookFee,
                insurance,
                share,
                totDed,
                netDisb,
                ""
            ]);
        });

        // Totals row
        dataRows.push([
            "மொத்தம்",
            "",
            "",
            "",
            "",
            "",
            totalArea,
            "",
            totalSeed,
            totalFert,
            totalCompost,
            totalPest,
            totalCash,
            totalCurrentLoan,
            totalBookFee,
            totalInsurance,
            totalShare,
            totalDeductions,
            totalNetDisb,
            ""
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
            { s: { r: dataRows.length - 1, c: 0 }, e: { r: dataRows.length - 1, c: 5 } }
        ];

        ws['!cols'] = [
            { wch: 8 },  // வ.எண்
            { wch: 12 }, // அ.எண்
            { wch: 14 }, // SB
            { wch: 12 }, // ERP
            { wch: 22 }, // பெயர்
            { wch: 14 }, // சர்வே எண்
            { wch: 12 }, // பரப்பு
            { wch: 16 }, // பயிர்
            { wch: 14 }, // விதை பகுதி
            { wch: 16 }, // இரசாயன உரம்
            { wch: 14 }, // தொழு உரம்
            { wch: 14 }, // பூச்சி மருந்து
            { wch: 14 }, // ரொக்கம்
            { wch: 16 }, // மொத்தம்
            { wch: 14 }, // புத்தக பாரம்
            { wch: 14 }, // காப்பீடு
            { wch: 14 }, // பங்கு தொகை
            { wch: 16 }, // மொத்த பிடித்தம்
            { wch: 16 }, // நிகர பட்டுவாடா
            { wch: 25 }  // கையொப்பம்
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Sign Page Summary");
        XLSX.writeFile(wb, `Sign_Page_${rclNo.replace(/\//g, '-')}.xlsx`);
    }

    // Initialization on page load
    document.addEventListener('DOMContentLoaded', () => {
        initKccDisbursement();
        initDisbursementHistory();
        initAhDisbursement();
    });
})();