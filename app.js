/* ==========================================================================
   PACS Loan Dashboard & Interest Calculator - Logic Script
   ========================================================================== */

// Translation Dictionary (Tamil and English)
const translations = {
    ta: {
        page_title: "PACS கடன் மேலாண்மை மற்றும் வட்டி கணக்கீடு",
        pacs_name: "PACS கூட்டுறவு சங்கம்",
        pacs_subtitle: "கடன் மேலாண்மைத் தளம்",
        nav_home: "முகப்பு",
        home_title: "முகப்பு (Home)",
        home_subtitle: "PACS கூட்டுறவு சங்கம் வட்டி மேலாண்மை மற்றும் கணக்கீட்டுப் பகுதி",
        home_desc: "கூட்டுறவு வங்கி கடன் மேலாண்மை மற்றும் நிகழ்நேர வட்டி கணக்கீட்டு மென்பொருள்.",
        nav_interest: "வட்டி கணக்கீடு",
        sub_crop: "பயிர்க்கடன் வட்டி",
        sub_jewel: "நகைக்கடன் வட்டி",
        sub_shg: "SHG வட்டி முறை",
        nav_members: "கடன் உறுப்பினர்கள்",
        members_title: "கடன் உறுப்பினர்கள்",
        members_subtitle: "PACS கூட்டுறவு சங்கத்தின் கடன் பெற்ற உறுப்பினர்களின் விவரங்கள்",
        members_list_header: "உறுப்பினர்கள் பட்டியல்",
        th_member_id: "உறுப்பினர் ID",
        th_member_name: "உறுப்பினர் பெயர்",
        th_loan_type: "கடன் வகை",
        th_approved_amt: "ஒப்புதல் தொகை",
        th_outstanding: "நிலுவைத் தொகை",
        th_status: "நிலை (Status)",
        th_erp_no: "SB ERP No",
        th_actions: "செயல்கள் (Actions)",
        config_header: "கூகுள் சீட் மாஸ்டர் டேட்டா இணைப்பு (Live Sync)",
        search_header: "உறுப்பினர் கணக்குத் தேடல் (Search Member Account)",
        label_search_input: "A Class / SB / ERP எண் / பெயர் உள்ளிடவும்",
        btn_search: "தேடுக (Search)",
        btn_clear: "இரத்து செய்க",
        search_results_header: "தேடல் முடிவுகள் (Search Results)",
        label_sheet_url: "கூகுள் ஆப்ஸ் ஸ்கிரிப்ட் வெப் ஆப் URL (Google Apps Script Web App URL)",
        btn_connect: "இணைக்கவும் (Connect)",
        btn_disconnect: "துண்டிக்கவும் (Disconnect)",
        status_not_connected: "இணைக்கப்படவில்லை (உள்ளூர் மாக்கப் தரவு காட்டப்படுகிறது)",
        edit_modal_title: "உறுப்பினர் விபரங்கள் திருத்தம்",
        btn_save: "அப்டேட் செய்க (Update)",
        btn_cancel: "இரத்து செய்க",
        status_active: "நடைமுறையில்",
        status_settled: "முடிவுற்றது",
        nav_apps: "விண்ணப்பப் படிவம்",
        nav_print_controller: "விண்ணப்ப அச்சு",
        nav_disburse: "பட்டுவாடா தயார் செய்தல்",
        nav_sheet_sync: "கூகுள் சீட் இணைப்பு",
        theme_light: "பகல் மோட்",
        theme_dark: "இரவு மோட்",
        admin_role: "கடன் அதிகாரி",
        crop_title: "பயிர்க்கடன் வட்டி கணக்கீடு",
        crop_subtitle: "அசல் மற்றும் அபராத வட்டி விகிதங்களைக் கொண்டு நிகழ்நேர கணக்கீடு",
        input_header: "கடன் விவரங்கள் உள்ளீடு",
        label_principal: "அசல் தொகை (₹)",
        label_start_date: "ஆரம்ப தேதி",
        label_end_date: "முடிவு தேதி",
        label_interest_rate: "வட்டி விகிதம் (%)",
        label_penal_rate: "அபராத வட்டி விகிதம் (%)",
        advanced_title: "மேம்பட்ட அமைப்புகள் (தவணை காலம்)",
        label_normal_period: "சாதாரண தவணை காலம் (நாட்கள்)",
        card_total_days: "மொத்த நாட்கள்",
        card_penal_days: "அபராத நாட்கள்",
        results_header: "கணக்கீட்டு விவரங்கள்",
        row_normal_interest: "சாதாரண வட்டி:",
        row_penal_interest: "அபராத வட்டி:",
        row_total_interest: "மொத்த வட்டி தொகை:",
        row_total_payable: "மொத்த தொகை (அசல் + வட்டி):",
        chart_interest_ratio: "வட்டி விகிதாச்சாரம்",
        legend_principal: "அசல்",
        legend_normal_int: "வட்டி",
        legend_penal_int: "அபராதம்",
        formula_header: "கணக்கீட்டு முறை விளக்கம் (Formula Breakdown)",
        formula_step1_title: "நாட்கள் கணக்கீடு:",
        formula_step2_title: "சாதாரண வட்டி கணக்கீடு:",
        formula_step3_title: "அபராத வட்டி கணக்கீடு:",
        formula_total_title: "மொத்த தொகை கணக்கீடு:",
        apps_title: "கடனுக்கான விண்ணப்பங்கள்",
        apps_subtitle: "PACS உறுப்பினர்களின் புதிய மற்றும் நிலுவையில் உள்ள கடன் கோரிக்கைகள்",
        apps_placeholder_title: "விண்ணப்ப மேலாண்மைத் தளம்",
        apps_placeholder_desc: "இந்த தொகுதி எதிர்கால மேம்பாட்டிற்காக ஒதுக்கப்பட்டுள்ளது. இங்கு புதிய கடன் விண்ணப்பங்களை பதிவேற்றுதல் மற்றும் சரிபார்த்தல் பணிகள் செயல்படுத்தப்படும்.",
        disburse_title: "பட்டுவாடா தயார் செய்தல்",
        disburse_subtitle: "ஒப்புதல் அளிக்கப்பட்ட கடன்களுக்கான பட்டுவாடா திட்டங்கள்",
        disburse_placeholder_title: "பட்டுவாடா மேலாண்மைத் தளம்",
        disburse_placeholder_desc: "இந்த தொகுதி எதிர்கால மேம்பாட்டிற்காக ஒதுக்கப்பட்டுள்ளது. இங்கு விவசாயிகளின் வங்கி கணக்குகளுக்கு கடன் தொகைகளை நேரடியாக பட்டுவாடா செய்யும் அமைப்புகள் உருவாக்கப்படும்.",
        jl_title: "நகைக்கடன் வட்டி கணக்கீடு",
        jl_subtitle: "நகைக்கடன் மற்றும் புதுப்பித்தல் விவரங்களைக் கொண்டு நிகழ்நேர கணக்கீடு",
        label_jl_new_loan: "புதிய கடன் அசல் (₹)",
        label_jl_app_fees: "நகை மதிப்பினர் கூலி (₹)",
        row_jl_app_fees: "நகை மதிப்பினர் கூலி:",
        label_jl_if_paying: "தற்போது செலுத்தும் தொகை (₹)",
        row_jl_if_paying: "தற்போது செலுத்தும் தொகை:",
        jl_renewal_header: "கடன் புதுப்பித்தல் விவரங்கள்",
        row_jl_old_principal: "பழைய கடன் அசல்:",
        row_jl_old_total: "பழைய கடன் மொத்தம் (அசல் + வட்டி):",
        row_jl_net_cash: "நிகர பணப் பரிவர்த்தனை:",
        status_get_amount: "பெற வேண்டியது",
        status_give: "கொடுபட வேண்டியது",
        shg_title: "SHG வட்டி கணக்கீடு",
        shg_subtitle: "சுயஉதவிக் குழு கடன்களுக்கான வட்டி மற்றும் அசல் கழிவு கணக்கீடு",
        shg_payment_header: "திருப்பிச் செலுத்துதல் விவரங்கள்",
        label_shg_amount_paying: "தற்போது செலுத்தும் தொகை (₹)",
        row_shg_interest_adjusted: "வட்டிக்காக கழிக்கப்பட்டது:",
        row_shg_principal_adjusted: "அசலில் கழிக்கப்பட்டது:",
        row_shg_rem_principal: "மீதி அசல்:",
        row_shg_rem_interest: "மீதி வட்டி:",
        row_shg_rem_total: "செலுத்த வேண்டிய மீதி மொத்தம்:",
        status_shg_outstanding: "நிலுவை உள்ளது",
        status_shg_settled: "கடன் முடிந்தது"
    },
    en: {
        page_title: "PACS Loan Management & Interest Calculator",
        pacs_name: "PACS Cooperative Society",
        pacs_subtitle: "Loan Management Portal",
        nav_home: "Home",
        home_title: "Home",
        home_subtitle: "PACS Cooperative Society Loan & Interest Portal",
        home_desc: "Cooperative banking loan management and real-time interest calculation software.",
        nav_interest: "Interest Calculation",
        sub_crop: "Crop Loan Interest",
        sub_jewel: "Jewel Loan Interest",
        sub_shg: "SHG Interest Mode",
        nav_members: "Loan Members",
        members_title: "Loan Members",
        members_subtitle: "Details of PACS Cooperative Society Loan Members",
        members_list_header: "Members List",
        th_member_id: "Member ID",
        th_member_name: "Member Name",
        th_loan_type: "Loan Type",
        th_approved_amt: "Approved Amount",
        th_outstanding: "Outstanding Balance",
        th_status: "Status",
        th_erp_no: "SB ERP No",
        th_actions: "Actions",
        config_header: "Google Sheets Master Data Connection (Live Sync)",
        search_header: "Search Member Account",
        label_search_input: "Enter A Class / SB / ERP No / Name",
        btn_search: "Search",
        btn_clear: "Clear",
        search_results_header: "Search Results",
        label_sheet_url: "Google Apps Script Web App URL",
        btn_connect: "Connect",
        btn_disconnect: "Disconnect",
        status_not_connected: "Not connected (Local mock data displayed)",
        edit_modal_title: "Edit Member Details",
        btn_save: "Update",
        btn_cancel: "Cancel",
        status_active: "Active",
        status_settled: "Settled",
        nav_apps: "Application Form",
        nav_print_controller: "Print Application",
        nav_disburse: "Disbursement Prep",
        nav_sheet_sync: "Google Sheet Sync",
        theme_light: "Light Mode",
        theme_dark: "Dark Mode",
        admin_role: "Loan Officer",
        crop_title: "Crop Loan Interest Calculator",
        crop_subtitle: "Real-time calculation based on principal and penal interest rates",
        input_header: "Loan Details Input",
        label_principal: "Principal Amount (₹)",
        label_start_date: "Start Date",
        label_end_date: "End Date",
        label_interest_rate: "Interest Rate (%)",
        label_penal_rate: "Penal Interest Rate (%)",
        advanced_title: "Advanced Settings (Loan Duration)",
        label_normal_period: "Normal Loan Period (Days)",
        card_total_days: "Total Days",
        card_penal_days: "Penal Days",
        results_header: "Calculation Details",
        row_normal_interest: "Normal Interest:",
        row_penal_interest: "Penal Interest:",
        row_total_interest: "Total Interest Amount:",
        row_total_payable: "Total Amount (Principal + Interest):",
        chart_interest_ratio: "Interest Ratio",
        legend_principal: "Principal",
        legend_normal_int: "Normal Interest",
        legend_penal_int: "Penal Interest",
        formula_header: "Interest Calculation Formula Breakdown",
        formula_step1_title: "Days Calculation:",
        formula_step2_title: "Normal Interest Calculation:",
        formula_step3_title: "Penal Interest Calculation:",
        formula_total_title: "Total Amount Calculation:",
        apps_title: "Loan Applications",
        apps_subtitle: "New and pending loan requests from PACS members",
        apps_placeholder_title: "Application Management System",
        apps_placeholder_desc: "This module is reserved for future development. Processing, uploading, and verification of new loan applications will be implemented here.",
        disburse_title: "Disbursement Preparation",
        disburse_subtitle: "Disbursement schedules for approved cooperative loans",
        disburse_placeholder_title: "Disbursement Management System",
        disburse_placeholder_desc: "This module is reserved for future development. Direct integration with banking systems for electronic fund transfers to farmers' accounts will be built here.",
        jl_title: "Jewel Loan Interest Calculator",
        jl_subtitle: "Real-time calculation based on jewel loan and renewal details",
        label_jl_new_loan: "New Loan Principal (₹)",
        label_jl_app_fees: "Jewel Appraiser Fees (₹)",
        row_jl_app_fees: "Jewel Appraiser Fees:",
        label_jl_if_paying: "Amount Paying Now (₹)",
        row_jl_if_paying: "Amount Paying Now:",
        jl_renewal_header: "Loan Renewal Details",
        row_jl_old_principal: "Old Loan Principal:",
        row_jl_old_total: "Old Loan Total (Principal + Interest):",
        row_jl_net_cash: "Net Cash Settlement:",
        status_get_amount: "Get Cash from Customer",
        status_give: "Give Cash to Customer",
        shg_title: "SHG Interest Calculator",
        shg_subtitle: "Real-time interest and principal deduction for Self-Help Group loans",
        shg_payment_header: "Loan Repayment Details",
        label_shg_amount_paying: "Amount Paying Now (₹)",
        row_shg_interest_adjusted: "Interest Adjusted:",
        row_shg_principal_adjusted: "Principal Adjusted:",
        row_shg_rem_principal: "Remaining Principal:",
        row_shg_rem_interest: "Remaining Interest:",
        row_shg_rem_total: "Total Remaining Outstanding:",
        status_shg_outstanding: "Outstanding Balance",
        status_shg_settled: "Fully Paid / Settled"
    }
};

// Global App State
let currentLang = 'ta'; // Default is Tamil
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const todayStr = `${year}-${month}-${day}`;

// DOM elements mapping
const elements = {
    // Navigation / Routing
    sidebarLinks: document.querySelectorAll('.nav-link, .submenu-link'),
    pages: document.querySelectorAll('.content-page'),
    
    // Controls
    themeToggle: document.getElementById('theme-toggle'),
    themeText: document.getElementById('theme-text'),
    sunIcon: document.querySelector('.sun-icon'),
    moonIcon: document.querySelector('.moon-icon'),
    langToggle: document.getElementById('lang-toggle'),
    langLabel: document.getElementById('lang-label'),
    headerToday: document.getElementById('header-today-date'),
    
    // Calculator inputs
    inputPrincipal: document.getElementById('input-principal'),
    inputStartDate: document.getElementById('input-start-date'),
    inputEndDate: document.getElementById('input-end-date'),
    inputInterestRate: document.getElementById('input-interest-rate'),
    inputPenalRate: document.getElementById('input-penal-rate'),
    inputNormalPeriod: document.getElementById('input-normal-period'),
    
    // Calculator outputs
    valTotalDays: document.getElementById('val-total-days'),
    valPenalDays: document.getElementById('val-penal-days'),
    valNormalInterest: document.getElementById('val-normal-interest'),
    valPenalInterest: document.getElementById('val-penal-interest'),
    valTotalInterest: document.getElementById('val-total-interest'),
    valTotalPayable: document.getElementById('val-total-payable'),

    // Jewel Loan Inputs
    inputJlPrincipal: document.getElementById('input-jl-principal'),
    inputJlStartDate: document.getElementById('input-jl-start-date'),
    inputJlEndDate: document.getElementById('input-jl-end-date'),
    inputJlInterestRate: document.getElementById('input-jl-interest-rate'),
    inputJlPenalRate: document.getElementById('input-jl-penal-rate'),
    inputJlNewLoan: document.getElementById('input-jl-new-loan'),
    inputJlAppFees: document.getElementById('input-jl-app-fees'),
    inputJlIfPaying: document.getElementById('input-jl-if-paying'),
    inputJlNormalPeriod: document.getElementById('input-jl-normal-period'),

    // Jewel Loan Outputs
    valJlTotalDays: document.getElementById('val-jl-total-days'),
    valJlPenalDays: document.getElementById('val-jl-penal-days'),
    valJlOldPrincipal: document.getElementById('val-jl-old-principal'),
    valJlNormalInterest: document.getElementById('val-jl-normal-interest'),
    valJlPenalInterest: document.getElementById('val-jl-penal-interest'),
    valJlOldTotal: document.getElementById('val-jl-old-total'),
    valJlAppFeesDisplay: document.getElementById('val-jl-app-fees-display'),
    valJlIfPayingDisplay: document.getElementById('val-jl-if-paying-display'),
    valJlAdjustedTotal: document.getElementById('val-jl-adjusted-total'),
    valJlNetCash: document.getElementById('val-jl-net-cash'),
    lblJlNetStatus: document.getElementById('lbl-jl-net-status'),
    boxJlNetSettlement: document.getElementById('box-jl-net-settlement'),
    jlHeaderToday: document.getElementById('jl-header-today-date'),

    // SHG Loan Inputs
    inputShgPrincipal: document.getElementById('input-shg-principal'),
    inputShgStartDate: document.getElementById('input-shg-start-date'),
    inputShgEndDate: document.getElementById('input-shg-end-date'),
    inputShgInterestRate: document.getElementById('input-shg-interest-rate'),
    inputShgPenalRate: document.getElementById('input-shg-penal-rate'),
    inputShgAmountPaying: document.getElementById('input-shg-amount-paying'),
    inputShgNormalPeriod: document.getElementById('input-shg-normal-period'),

    // SHG Loan Outputs
    valShgTotalDays: document.getElementById('val-shg-total-days'),
    valShgPenalDays: document.getElementById('val-shg-penal-days'),
    valShgNormalInterest: document.getElementById('val-shg-normal-interest'),
    valShgPenalInterest: document.getElementById('val-shg-penal-interest'),
    valShgTotalInterest: document.getElementById('val-shg-total-interest'),
    valShgPayingDisplay: document.getElementById('val-shg-paying-display'),
    valShgInterestAdjusted: document.getElementById('val-shg-interest-adjusted'),
    valShgPrincipalAdjusted: document.getElementById('val-shg-principal-adjusted'),
    valShgRemPrincipal: document.getElementById('val-shg-rem-principal'),
    valShgRemTotal: document.getElementById('val-shg-rem-total'),
    lblShgNetStatus: document.getElementById('lbl-shg-net-status'),
    boxShgNetSettlement: document.getElementById('box-shg-net-settlement'),
    shgHeaderToday: document.getElementById('shg-header-today-date')
};

/* ==========================================================================
   Routing / Tab Navigation
   ========================================================================== */
function setupRouting() {
    const submenus = document.querySelectorAll('.has-submenu');
    
    // Submenu Toggle Collapse/Expand - Generic for all has-submenu elements
    submenus.forEach(menu => {
        const trigger = menu.querySelector('.menu-trigger');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Close other submenus first
                submenus.forEach(otherMenu => {
                    if (otherMenu !== menu) {
                        otherMenu.classList.remove('expanded');
                    }
                });
                
                menu.classList.toggle('expanded');
            });
        }
    });

    elements.sidebarLinks = document.querySelectorAll('.nav-link, .submenu-link');
    elements.sidebarLinks.forEach(link => {
        // Skip triggers that don't route
        if (link.classList.contains('menu-trigger')) return;
        
        link.addEventListener('click', (e) => {
            if (link.classList.contains('disabled')) {
                e.preventDefault();
                return;
            }
            
            const targetHref = link.getAttribute('href');
            if (!targetHref || !targetHref.startsWith('#')) return;
            
            e.preventDefault();
            
            // Switch tabs
            const targetPageId = `page-${targetHref.substring(1)}`;
            const targetPage = document.getElementById(targetPageId);
            
            if (targetPage) {
                // Remove active classes
                elements.pages.forEach(p => p.classList.remove('active'));
                elements.sidebarLinks.forEach(l => {
                    l.parentElement.classList.remove('active');
                    l.classList.remove('active');
                });
                
                // Set active page
                targetPage.classList.add('active');
                
                // Highlight active link
                link.classList.add('active');
                link.parentElement.classList.add('active');
                
                // If it is a submenu item, ensure main parent has highlight
                if (link.classList.contains('submenu-link')) {
                    const parentMenu = link.closest('.has-submenu');
                    if (parentMenu) {
                        parentMenu.querySelector('.menu-trigger').classList.add('active');
                        parentMenu.classList.add('expanded');
                    }
                } else {
                    // Collapse all submenus if a top-level link is clicked
                    submenus.forEach(menu => {
                        menu.querySelector('.menu-trigger').classList.remove('active');
                        menu.classList.remove('expanded');
                    });
                }
            }
        });
    });

    // Clicking sidebar header goes to Home
    const sidebarHeaderBtn = document.getElementById('sidebar-header-btn');
    if (sidebarHeaderBtn) {
        sidebarHeaderBtn.addEventListener('click', () => {
            const linkHome = document.getElementById('link-home');
            if (linkHome) linkHome.click();
        });
    }
}

/* ==========================================================================
   Localization (Language Switching)
   ========================================================================== */
function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    
    // Update DOM translation attributes
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    elementsToTranslate.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });

    // Save preference
    localStorage.setItem('pacs_lang', lang);
    
    // Update controls text
    if (lang === 'ta') {
        elements.langLabel.textContent = "English";
    } else {
        elements.langLabel.textContent = "தமிழ்";
    }
    
    // Update Date in header
    formatHeaderDate();
    
    // Recalculate calculator outputs to update formatted text
    calculateLoan();
    calculateJewelLoan();
    calculateSHGLoan();
}

function setupLocalization() {
    // Load preference
    const savedLang = localStorage.getItem('pacs_lang');
    if (savedLang && (savedLang === 'ta' || savedLang === 'en')) {
        setLanguage(savedLang);
    } else {
        setLanguage('ta'); // default
    }
    
    elements.langToggle.addEventListener('click', () => {
        const targetLang = currentLang === 'ta' ? 'en' : 'ta';
        setLanguage(targetLang);
    });
}

function formatHeaderDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const locale = currentLang === 'ta' ? 'ta-IN' : 'en-IN';
    const dateStr = today.toLocaleDateString(locale, options);
    if (elements.headerToday) elements.headerToday.textContent = dateStr;
    if (elements.jlHeaderToday) elements.jlHeaderToday.textContent = dateStr;
    if (elements.shgHeaderToday) elements.shgHeaderToday.textContent = dateStr;
}

/* ==========================================================================
   Dark/Light Theme
   ========================================================================== */
function setTheme(mode) {
    if (mode === 'dark') {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        elements.sunIcon.style.display = 'none';
        elements.moonIcon.style.display = 'flex';
        
        // Update theme text translation
        const labelKey = currentLang === 'ta' ? 'theme_dark' : 'theme_light';
        elements.themeText.textContent = translations[currentLang][labelKey] || "இரவு மோட்";
        localStorage.setItem('pacs_theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        elements.sunIcon.style.display = 'flex';
        elements.moonIcon.style.display = 'none';
        
        // Update theme text translation
        const labelKey = currentLang === 'ta' ? 'theme_light' : 'theme_dark';
        elements.themeText.textContent = translations[currentLang][labelKey] || "பகல் மோட்";
        localStorage.setItem('pacs_theme', 'light');
    }
}

function setupTheme() {
    // Load preference or check system settings
    const savedTheme = localStorage.getItem('pacs_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
    
    elements.themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-mode');
        setTheme(isDark ? 'light' : 'dark');
    });
}

/* ==========================================================================
   Interest Calculation Engine
   ========================================================================== */
function formatCurrency(amount) {
    const locale = currentLang === 'ta' ? 'en-IN' : 'en-IN';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function calculateLoan() {
    // Read input values (remove Indian separators before parsing)
    const principal = parseFloat(elements.inputPrincipal.value.replace(/,/g, '')) || 0;
    const startDateVal = elements.inputStartDate.value;
    const endDateVal = elements.inputEndDate.value;
    const interestRate = parseFloat(elements.inputInterestRate.value) || 0;
    const penalRate = parseFloat(elements.inputPenalRate.value) || 0;
    const normalPeriodLimit = parseInt(elements.inputNormalPeriod.value) || 365;

    // Reset styles / validations
    elements.inputEndDate.classList.remove('input-error');
    elements.inputStartDate.classList.remove('input-error');

    if (!startDateVal || !endDateVal || principal <= 0) {
        return;
    }

    const startDate = new Date(startDateVal);
    const endDate = new Date(endDateVal);

    // Date range validation
    if (endDate < startDate) {
        elements.inputEndDate.classList.add('input-error');
        elements.inputStartDate.classList.add('input-error');
        
        const errMsg = currentLang === 'ta' 
            ? "முடிவு தேதி ஆரம்ப தேதிக்கு முன்னதாக இருக்கக்கூடாது!"
            : "End Date cannot be before Start Date!";
            
        elements.valTotalDays.textContent = "—";
        elements.valPenalDays.textContent = "—";
        elements.valNormalInterest.textContent = errMsg;
        elements.valPenalInterest.textContent = "—";
        elements.valTotalInterest.textContent = "—";
        elements.valTotalPayable.textContent = "—";
        return;
    }

    // Total Days Calculation
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));

    // Penal Days Calculation
    const penalDays = Math.max(0, totalDays - normalPeriodLimit);
    const normalInterestDays = totalDays; // Normal rate applies to the whole period

    // Interest Calculations
    // Formula: Principal * Rate% * (Days / 365)
    const normalInterest = principal * (interestRate / 100) * (normalInterestDays / 365);
    const penalInterest = principal * (penalRate / 100) * (penalDays / 365);
    const totalInterest = normalInterest + penalInterest;
    const totalPayable = principal + totalInterest;

    // Update Output Values
    elements.valTotalDays.textContent = totalDays;
    elements.valPenalDays.textContent = penalDays;
    
    elements.valNormalInterest.textContent = formatCurrency(normalInterest);
    elements.valPenalInterest.textContent = formatCurrency(penalInterest);
    elements.valTotalInterest.textContent = formatCurrency(totalInterest);
    elements.valTotalPayable.textContent = formatCurrency(totalPayable);


}


function calculateJewelLoan() {
    if (!elements.inputJlPrincipal) return;

    // Read inputs
    const principal = parseFloat(elements.inputJlPrincipal.value.replace(/,/g, '')) || 0;
    const startDateVal = elements.inputJlStartDate.value;
    const endDateVal = elements.inputJlEndDate.value;
    const interestRate = parseFloat(elements.inputJlInterestRate.value) || 0;
    const penalRate = parseFloat(elements.inputJlPenalRate.value) || 0;
    const appFees = parseFloat(elements.inputJlAppFees.value.replace(/,/g, '')) || 0;
    const paidAmount = parseFloat(elements.inputJlIfPaying.value.replace(/,/g, '')) || 0;
    const newLoan = parseFloat(elements.inputJlNewLoan.value.replace(/,/g, '')) || 0;
    const normalPeriodLimit = parseInt(elements.inputJlNormalPeriod.value) || 365;

    // Reset validations
    elements.inputJlEndDate.classList.remove('input-error');
    elements.inputJlStartDate.classList.remove('input-error');

    if (!startDateVal || !endDateVal || principal <= 0) {
        return;
    }

    const startDate = new Date(startDateVal);
    const endDate = new Date(endDateVal);

    if (endDate < startDate) {
        elements.inputJlEndDate.classList.add('input-error');
        elements.inputJlStartDate.classList.add('input-error');

        const errMsg = currentLang === 'ta' 
            ? "முடிவு தேதி ஆரம்ப தேதிக்கு முன்னதாக இருக்கக்கூடாது!"
            : "End Date cannot be before Start Date!";

        elements.valJlTotalDays.textContent = "—";
        elements.valJlPenalDays.textContent = "—";
        elements.valJlNormalInterest.textContent = errMsg;
        elements.valJlPenalInterest.textContent = "—";
        elements.valJlOldTotal.textContent = "—";
        elements.valJlAdjustedTotal.textContent = "—";
        elements.valJlNetCash.textContent = "—";
        return;
    }

    // Days Math
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    const penalDays = Math.max(0, totalDays - normalPeriodLimit);

    // Interest Math (following Excel ROUND(B6*E6*G6/36500,0) exactly)
    const normalInterest = Math.round(principal * interestRate * totalDays / 36500);
    const penalInterest = Math.round(principal * penalRate * penalDays / 36500);
    const totalInterest = normalInterest + penalInterest;
    
    const oldTotal = principal + totalInterest;
    const adjustedTotal = oldTotal + appFees - paidAmount;
    const netCash = adjustedTotal - newLoan;

    // Update outputs
    elements.valJlTotalDays.textContent = totalDays;
    elements.valJlPenalDays.textContent = penalDays;
    elements.valJlOldPrincipal.textContent = formatCurrency(principal);
    elements.valJlNormalInterest.textContent = formatCurrency(normalInterest);
    elements.valJlPenalInterest.textContent = formatCurrency(penalInterest);
    elements.valJlOldTotal.textContent = formatCurrency(oldTotal);
    elements.valJlAppFeesDisplay.textContent = formatCurrency(appFees);
    elements.valJlIfPayingDisplay.textContent = formatCurrency(paidAmount);
    elements.valJlAdjustedTotal.textContent = formatCurrency(adjustedTotal);
    elements.valJlNetCash.textContent = formatCurrency(Math.abs(netCash));

    // Update box status and classes
    if (netCash >= 0) {
        elements.lblJlNetStatus.textContent = translations[currentLang].status_get_amount || "பெற வேண்டியது";
        elements.boxJlNetSettlement.classList.remove('highlight-item-green');
        elements.boxJlNetSettlement.classList.add('highlight-item-blue');
        elements.valJlNetCash.className = "breakdown-value font-bold text-info";
    } else {
        elements.lblJlNetStatus.textContent = translations[currentLang].status_give || "வழங்க வேண்டியது";
        elements.boxJlNetSettlement.classList.remove('highlight-item-blue');
        elements.boxJlNetSettlement.classList.add('highlight-item-green');
        elements.valJlNetCash.className = "breakdown-value font-bold text-success";
    }
}

function calculateSHGLoan() {
    if (!elements.inputShgPrincipal) return;

    // Read inputs
    const principal = parseFloat(elements.inputShgPrincipal.value.replace(/,/g, '')) || 0;
    const startDateVal = elements.inputShgStartDate.value;
    const endDateVal = elements.inputShgEndDate.value;
    const interestRate = parseFloat(elements.inputShgInterestRate.value) || 0;
    const penalRate = parseFloat(elements.inputShgPenalRate.value) || 0;
    const amountPaying = parseFloat(elements.inputShgAmountPaying.value.replace(/,/g, '')) || 0;
    const normalPeriodLimit = parseInt(elements.inputShgNormalPeriod.value) || 365;

    // Reset validations
    elements.inputShgEndDate.classList.remove('input-error');
    elements.inputShgStartDate.classList.remove('input-error');

    if (!startDateVal || !endDateVal || principal <= 0) {
        return;
    }

    const startDate = new Date(startDateVal);
    const endDate = new Date(endDateVal);

    if (endDate < startDate) {
        elements.inputShgEndDate.classList.add('input-error');
        elements.inputShgStartDate.classList.add('input-error');

        const errMsg = currentLang === 'ta' 
            ? "முடிவு தேதி ஆரம்ப தேதிக்கு முன்னதாக இருக்கக்கூடாது!"
            : "End Date cannot be before Start Date!";

        elements.valShgTotalDays.textContent = "—";
        elements.valShgPenalDays.textContent = "—";
        elements.valShgNormalInterest.textContent = errMsg;
        elements.valShgPenalInterest.textContent = "—";
        elements.valShgTotalInterest.textContent = "—";
        elements.valShgPayingDisplay.textContent = "—";
        elements.valShgInterestAdjusted.textContent = "—";
        elements.valShgPrincipalAdjusted.textContent = "—";
        elements.valShgRemPrincipal.textContent = "—";
        elements.valShgRemInterest.textContent = "—";
        elements.valShgRemTotal.textContent = "—";
        return;
    }

    // Days calculation
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    const penalDays = Math.max(0, totalDays - normalPeriodLimit);

    // Interest Math (standard agricultural / commercial PACS rounding)
    const normalInterest = Math.round(principal * interestRate * totalDays / 36500);
    const penalInterest = Math.round(principal * penalRate * penalDays / 36500);
    const totalInterest = normalInterest + penalInterest;

    // Deductions adjustments (Deducted from Payment)
    // 1. Interest portion adjusted first
    const interestAdjusted = Math.min(totalInterest, amountPaying);
    // 2. Remaining goes to principal
    let principalAdjusted = 0;
    if (amountPaying > totalInterest) {
        principalAdjusted = Math.min(principal, amountPaying - totalInterest);
    }

    // Balances
    const remPrincipal = Math.max(0, principal - principalAdjusted);
    const remInterest = Math.max(0, totalInterest - interestAdjusted);
    const remTotal = remPrincipal + remInterest;

    // Update outputs
    elements.valShgTotalDays.textContent = totalDays;
    elements.valShgPenalDays.textContent = penalDays;
    elements.valShgNormalInterest.textContent = formatCurrency(normalInterest);
    elements.valShgPenalInterest.textContent = formatCurrency(penalInterest);
    elements.valShgTotalInterest.textContent = formatCurrency(totalInterest);
    elements.valShgPayingDisplay.textContent = formatCurrency(amountPaying);
    elements.valShgInterestAdjusted.textContent = formatCurrency(interestAdjusted);
    elements.valShgPrincipalAdjusted.textContent = formatCurrency(principalAdjusted);
    elements.valShgRemPrincipal.textContent = formatCurrency(remPrincipal);
    elements.valShgRemTotal.textContent = formatCurrency(remTotal);

    // Update highlight box style & badge
    if (remTotal > 0) {
        elements.lblShgNetStatus.textContent = translations[currentLang].status_shg_outstanding || "நிலுவை உள்ளது";
        elements.boxShgNetSettlement.classList.remove('highlight-item-green');
        elements.boxShgNetSettlement.classList.add('highlight-item-blue');
        elements.valShgRemTotal.className = "breakdown-value font-bold text-info";
    } else {
        elements.lblShgNetStatus.textContent = translations[currentLang].status_shg_settled || "கடன் முடிந்தது";
        elements.boxShgNetSettlement.classList.remove('highlight-item-blue');
        elements.boxShgNetSettlement.classList.add('highlight-item-green');
        elements.valShgRemTotal.className = "breakdown-value font-bold text-success";
    }
}

function formatInputWithCommas(inputElement, callback) {
    if (!inputElement) return;
    inputElement.addEventListener('input', (e) => {
        const selectionStart = e.target.selectionStart;
        const oldLength = e.target.value.length;
        
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value) {
            e.target.value = parseInt(value, 10).toLocaleString('en-IN');
            
            const newLength = e.target.value.length;
            const lengthDiff = newLength - oldLength;
            e.target.setSelectionRange(selectionStart + lengthDiff, selectionStart + lengthDiff);
        } else {
            e.target.value = '';
        }
        if (callback) callback();
    });
}

function setupCalculatorListeners() {
    // Set End Dates to today's system date by default
    if (elements.inputEndDate) elements.inputEndDate.value = todayStr;
    if (elements.inputJlEndDate) elements.inputJlEndDate.value = todayStr;
    if (elements.inputShgEndDate) elements.inputShgEndDate.value = todayStr;

    // Format Crop Loan inputs
    formatInputWithCommas(elements.inputPrincipal, calculateLoan);

    // Format Jewel Loan inputs
    formatInputWithCommas(elements.inputJlPrincipal, calculateJewelLoan);
    formatInputWithCommas(elements.inputJlAppFees, calculateJewelLoan);
    formatInputWithCommas(elements.inputJlIfPaying, calculateJewelLoan);
    formatInputWithCommas(elements.inputJlNewLoan, calculateJewelLoan);

    // Format SHG Loan inputs
    formatInputWithCommas(elements.inputShgPrincipal, calculateSHGLoan);
    formatInputWithCommas(elements.inputShgAmountPaying, calculateSHGLoan);

    // Add Crop Loan normal input event listeners
    const cropInputs = [
        elements.inputStartDate,
        elements.inputEndDate,
        elements.inputInterestRate,
        elements.inputPenalRate,
        elements.inputNormalPeriod
    ];
    cropInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('input', calculateLoan);
        input.addEventListener('change', calculateLoan);
    });

    // Add Jewel Loan normal input event listeners
    const jlInputs = [
        elements.inputJlStartDate,
        elements.inputJlEndDate,
        elements.inputJlInterestRate,
        elements.inputJlPenalRate,
        elements.inputJlNormalPeriod
    ];
    jlInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('input', calculateJewelLoan);
        input.addEventListener('change', calculateJewelLoan);
    });

    // Add SHG Loan normal input event listeners
    const shgInputs = [
        elements.inputShgStartDate,
        elements.inputShgEndDate,
        elements.inputShgInterestRate,
        elements.inputShgPenalRate,
        elements.inputShgNormalPeriod
    ];
    shgInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('input', calculateSHGLoan);
        input.addEventListener('change', calculateSHGLoan);
    });

    // Run once on load to display default prefilled calculations
    calculateLoan();
    calculateJewelLoan();
    calculateSHGLoan();
}

// Local Database Fallback
let localMembers = [
    { "Member ID": "PACS-1024", "SB ERP No": "12840", "Member Name": "கிருஷ்ணன் ராமசாமி", "Loan Type": "Crop Loan", "Approved Amount": 100000, "Outstanding Balance": 107838, "Status": "Active" },
    { "Member ID": "PACS-1085", "SB ERP No": "13942", "Member Name": "சுப்பிரமணியன் பழனிசாமி", "Loan Type": "Jewel Loan", "Approved Amount": 33000, "Outstanding Balance": 37114, "Status": "Active" },
    { "Member ID": "PACS-1102", "SB ERP No": "14023", "Member Name": "மங்கையர்க்கரசி வடிவேல்", "Loan Type": "SHG Loan", "Approved Amount": 10000, "Outstanding Balance": 9200, "Status": "Active" },
    { "Member ID": "PACS-0952", "SB ERP No": "11942", "Member Name": "ராஜேந்திரன் தர்மலிங்கம்", "Loan Type": "Crop Loan", "Approved Amount": 200000, "Outstanding Balance": 0, "Status": "Settled" },
    { "Member ID": "PACS-1204", "SB ERP No": "15302", "Member Name": "செல்லம்மாள் மாணிக்கம்", "Loan Type": "SHG Loan", "Approved Amount": 50000, "Outstanding Balance": 24500, "Status": "Active" }
];

// Permanent Google Sheets API Web App URL. Paste your URL here once to connect automatically on all machines!
const DEFAULT_GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzHoOGzprsNkIWnuYHDVcUwMvcMq0UVYTfyh4VZpup1wsCxTZtevXougyWb0zAI9vDW/exec";

let connectedSheetUrl = DEFAULT_GOOGLE_SHEET_URL;

function renderMembersTable(membersList) {
    const resultsContainer = document.getElementById('search-results-container');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    if (membersList.length === 0) {
        resultsContainer.innerHTML = `<div class="text-center text-secondary" style="padding: 30px;" data-i18n="status_no_members">உறுப்பினர்கள் யாரும் கண்டறியப்படவில்லை (No members found)</div>`;
        return;
    }
    
    // Get headers dynamically (excluding metadata like 'row_num')
    const allKeys = Object.keys(membersList[0]);
    const columns = allKeys.filter(k => k !== 'row_num');
    
    membersList.forEach(member => {
        const card = document.createElement('div');
        card.className = 'member-profile-card';
        
        // Header info of card
        const cardHeader = document.createElement('div');
        cardHeader.className = 'profile-card-header';
        
        // Find Member ID (assumed first column)
        const primaryId = member[columns[0]] || '';
        const nameCol = columns.find(c => c.toLowerCase().includes('name') || c.includes('பெயர்')) || columns[1];
        const primaryName = member[nameCol] || '';
        
        cardHeader.innerHTML = `
            <div class="profile-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
            <div>
                <h4 class="profile-card-title">${primaryName}</h4>
                <span class="profile-card-subtitle">${columns[0]}: <strong>${primaryId}</strong></span>
            </div>
        `;
        card.appendChild(cardHeader);
        
        // Body Grid info of card
        const cardBody = document.createElement('div');
        cardBody.className = 'profile-card-grid';
        
        columns.forEach((col, idx) => {
            // Skip showing Name again if it's already in header
            if (col === nameCol) return;
            
            const field = document.createElement('div');
            field.className = 'profile-field-item';
            
            const label = document.createElement('span');
            label.className = 'profile-field-label';
            label.textContent = col;
            field.appendChild(label);
            
            const value = document.createElement('span');
            value.className = 'profile-field-value';
            
            const val = member[col] !== undefined ? member[col] : '';
            
            // Format currency if value looks like a number and header contains 'Amount', 'Balance', 'Outstanding', or 'தொகை'
            const isNumeric = val !== '' && !isNaN(parseFloat(val)) && isFinite(val);
            const isCurrencyCol = col.toLowerCase().includes('amount') || 
                                  col.toLowerCase().includes('balance') || 
                                  col.toLowerCase().includes('outstanding') ||
                                  col.includes('தொகை') ||
                                  col.includes('மதிப்பு');
                                  
            if (isNumeric && isCurrencyCol) {
                value.textContent = '₹' + parseFloat(val).toLocaleString('en-IN');
                if (parseFloat(val) > 0 && (col.toLowerCase().includes('balance') || col.toLowerCase().includes('outstanding') || col.includes('நிலுவை'))) {
                    value.className = 'profile-field-value text-danger font-bold';
                } else {
                    value.className = 'profile-field-value font-bold';
                }
            } else if (col.toLowerCase() === 'status' || col.toLowerCase() === 'status (நிலை)' || col.toLowerCase() === 'நிலை' || col.toLowerCase() === 'status') {
                const badge = document.createElement('span');
                const statusStr = String(val).trim().toLowerCase();
                const isActive = statusStr === 'active' || statusStr === 'நடைமுறையில்' || statusStr === 'உள்ளது';
                
                badge.className = `badge-status-table ${isActive ? 'status-active' : 'status-settled'}`;
                badge.textContent = val;
                value.appendChild(badge);
            } else {
                value.textContent = val;
                if (col.toLowerCase().includes('id') || col.includes('எண்') || col.toLowerCase().includes('no')) {
                    value.className = 'profile-field-value font-bold';
                }
            }
            
            field.appendChild(value);
            cardBody.appendChild(field);
        });
        
        card.appendChild(cardBody);
        
        // Footer actions of card
        const cardFooter = document.createElement('div');
        cardFooter.className = 'profile-card-footer';
        
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-primary btn-edit-member';
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span data-i18n="btn_edit">திருத்தவும்</span>
        `;
        
        editBtn.addEventListener('click', () => {
            openDynamicEditModal(member, columns);
        });
        
        cardFooter.appendChild(editBtn);
        card.appendChild(cardFooter);
        
        resultsContainer.appendChild(card);
    });
}

let currentSearchQuery = ""; // Store current search query

async function fetchMembers() {
    if (!connectedSheetUrl) {
        updateStatusIndicator(false, currentLang === 'ta' ? "இணைக்கப்படவில்லை (உள்ளூர் மாக்கப் தரவு காட்டப்படுகிறது)" : "Not connected (Local mock data displayed)");
        if (currentSearchQuery) {
            performSearch();
        }
        renderDynamicAddMemberForm();
        return;
    }
    
    updateStatusIndicator(true, currentLang === 'ta' ? "தரவுகள் ஏற்றப்படுகிறது..." : "Loading data...");
    
    try {
        const response = await fetch(connectedSheetUrl);
        const data = await response.json();
        if (Array.isArray(data)) {
            localMembers = data;
            updateStatusIndicator(true, currentLang === 'ta' ? "இணைக்கப்பட்டுள்ளது (Live Sync Enabled)" : "Connected (Live Sync Enabled)");
            if (currentSearchQuery) {
                performSearch();
            }
            renderDynamicAddMemberForm();
        } else {
            throw new Error("Invalid data format received from Apps Script");
        }
    } catch (error) {
        console.error("Fetch error:", error);
        updateStatusIndicator(false, currentLang === 'ta' ? "இணைப்புத் தோல்வி (வழிகாட்டிப் படிகளைச் சரிபார்க்கவும்)" : "Connection failed (Verify Apps Script setup)");
        if (currentSearchQuery) {
            performSearch();
        }
        renderDynamicAddMemberForm();
    }
}

function updateStatusIndicator(isConnected, text) {
    const dot = document.getElementById('connection-status-dot');
    const label = document.getElementById('connection-status-text');
    if (!dot || !label) return;
    
    if (isConnected) {
        dot.className = "status-indicator-dot dot-active";
        label.textContent = text;
    } else {
        dot.className = "status-indicator-dot dot-inactive";
        label.textContent = text;
    }
}

function setupGoogleSheetsSync() {
    const sheetUrlInput = document.getElementById('input-sheet-url');
    const connectBtn = document.getElementById('btn-connect-sheet');
    const disconnectBtn = document.getElementById('btn-disconnect-sheet');
    
    if (!sheetUrlInput || !connectBtn || !disconnectBtn) return;
    
    // Load from localStorage or fallback to default
    const savedUrl = localStorage.getItem('pacs_google_sheet_url') || DEFAULT_GOOGLE_SHEET_URL;
    if (savedUrl) {
        connectedSheetUrl = savedUrl;
        sheetUrlInput.value = savedUrl;
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        fetchMembers();
    } else {
        fetchMembers();
    }
    
    connectBtn.addEventListener('click', () => {
        const url = sheetUrlInput.value.trim();
        if (!url || !url.startsWith('https://script.google.com/')) {
            alert(currentLang === 'ta' ? 'செல்லுபடியாகும் Google Apps Script Web App URL-ஐ உள்ளிடவும்!' : 'Please enter a valid Google Apps Script Web App URL!');
            return;
        }
        
        connectedSheetUrl = url;
        localStorage.setItem('pacs_google_sheet_url', url);
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        fetchMembers();
    });
    
    disconnectBtn.addEventListener('click', () => {
        connectedSheetUrl = "";
        localStorage.removeItem('pacs_google_sheet_url');
        sheetUrlInput.value = "";
        connectBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
        clearSearch();
        fetchMembers();
    });
}

function openDynamicEditModal(member, columns) {
    const modal = document.getElementById('modal-edit-member');
    const formFields = document.getElementById('dynamic-form-fields');
    if (!modal || !formFields) return;
    
    // Set row num hidden field
    document.getElementById('edit-member-row-num').value = member['row_num'] || '';
    
    formFields.innerHTML = '';
    
    // Group fields into pairs for clean two-column grid
    let rowDiv = null;
    
    columns.forEach((col, idx) => {
        if (idx % 2 === 0) {
            rowDiv = document.createElement('div');
            rowDiv.className = 'form-row';
            formFields.appendChild(rowDiv);
        }
        
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = col;
        group.appendChild(label);
        
        const val = member[col] !== undefined ? member[col] : '';
        
        // Make the first column readonly/disabled (assumed Primary ID)
        if (idx === 0) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'search-input';
            input.value = val;
            input.readOnly = true;
            input.disabled = true;
            input.setAttribute('data-column-name', col);
            group.appendChild(input);
        } else {
            // Determine field type
            const colLower = col.toLowerCase();
            const valStr = String(val).trim().toLowerCase();
            
            if (colLower === 'status' || colLower === 'நிலை' || colLower === 'status (நிலை)') {
                // Dropdown for Status
                const select = document.createElement('select');
                select.className = 'search-input select-input';
                select.setAttribute('data-column-name', col);
                
                const optActive = document.createElement('option');
                optActive.value = member[col]; // Keep original value format
                optActive.textContent = currentLang === 'ta' ? 'Active / நடைமுறையில்' : 'Active';
                select.appendChild(optActive);
                
                const optSettled = document.createElement('option');
                const isCurrentActive = valStr === 'active' || valStr === 'நடைமுறையில்' || valStr === 'உள்ளது';
                optSettled.value = isCurrentActive ? (colLower === 'நிலை' ? 'முடிவுற்றது' : 'Settled') : (colLower === 'நிலை' ? 'நடைமுறையில்' : 'Active');
                optSettled.textContent = isCurrentActive ? (currentLang === 'ta' ? 'முடிவுற்றது / Settled' : 'Settled') : (currentLang === 'ta' ? 'நடைமுறையில் / Active' : 'Active');
                select.appendChild(optSettled);
                
                select.value = val;
                group.appendChild(select);
            } else if (colLower.includes('amount') || colLower.includes('balance') || colLower.includes('outstanding') || col.includes('தொகை') || col.includes('மதிப்பு')) {
                // Comma formatted numeric input
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'search-input';
                input.value = isNaN(parseFloat(val)) ? val : parseFloat(val).toLocaleString('en-IN');
                input.setAttribute('data-column-name', col);
                
                // Add comma formatting listener
                formatInputWithCommas(input);
                group.appendChild(input);
            } else {
                // Standard text input
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'search-input';
                input.value = val;
                input.setAttribute('data-column-name', col);
                group.appendChild(input);
            }
        }
        
        rowDiv.appendChild(group);
    });
    
    modal.classList.add('active');
}

function setupEditModalListeners() {
    const modal = document.getElementById('modal-edit-member');
    const closeBtn = document.getElementById('btn-close-modal');
    const cancelBtn = document.getElementById('btn-cancel-edit');
    const form = document.getElementById('edit-member-form');
    
    if (!modal || !closeBtn || !cancelBtn || !form) return;
    
    const closeModal = () => modal.classList.remove('active');
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtn = document.getElementById('btn-save-member');
        saveBtn.disabled = true;
        saveBtn.textContent = currentLang === 'ta' ? 'அப்டேட் செய்யப்படுகிறது...' : 'Updating...';
        
        // Gather fields dynamically
        const updatedFields = {};
        const inputs = form.querySelectorAll('[data-column-name]');
        
        inputs.forEach(input => {
            const colName = input.getAttribute('data-column-name');
            let val = input.value;
            
            // Clean up comma formatting for numeric values before sending
            const isCurrencyCol = colName.toLowerCase().includes('amount') || 
                                  colName.toLowerCase().includes('balance') || 
                                  colName.toLowerCase().includes('outstanding') ||
                                  colName.includes('தொகை') ||
                                  colName.includes('மதிப்பு');
                                  
            if (isCurrencyCol && val !== '') {
                const numericVal = parseFloat(val.replace(/,/g, ''));
                if (!isNaN(numericVal)) {
                    val = numericVal;
                }
            }
            
            updatedFields[colName] = val;
        });
        
        // Find row identifier (first column key)
        const allKeys = Object.keys(localMembers[0]);
        const columns = allKeys.filter(k => k !== 'row_num');
        const primaryKeyCol = columns[0]; // e.g. "Member ID"
        const primaryKeyVal = updatedFields[primaryKeyCol];
        
        if (connectedSheetUrl) {
            // Write update to Google Sheets via POST
            try {
                // Build Apps Script post payload
                const postPayload = {
                    member_id: primaryKeyVal,
                    ...updatedFields
                };
                
                const response = await fetch(connectedSheetUrl, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: JSON.stringify(postPayload)
                });
                const result = await response.json();
                if (result.status === 'success') {
                    alert(currentLang === 'ta' ? 'கூகுள் சீட்டில் வெற்றிகரமாக அப்டேட் செய்யப்பட்டது!' : 'Updated successfully in Google Sheet!');
                    closeModal();
                    fetchMembers(); // Re-fetch to sync fresh data
                } else {
                    alert('Update failed: ' + result.message);
                }
            } catch (error) {
                console.error("Update error:", error);
                alert('Connection error. Failed to save to Google Sheet.');
            }
        } else {
            // Update localMembers list locally
            const memberIdx = localMembers.findIndex(m => m[primaryKeyCol] === primaryKeyVal);
            if (memberIdx !== -1) {
                localMembers[memberIdx] = {
                    ...localMembers[memberIdx],
                    ...updatedFields
                };
                performSearch(); // Refresh search view with updated values
                alert(currentLang === 'ta' ? 'உள்ளூர் தரவு மாற்றியமைக்கப்பட்டது (கூகுள் சீட்டுடன் இணைக்கப்படவில்லை)!' : 'Local data updated (Not connected to Google Sheets)!');
                closeModal();
            }
        }
        
        saveBtn.disabled = false;
        saveBtn.textContent = currentLang === 'ta' ? 'அப்டேட் செய்க (Update)' : 'Update';
    });
}

function performSearch() {
    const searchInput = document.getElementById('member-search-input');
    const resultsCard = document.getElementById('search-results-card');
    const clearBtn = document.getElementById('btn-clear-search');
    if (!searchInput || !resultsCard || !clearBtn) return;
    
    const query = searchInput.value.toLowerCase().trim();
    currentSearchQuery = query;
    
    if (!query) {
        resultsCard.classList.add('hidden');
        clearBtn.classList.add('hidden');
        return;
    }
    
    const filtered = localMembers.filter(m => {
        // Search dynamically across all fields of the member object
        return Object.keys(m).some(key => {
            if (key === 'row_num') return false;
            const val = String(m[key]).toLowerCase();
            return val.includes(query);
        });
    });
    
    renderMembersTable(filtered);
    resultsCard.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
}

function clearSearch() {
    const searchInput = document.getElementById('member-search-input');
    const resultsCard = document.getElementById('search-results-card');
    const clearBtn = document.getElementById('btn-clear-search');
    if (!searchInput || !resultsCard || !clearBtn) return;
    
    searchInput.value = "";
    currentSearchQuery = "";
    resultsCard.classList.add('hidden');
    clearBtn.classList.add('hidden');
}

function setupMemberSearch() {
    const searchForm = document.getElementById('member-search-form');
    const clearBtn = document.getElementById('btn-clear-search');
    
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }
}

function setupPrintControllerModule() {
    // 1. KCC Section Elements
    const kccBorrowerInput = document.getElementById('print-kcc-borrower-input');
    const kccGuarantorInput = document.getElementById('print-kcc-guarantor-input');
    const kccBtnLookup = document.getElementById('btn-print-kcc-lookup');
    const kccPreviewCard = document.getElementById('print-kcc-preview-card');
    const kccStatusText = document.getElementById('print-kcc-status');
    
    const btnPrintKccSheet = document.getElementById('btn-print-kcc-sheet');
    const btnPrintKccDecSheet = document.getElementById('btn-print-kcc-dec-sheet');
    
    // 2. AH Section Elements
    const ahBorrowerInput = document.getElementById('print-ah-borrower-input');
    const ahGuarantorInput = document.getElementById('print-ah-guarantor-input');
    const ahBtnLookup = document.getElementById('btn-print-ah-lookup');
    const ahPreviewCard = document.getElementById('print-ah-preview-card');
    const ahStatusText = document.getElementById('print-ah-status');
    
    const btnPrintAhSheet = document.getElementById('btn-print-ah-sheet');
    const btnPrintAhDecSheet = document.getElementById('btn-print-ah-dec-sheet');
    
    let kccSelectedBorrower = null;
    let kccSelectedGuarantor = null;
    let ahSelectedBorrower = null;
    let ahSelectedGuarantor = null;
    
    // Helper: Lookup member details
    const findMember = (query) => {
        if (!query) return null;
        return localMembers.find(m => {
            const idVal = String(m[Object.keys(m)[0]] || '').toLowerCase();
            const erpVal = String(m['SB ERP No'] || m['SB ERP எண்'] || '').toLowerCase();
            const nameVal = String(m['Member Name'] || m['உறுப்பினர் பெயர்'] || '').toLowerCase();
            return idVal.includes(query) || erpVal.includes(query) || nameVal.includes(query);
        });
    };
    
    // Helper: Update preview table row
    const updatePreviewRow = (member, prefix) => {
        const idCell = document.getElementById(`td-${prefix}-id`);
        const nameCell = document.getElementById(`td-${prefix}-name`);
        const erpCell = document.getElementById(`td-${prefix}-erp`);
        const mobileCell = document.getElementById(`td-${prefix}-mobile`);
        const amountCell = document.getElementById(`td-${prefix}-amount`);
        const addressCell = document.getElementById(`td-${prefix}-address`);
        
        if (member) {
            const keys = Object.keys(member);
            const memberId = member[keys[0]] || '';
            const name = member[keys.find(k => k.toLowerCase().includes('name') || k.includes('பெயர்'))] || '';
            const erpNo = member['SB ERP No'] || member['SB ERP எண்'] || member[keys[1]] || '';
            const mobile = member['Mobile No'] || member['கைபேசி எண்'] || '9876543210';
            const approvedAmt = member['Approved Amount'] || member['ஒப்புதல் தொகை'] || '0';
            const address = member['Address'] || member['முகவரி'] || 'தேவாரம்';
            
            if (idCell) idCell.textContent = memberId;
            if (nameCell) nameCell.textContent = name;
            if (erpCell) erpCell.textContent = erpNo;
            if (mobileCell) mobileCell.textContent = mobile;
            if (amountCell) amountCell.textContent = `₹${parseInt(approvedAmt).toLocaleString('en-IN')}`;
            if (addressCell) addressCell.textContent = address;
        } else {
            if (idCell) idCell.textContent = "-";
            if (nameCell) nameCell.textContent = "-";
            if (erpCell) erpCell.textContent = "-";
            if (mobileCell) mobileCell.textContent = "-";
            if (amountCell) amountCell.textContent = "-";
            if (addressCell) addressCell.textContent = "-";
        }
    };
    
    // KCC Lookup Handler
    const performKccLookup = () => {
        const bQuery = kccBorrowerInput.value.trim().toLowerCase();
        const gQuery = kccGuarantorInput.value.trim().toLowerCase();
        
        if (!bQuery) {
            alert(currentLang === 'ta' ? "❌ கடன்தாரர் A Class எண் கட்டாயம்!" : "❌ Borrower A Class No is required!");
            return;
        }
        
        const borrower = findMember(bQuery);
        if (!borrower) {
            kccSelectedBorrower = null;
            kccPreviewCard.classList.add('hidden');
            if (kccStatusText) {
                kccStatusText.style.color = "var(--danger)";
                kccStatusText.textContent = currentLang === 'ta' ? "❌ கடன்தாரர் கண்டறியப்படவில்லை!" : "❌ Borrower not found!";
            }
            return;
        }
        
        kccSelectedBorrower = borrower;
        updatePreviewRow(borrower, 'kcc-b');
        
        if (gQuery) {
            const guarantor = findMember(gQuery);
            if (guarantor) {
                kccSelectedGuarantor = guarantor;
                updatePreviewRow(guarantor, 'kcc-g');
            } else {
                kccSelectedGuarantor = null;
                updatePreviewRow(null, 'kcc-g');
                alert(currentLang === 'ta' ? "⚠️ ஜாமீன்தாரர் தரவுத்தளத்தில் இல்லை!" : "⚠️ Guarantor not found in database!");
            }
        } else {
            kccSelectedGuarantor = null;
            updatePreviewRow(null, 'kcc-g');
        }
        
        kccPreviewCard.classList.remove('hidden');
        if (kccStatusText) {
            kccStatusText.style.color = "var(--success)";
            kccStatusText.textContent = currentLang === 'ta' ? "✅ விபரங்கள் சரிபார்க்கப்பட்டன!" : "✅ Preview details loaded!";
        }
    };
    
    // AH Lookup Handler
    const performAhLookup = () => {
        const bQuery = ahBorrowerInput.value.trim().toLowerCase();
        const gQuery = ahGuarantorInput.value.trim().toLowerCase();
        
        if (!bQuery) {
            alert(currentLang === 'ta' ? "❌ கடன்தாரர் A Class எண் கட்டாயம்!" : "❌ Borrower A Class No is required!");
            return;
        }
        
        const borrower = findMember(bQuery);
        if (!borrower) {
            ahSelectedBorrower = null;
            ahPreviewCard.classList.add('hidden');
            if (ahStatusText) {
                ahStatusText.style.color = "var(--danger)";
                ahStatusText.textContent = currentLang === 'ta' ? "❌ கடன்தாரர் கண்டறியப்படவில்லை!" : "❌ Borrower not found!";
            }
            return;
        }
        
        ahSelectedBorrower = borrower;
        updatePreviewRow(borrower, 'ah-b');
        
        if (gQuery) {
            const guarantor = findMember(gQuery);
            if (guarantor) {
                ahSelectedGuarantor = guarantor;
                updatePreviewRow(guarantor, 'ah-g');
            } else {
                ahSelectedGuarantor = null;
                updatePreviewRow(null, 'ah-g');
                alert(currentLang === 'ta' ? "⚠️ ஜாமீன்தாரர் தரவுத்தளத்தில் இல்லை!" : "⚠️ Guarantor not found in database!");
            }
        } else {
            ahSelectedGuarantor = null;
            updatePreviewRow(null, 'ah-g');
        }
        
        ahPreviewCard.classList.remove('hidden');
        if (ahStatusText) {
            ahStatusText.style.color = "var(--success)";
            ahStatusText.textContent = currentLang === 'ta' ? "✅ விபரங்கள் சரிபார்க்கப்பட்டன!" : "✅ Preview details loaded!";
        }
    };
    
    // Connect listeners
    if (kccBtnLookup) kccBtnLookup.addEventListener('click', performKccLookup);
    if (ahBtnLookup) ahBtnLookup.addEventListener('click', performAhLookup);
    
    if (kccBorrowerInput) {
        kccBorrowerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performKccLookup(); });
    }
    if (ahBorrowerInput) {
        ahBorrowerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performAhLookup(); });
    }
    
    // Call Apps Script for Printing
    async function requestPrintSheet(docType, isKcc = true) {
        const borrower = isKcc ? kccSelectedBorrower : ahSelectedBorrower;
        const guarantor = isKcc ? kccSelectedGuarantor : ahSelectedGuarantor;
        const statusText = isKcc ? kccStatusText : ahStatusText;
        
        if (!borrower) return;
        
        const keys = Object.keys(borrower);
        const memberId = borrower[keys[0]] || '';
        
        const gKeys = guarantor ? Object.keys(guarantor) : [];
        const guarantorId = guarantor ? guarantor[gKeys[0]] : '';
        
        const syncUrl = document.getElementById('input-sheet-url') ? document.getElementById('input-sheet-url').value.trim() : '';
        const apiUrl = syncUrl || (typeof GOOGLE_SHEET_API_URL !== 'undefined' ? GOOGLE_SHEET_API_URL : '');
        
        if (!apiUrl) {
            alert(currentLang === 'ta' 
                ? "கூகுள் சீட் வெப் ஆப் URL இணைக்கப்படவில்லை! கடன் உறுப்பினர்கள் பகுதியில் URL ஐ இணைக்கவும்." 
                : "Google Sheets Web App URL not connected! Please connect the URL in the Loan Members config card.");
            return;
        }
        
        if (statusText) {
            statusText.style.color = "var(--primary)";
            statusText.textContent = currentLang === 'ta'
                ? "⏳ கூகுள் சீட்டிற்கு விபரங்களை அனுப்புகிறது... தயவுசெய்து காத்திருக்கவும்..."
                : "⏳ Sending coordinates to Google Sheets... Please wait...";
        }
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify({
                    action: "prepare_print",
                    member_id: memberId,
                    guarantor_id: guarantorId,
                    doc_type: docType
                })
            });
            
            const result = await response.json();
            if (result.status === 'success' && result.pdf_url) {
                if (statusText) {
                    statusText.style.color = "var(--success)";
                    statusText.textContent = currentLang === 'ta'
                        ? "✅ கூகுள் சீட் புதுப்பிக்கப்பட்டது! பிரிண்ட் பக்கம் புதிய டேப்பில் திறக்கப்படுகிறது."
                        : "✅ Google Sheet updated! Opening PDF print tab.";
                }
                window.open(result.pdf_url, '_blank');
            } else {
                throw new Error(result.message || "Failed to get print URL");
            }
        } catch (error) {
            if (statusText) {
                statusText.style.color = "var(--danger)";
                statusText.textContent = currentLang === 'ta'
                    ? "❌ பிழை: " + error.message
                    : "❌ Error: " + error.message;
            }
            alert("Printing request failed: " + error.message);
        }
    }
    
    // Print triggers
    if (btnPrintKccSheet) btnPrintKccSheet.addEventListener('click', () => requestPrintSheet('kcc', true));
    if (btnPrintKccDecSheet) btnPrintKccDecSheet.addEventListener('click', () => requestPrintSheet('declaration', true));
    
    if (btnPrintAhSheet) btnPrintAhSheet.addEventListener('click', () => requestPrintSheet('ah', false));
    if (btnPrintAhDecSheet) btnPrintAhDecSheet.addEventListener('click', () => requestPrintSheet('declaration', false));
}

function getInputRestrictionType(colName) {
    const name = colName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tamil = colName;
    
    // Numeric-only columns: A Class, SB ERP, Adhar, Mobile, Mdcc, SB/ERP account numbers
    if (
        name.includes('aclass') || 
        name.includes('sberp') || 
        name.includes('erp') || 
        name.includes('sb') || 
        name.includes('adhar') || 
        name.includes('aadhaar') || 
        name.includes('mobile') || 
        name.includes('phone') || 
        name.includes('mdcc') || 
        name === 'memberid' ||
        tamil.includes('ஏ கிளாஸ்') ||
        tamil.includes('அலைபேசி') ||
        tamil.includes('கைபேசி') ||
        tamil.includes('எஸ் பி') ||
        tamil.includes('இ ஆர் பி')
    ) {
        return 'numeric-only';
    }
    
    // Mixed (Alphanumeric): Door, Ration, Address, Loan Type, KCC No, Savings SB, etc.
    if (
        name.includes('door') || 
        name.includes('ration') || 
        name.includes('familycard') ||
        name.includes('address') ||
        name.includes('loantype') ||
        name.includes('kccno') ||
        name.includes('savings') ||
        tamil.includes('கதவு') ||
        tamil.includes('குடும்ப அட்டை') ||
        tamil.includes('ரேஷன்') ||
        tamil.includes('முகவரி')
    ) {
        return 'alphanumeric';
    }
    
    // Currency columns: Amount, Outstanding, Total Share (formats with Indian comma separation)
    if (
        name.includes('amount') || 
        name.includes('balance') || 
        name.includes('outstanding') || 
        name.includes('totalshare') || 
        name.includes('share') || 
        colName.includes('தொகை') || 
        colName.includes('மதிப்பு') ||
        tamil.includes('பங்கு')
    ) {
        return 'currency';
    }
    
    // Text-only columns (no numbers allowed)
    return 'text-only';
}

function renderDynamicAddMemberForm() {
    const container = document.getElementById('dynamic-add-member-fields');
    if (!container || !localMembers || localMembers.length === 0) return;
    
    container.innerHTML = '';
    
    // Get headers dynamically (excluding metadata like 'row_num')
    const allKeys = Object.keys(localMembers[0]);
    const columns = allKeys.filter(k => k !== 'row_num');
    
    // Group fields into pairs for clean two-column grid
    let rowDiv = null;
    
    columns.forEach((col, idx) => {
        if (idx % 2 === 0) {
            rowDiv = document.createElement('div');
            rowDiv.className = 'form-row';
            container.appendChild(rowDiv);
        }
        
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        // Mark first column as required
        label.innerHTML = idx === 0 ? `${col} <span class="required">*</span>` : col;
        group.appendChild(label);
        
        // Determine field type
        const colLower = col.toLowerCase();
        
        if (colLower === 'status' || colLower === 'நிலை' || colLower === 'status (நிலை)') {
            const select = document.createElement('select');
            select.className = 'select-input search-input';
            select.setAttribute('data-column-name', col);
            
            const optActive = document.createElement('option');
            optActive.value = colLower === 'நிலை' ? 'நடைமுறையில்' : 'Active';
            optActive.textContent = currentLang === 'ta' ? 'Active / நடைமுறையில்' : 'Active';
            select.appendChild(optActive);
            
            const optSettled = document.createElement('option');
            optSettled.value = colLower === 'நிலை' ? 'முடிவுற்றது' : 'Settled';
            optSettled.textContent = currentLang === 'ta' ? 'முடிவுற்றது / Settled' : 'Settled';
            select.appendChild(optSettled);
            
            group.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'search-input';
            input.setAttribute('data-column-name', col);
            if (idx === 0) input.required = true;
            
            const restriction = getInputRestrictionType(col);
            
            if (restriction === 'numeric-only') {
                input.inputMode = 'numeric';
                input.placeholder = currentLang === 'ta' ? 'எண்கள் மட்டும்' : 'Numbers only';
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                });
            } else if (restriction === 'currency') {
                input.placeholder = '0';
                formatInputWithCommas(input);
            } else if (restriction === 'text-only') {
                input.placeholder = currentLang === 'ta' ? 'எழுத்துக்கள் மட்டும்' : 'Text only';
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[0-9]/g, '');
                });
            } else {
                // Alphanumeric / Mixed
                input.placeholder = `எ.கா: ${col}`;
            }
            
            group.appendChild(input);
        }
        
        rowDiv.appendChild(group);
    });
}

function setupAddMemberModule() {
    const form = document.getElementById('add-member-form');
    const statusText = document.getElementById('add-member-status');
    const clearBtn = document.getElementById('btn-clear-new-member');
    
    if (!form) return;
    
    const clearForm = () => {
        form.reset();
        renderDynamicAddMemberForm(); // Redraw empty fields
        if (statusText) {
            statusText.textContent = '';
        }
    };
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const inputs = form.querySelectorAll('[data-column-name]');
        const newMember = {};
        let firstColName = '';
        let firstColVal = '';
        
        inputs.forEach((input, idx) => {
            const colName = input.getAttribute('data-column-name');
            let val = input.value.trim();
            
            if (idx === 0) {
                firstColName = colName;
                firstColVal = val;
            }
            
            // Clean currency formatted values before saving
            const isCurrencyCol = colName.toLowerCase().includes('amount') || 
                                  colName.toLowerCase().includes('balance') || 
                                  colName.toLowerCase().includes('outstanding') ||
                                  colName.includes('தொகை') ||
                                  colName.includes('மதிப்பு');
                                  
            if (isCurrencyCol && val !== '') {
                const numericVal = parseFloat(val.replace(/,/g, ''));
                if (!isNaN(numericVal)) {
                    val = numericVal;
                } else {
                    val = 0;
                }
            }
            
            newMember[colName] = val;
        });
        
        if (!firstColVal) {
            alert(currentLang === 'ta' ? `❌ ${firstColName} கட்டாயம்!` : `❌ ${firstColName} is required!`);
            return;
        }
        
        const submitBtn = document.getElementById('btn-submit-new-member');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = currentLang === 'ta' ? '⏳ சேமிக்கப்படுகிறது...' : '⏳ Saving...';
        }
        
        if (connectedSheetUrl) {
            try {
                const response = await fetch(connectedSheetUrl, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: JSON.stringify({
                        action: "add_member",
                        ...newMember
                    })
                });
                const result = await response.json();
                if (result.status === 'success') {
                    alert(currentLang === 'ta' ? '✅ புதிய உறுப்பினர் கூகுள் சீட்டில் வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : '✅ New member added successfully to Google Sheet!');
                    clearForm();
                    await fetchMembers(); // Reload database
                    
                    // Redirect to members page
                    const linkList = document.getElementById('link-members');
                    if (linkList) linkList.click();
                } else {
                    throw new Error(result.message || "Failed to add member");
                }
            } catch (error) {
                if (statusText) {
                    statusText.style.color = "var(--danger)";
                    statusText.textContent = currentLang === 'ta' ? "❌ பிழை: " + error.message : "❌ Error: " + error.message;
                }
                alert("Failed to add member to Google Sheets: " + error.message);
            }
        } else {
            // Add locally
            localMembers.push(newMember);
            alert(currentLang === 'ta' ? '✅ உறுப்பினர் உள்ளூர் மாக்கப் தரவில் சேர்க்கப்பட்டார் (கூகுள் சீட்டுடன் இணைக்கப்படவில்லை)!' : '✅ Member added to local mock data (Not connected to Google Sheets)!');
            clearForm();
            
            // Redirect to members page
            const linkList = document.getElementById('link-members');
            if (linkList) linkList.click();
        }
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = currentLang === 'ta' ? 'உறுப்பினரைச் சேர் (Add Member)' : 'Add Member';
        }
    });
}

/* ==========================================================================
   Init App
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    setupRouting();
    setupTheme();
    setupLocalization();
    setupCalculatorListeners();
    setupGoogleSheetsSync();
    setupEditModalListeners();
    setupMemberSearch();
    setupPrintControllerModule();
    setupAddMemberModule();
});
