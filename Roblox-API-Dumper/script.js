// script.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Getters
    const versionADropdown = document.getElementById('versionA');
    const versionBDropdown = document.getElementById('versionB');
    const apiDumpFormatDropdown = document.getElementById('apiDumpFormat');
    const fullDumpCheckbox = document.getElementById('fullDump');
    const viewApiDumpButton = document.getElementById('viewApiDump');
    const compareVersionsButton = document.getElementById('compareVersions');
    const downloadPngButton = document.getElementById('downloadPngButton');
    const statusDisplay = document.getElementById('status');
    const outputDisplay = document.getElementById('output'); 
    const htmlOutputDisplay = document.getElementById('htmlOutput');

    // Constants and State
    const API_DUMP_BASE_URL = "https://setup-aws.rbxcdn.com";
    const DEPLOY_HISTORY_URL = `${API_DUMP_BASE_URL}/DeployHistory.txt`;
    const apiCache = {};
    let availableStudioVersions = [];

    // --- Version Fetching & Parsing ---
    async function fetchAndParseDeployHistory() {
        availableStudioVersions = [];
        populateVersionDropdowns(); 

        setStatus("Fetching version history...");
        toggleLoading(true, "Fetching versions...");
        try {
            const response = await fetch(DEPLOY_HISTORY_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status} fetching DeployHistory.txt`);
            const text = await response.text();
            
            const regex = /New Studio64 (version-[0-9a-fA-F]+)/g;
            const versionSet = new Set();
            let match;
            while ((match = regex.exec(text)) !== null) versionSet.add(match[1]);
            
            availableStudioVersions = Array.from(versionSet).reverse();

            if (availableStudioVersions.length === 0) {
                setStatus("No Studio64 versions found. Using fallback.", true);
                availableStudioVersions = ["0.618.0.6180417", "0.617.0.6170388", "0.616.0.6160393"]; 
            } else {
                setStatus(`Found ${availableStudioVersions.length} Studio64 versions.`);
            }
        } catch (error) {
            setStatus(`Error fetching/parsing DeployHistory: ${error.message}. Using fallback. (Check CORS)`, true);
            availableStudioVersions = ["0.618.0.6180417", "0.617.0.6170388", "0.616.0.6160393"];
        } finally {
            populateVersionDropdowns();
            toggleLoading(false);
        }
    }

    function populateVersionDropdowns() {
        [versionADropdown, versionBDropdown].forEach((dropdown, idx) => {
            if (!dropdown) return;
            const currentValue = dropdown.value; // Preserve selection if possible
            dropdown.innerHTML = ""; // Clear existing
            availableStudioVersions.forEach(version => {
                const option = new Option(version, version);
                dropdown.add(option);
            });
            if (availableStudioVersions.includes(currentValue)) {
                dropdown.value = currentValue;
            } else if (availableStudioVersions.length > 0) {
                // Set default selections: A to newest, B to second newest (or newest if only one)
                dropdown.value = availableStudioVersions[idx === 0 ? 0 : (availableStudioVersions.length > 1 ? 1 : 0)];
            }
        });
    }

    // --- UI Utilities ---
    function setStatus(message, isError = false) {
        statusDisplay.textContent = `Status: ${message}`;
        statusDisplay.style.color = isError ? 'red' : '#495057';
        if (isError) console.error(message); else console.log(message);
    }

    function toggleLoading(isLoading, message = "Loading...") {
        [viewApiDumpButton, compareVersionsButton, downloadPngButton].forEach(btn => { if(btn) btn.disabled = isLoading; });
        setStatus(isLoading ? message : "Ready");
    }

    // --- API Data Fetching ---
    async function fetchApiDump(versionGuid, isFull, versionType = "Studio") {
        const fileName = isFull ? "Full-API-Dump" : "API-Dump";
        const cacheKey = `${versionGuid}-${fileName}`;
        if (apiCache[cacheKey]) {
            setStatus(`Using cached API for ${versionType} ${versionGuid}`);
            return apiCache[cacheKey];
        }
        const apiUrl = `${API_DUMP_BASE_URL}/${versionGuid}-${fileName}.json`;
        setStatus(`Fetching API for ${versionType} ${versionGuid}...`);
        toggleLoading(true, `Fetching ${versionType} ${versionGuid}...`);
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${apiUrl}`);
            const data = await response.json();
            apiCache[cacheKey] = data;
            setStatus(`Fetched API for ${versionType} ${versionGuid}`);
            return data;
        } catch (error) {
            setStatus(`Error fetching API for ${versionType} ${versionGuid}: ${error.message}`, true);
            return null;
        } finally {
            toggleLoading(false);
        }
    }

    // --- HTML/TXT Generation (Single API Dump) ---
    // Note: These render functions are simplified here for brevity. 
    // The full implementations from prior steps should be used.
    function renderHtmlSymbol(symbol) { return `<span class="symbol">${symbol}</span>`; }
    function renderTagsHtml(tagsArray = []) { return tagsArray.map(tag => `<span class="Tag">[${tag}]</span>`).join(" "); }
    function renderSecurityHtml(securityObj) { 
        if (!securityObj) return "";
        if (typeof securityObj === 'string' && securityObj !== "None") return `<span class="Security">{${securityObj}}</span>`;
        if (securityObj.Read && securityObj.Write) {
            const readSec = securityObj.Read !== "None" ? `<span class="Security">{${securityObj.Read}}</span>` : "";
            const writePrefix = securityObj.Write !== "None" && securityObj.Read !== securityObj.Write ? "✏️" : "";
            const writeSec = securityObj.Write !== "None" ? `<span class="Security">{${writePrefix}${securityObj.Write}}</span>` : "";
            let html = readSec;
            if (securityObj.Read !== securityObj.Write && writeSec) html += (readSec ? " " : "") + writeSec;
            else if (!readSec && writeSec) html = writeSec;
            return html;
        }
        if (securityObj.Type && securityObj.Type !== "None") return `<span class="Security">{${securityObj.Type}}</span>`;
        return "";
    }
    function renderLuaTypeHtml(luaTypeObj) { 
        if (!luaTypeObj || !luaTypeObj.Name) return `<span class="Type">any</span>`;
        let name = luaTypeObj.Name;
        const category = luaTypeObj.Category;
        const isOptional = name.endsWith('?');
        const absoluteName = name.replace("?", "");
        const luauTypeMappings = { /* ... as before ... */ };
        let effectiveName = luauTypeMappings[absoluteName] || absoluteName;
        // ... (rest of LuaType rendering logic as before) ...
        return `<span class="Type">${effectiveName}</span>` + (isOptional ? renderHtmlSymbol("?") : "");
    }
    function renderParametersHtml(paramsArray = []) { 
        let html = renderHtmlSymbol("(");
        if (paramsArray.length > 0) {
            html += paramsArray.map(p => {
                let typeCopy = JSON.parse(JSON.stringify(p.Type)); 
                if (p.Default !== undefined && p.Default !== null && !typeCopy.Name.endsWith("?")) typeCopy.Name += "?"; 
                let paramHtml = `<span class="ParamName">${p.Name}</span>${renderHtmlSymbol(": ")}${renderLuaTypeHtml(typeCopy)}`;
                if (p.Default !== undefined && p.Default !== null) { 
                    let defaultVal = p.Default;
                    if (( (typeCopy.AbsoluteName || typeCopy.Name) === "string" || typeCopy.Category === "Enum") && !(String(defaultVal).startsWith('"') && String(defaultVal).endsWith('"'))) {
                        defaultVal = `"${defaultVal}"`;
                    }
                    paramHtml += `${renderHtmlSymbol(" = ")}<span class="ParamDefault ${typeof defaultVal === 'number' ? 'Value' : 'String'}">${defaultVal}</span>`;
                }
                return paramHtml;
            }).join(renderHtmlSymbol(", "));
        }
        html += renderHtmlSymbol(")");
        return html;
    }
    function renderSerializationHtml(serialization) { 
        if (!serialization) return ""; let text = "";
        if (typeof serialization === 'object') { 
            if (serialization.CanSave && serialization.CanLoad) text = "CanSave, CanLoad";
            else if (serialization.CanSave) text = "CanSave";
            else if (serialization.CanLoad) text = "CanLoad";
        } else if (typeof serialization === 'string') text = serialization;
        return text ? `<span class="Serialization">[${text}]</span>` : "";
    }
    function renderMemberHtml(member, className) { 
        const isDeprecated = member.Tags && member.Tags.includes("Deprecated");
        let html = `<div class="child ${member.MemberType || 'UnknownMember'} ${isDeprecated ? "deprecated" : ""}">`;
        html += `<span class="DescriptorType ${member.MemberType || ''}">${member.MemberType || 'Unknown'}</span> `;
        html += `<span class="Name">${className}${member.MemberType === 'Function' || member.MemberType === 'Callback' ? ':' : '.'}${member.Name}</span>`;
        
        if (member.MemberType === "Property") {
            html += `${renderHtmlSymbol(": ")}${renderLuaTypeHtml(member.ValueType)}`;
            html += ` ${renderSecurityHtml(member.Security)}`;
            html += ` ${renderSerializationHtml(member.Serialization)}`;
        } else if (member.MemberType === "Function" || member.MemberType === "Event" || member.MemberType === "Callback") {
            html += renderParametersHtml(member.Parameters);
            if (member.MemberType === "Function" || member.MemberType === "Callback") {
                html += ` ${renderHtmlSymbol("->")} ${renderLuaTypeHtml(member.ReturnType)}`;
            }
            html += ` ${renderSecurityHtml(member.Security)}`;
        }
        html += ` ${renderTagsHtml(member.Tags)}`;
        if (member.ThreadSafety) {
             let tsValue = typeof member.ThreadSafety === 'object' ? member.ThreadSafety.Value : member.ThreadSafety;
             if(tsValue && tsValue !== "Unknown") html += ` <span class="ThreadSafety">[${tsValue}]</span>`;
        }
        html += `</div>`;
        return html;
    }
    function generateApiHtml(apiData) { 
        if (!apiData || (!apiData.Classes && !apiData.Enums)) return "<p>No API data to display.</p>";
        let html = ""; 
        (apiData.Classes || []).sort((a,b) => a.Name.localeCompare(b.Name)).forEach(classDesc => {
            const isDeprecated = classDesc.Tags && classDesc.Tags.includes("Deprecated");
            html += `<div class="Class ${isDeprecated ? "deprecated" : ""}">`;
            html += `<span class="DescriptorType Class">Class</span> <span class="Name">${classDesc.Name}</span>`;
            if (classDesc.Superclass && classDesc.Superclass !== "<<<ROOT>>>") {
                html += ` ${renderHtmlSymbol(":")} <span class="Superclass">${classDesc.Superclass}</span>`;
            }
            html += ` ${renderSecurityHtml(classDesc.Security)}`; 
            html += ` ${renderTagsHtml(classDesc.Tags)}`;
            html += `</div>`;
            (classDesc.Members || []).sort((a,b) => (a.MemberType||"").localeCompare(b.MemberType||"") || a.Name.localeCompare(b.Name))
                             .forEach(member => html += renderMemberHtml(member, classDesc.Name));
        });
        (apiData.Enums || []).sort((a,b) => a.Name.localeCompare(b.Name)).forEach(enumDesc => {
            const isDeprecated = enumDesc.Tags && enumDesc.Tags.includes("Deprecated");
            html += `<div class="Enum ${isDeprecated ? "deprecated" : ""}">`;
            html += `<span class="DescriptorType Enum">Enum</span> <span class="Name">${enumDesc.Name}</span>`;
            html += ` ${renderTagsHtml(enumDesc.Tags)}`;
            html += `</div>`;
            (enumDesc.Items || []).sort((a,b) => a.Value - b.Value).forEach(item => {
                 const itemDeprecated = item.Tags && item.Tags.includes("Deprecated");
                 html += `<div class="child EnumItem ${itemDeprecated ? "deprecated" : ""}">`;
                 html += `<span class="DescriptorType EnumItem">EnumItem</span> <span class="Name">${enumDesc.Name}.${item.Name}</span>`;
                 html += ` ${renderHtmlSymbol(":")} <span class="Value">${item.Value}</span>`;
                 html += ` ${renderTagsHtml(item.Tags)}`;
                 html += `</div>`;
            });
        });
        return html || "<p>No classes or enums found in API data.</p>";
    }
    function generateApiTxt(apiData) { 
        if (!apiData) return "No API data to display.";
        let txt = "";
        // ... (Simplified TXT generation as before) ...
        (apiData.Classes || []).forEach(c => txt += `Class ${c.Name}\n`);
        (apiData.Enums || []).forEach(e => txt += `Enum ${e.Name}\n`);
        return txt || "No classes or enums found.";
    }

    // --- Display Logic (Single API or Diff) ---
    function displayData(content, format, isDiff = false) {
        if (downloadPngButton) downloadPngButton.disabled = format !== "HTML" || !content;
        if (outputDisplay) outputDisplay.style.display = (format === "TXT" || format === "JSON") ? 'block' : 'none';
        if (htmlOutputDisplay) htmlOutputDisplay.style.display = format === "HTML" ? 'block' : 'none';

        if (format === "HTML" && htmlOutputDisplay) htmlOutputDisplay.innerHTML = content || "";
        else if (outputDisplay) outputDisplay.textContent = content || "";

        if (!content && !isDiff) setStatus("No data to display.", true);
    }
    
    // --- API Diffing Logic ---
    function mapByName(items = []) { return new Map(items.map(i => [i.Name, i]));}
    function compareSimpleValue(oldVal, newVal, changeList, propertyName, context = null) {
        const oldStr = String(oldVal !== undefined ? oldVal : "");
        const newStr = String(newVal !== undefined ? newVal : "");
        if (oldStr !== newStr) {
            changeList.push({ type: 'changedValue', property: propertyName, from: oldVal, to: newVal, context });
            return true;
        } return false;
    }
    function compareTags(oldTags = [], newTags = [], changeList, context = null) {
        const oldSet = new Set(oldTags); const newSet = new Set(newTags); let changed = false;
        oldTags.forEach(t => { if (!newSet.has(t)) { changeList.push({ type: 'removedTag', tag: t, context }); changed = true; }});
        newTags.forEach(t => { if (!oldSet.has(t)) { changeList.push({ type: 'addedTag', tag: t, context }); changed = true; }});
        return changed;
    }
    function compareSecurity(oldSec, newSec, changeList, context = null) {
        const oldStr = JSON.stringify(oldSec || null); const newStr = JSON.stringify(newSec || null);
        if (oldStr !== newStr) { changeList.push({ type: 'changedSecurity', from: oldSec, to: newSec, context }); return true; }
        return false;
    }
    function compareLuaType(oldType, newType, changeList, context = null) {
        const oldStr = JSON.stringify(oldType || null); const newStr = JSON.stringify(newType || null);
        if (oldStr !== newStr) { changeList.push({ type: 'changedLuaType', property: context, from: oldType, to: newType }); return true; }
        return false;
    }
    function compareParameters(oldP = [], newP = [], changeList, context = null) { // Simplified
        const oldStr = JSON.stringify(oldP.map(p=>({N:p.Name, T:p.Type.Name, D:p.Default}))); 
        const newStr = JSON.stringify(newP.map(p=>({N:p.Name, T:p.Type.Name, D:p.Default})));
        if (oldStr !== newStr) { changeList.push({ type: 'changedParametersDetail', from: oldP, to: newP, context }); return true; }
        return false;
    }
    function compareSerialization(oldS, newS, changeList, context = null) {
        const oldStr = JSON.stringify(oldS || null); const newStr = JSON.stringify(newS || null);
        if (oldStr !== newStr) { changeList.push({ type: 'changedSerialization', from: oldS, to: newS, context }); return true; }
        return false;
    }
    function diffMembers(oldMembers = [], newMembers = [], className) {
        const mapOld = mapByName(oldMembers); const mapNew = mapByName(newMembers);
        const diff = { added: [], removed: [], changed: [] };
        mapNew.forEach((newM, name) => {
            const oldM = mapOld.get(name);
            if (!oldM) diff.added.push(newM);
            else if (oldM.MemberType !== newM.MemberType) { // Type change = remove old, add new
                diff.removed.push(oldM); diff.added.push(newM);
            } else {
                const changes = [];
                compareTags(oldM.Tags, newM.Tags, changes, "Tags");
                compareSecurity(oldM.Security, newM.Security, changes, "Security");
                compareSimpleValue(oldM.ThreadSafety, newM.ThreadSafety, changes, "ThreadSafety");
                if (newM.MemberType === "Property") { /* compare ValueType, Serialization, Category */ }
                else if (newM.MemberType === "Function" || newM.MemberType === "Callback") { /* compare ReturnType, Parameters */ }
                else if (newM.MemberType === "Event") { /* compare Parameters */ }
                if (changes.length > 0) diff.changed.push({ name, memberType: newM.MemberType, oldMember: oldM, newMember: newM, changes });
            }
        });
        mapOld.forEach((oldM, name) => { if (!mapNew.has(name)) diff.removed.push(oldM); });
        return diff;
    }
    function diffEnumItems(oldItems = [], newItems = [], enumName) {
        const mapOld = mapByName(oldItems); const mapNew = mapByName(newItems);
        const diff = { added: [], removed: [], changed: [] };
        mapNew.forEach((newI, name) => {
            const oldI = mapOld.get(name);
            if (!oldI) diff.added.push(newI);
            else {
                const changes = [];
                compareSimpleValue(oldI.Value, newI.Value, changes, "Value");
                compareTags(oldI.Tags, newI.Tags, changes, "Tags");
                if (changes.length > 0) diff.changed.push({ name, oldItem: oldI, newItem: newI, changes });
            }
        });
        mapOld.forEach((oldI, name) => { if (!mapNew.has(name)) diff.removed.push(oldI); });
        return diff;
    }
    function generateDiff(oldApiData, newApiData) {
        const diffResult = { classes: { added: [], removed: [], changed: [] }, enums: { added: [], removed: [], changed: [] } };
        if (!oldApiData || !newApiData) return diffResult;
        const oldCMap = mapByName(oldApiData.Classes); const newCMap = mapByName(newApiData.Classes);
        newCMap.forEach((newC, name) => {
            const oldC = oldCMap.get(name);
            if (!oldC) diffResult.classes.added.push(newC);
            else {
                const changes = [];
                compareSimpleValue(oldC.Superclass, newC.Superclass, changes, "Superclass");
                compareTags(oldC.Tags, newC.Tags, changes, "Class.Tags");
                compareSecurity(oldC.Security, newC.Security, changes, "Class.Security");
                const memberDiff = diffMembers(oldC.Members, newC.Members, name);
                if (changes.length > 0 || memberDiff.added.length || memberDiff.removed.length || memberDiff.changed.length) {
                    diffResult.classes.changed.push({ name, oldClass: oldC, newClass: newC, changes, memberDiff });
                }
            }
        });
        oldCMap.forEach((oldC, name) => { if (!newCMap.has(name)) diffResult.classes.removed.push(oldC); });
        // ... similar logic for enums ...
        const oldEMap = mapByName(oldApiData.Enums); const newEMap = mapByName(newApiData.Enums);
        newEMap.forEach((newE, name) => { /* ... */ });
        oldEMap.forEach((oldE, name) => { if (!newEMap.has(name)) diffResult.enums.removed.push(oldE); });
        return diffResult;
    }

    // --- Diff Rendering Logic ---
    function getDiffClass(changeType = "") { /* ... as before ... */ return 'Changed'; }
    function renderChangeEntryHtml(change) { /* ... as before, ensure robustness ... */ return `<div>${JSON.stringify(change)}</div>`; }
    function generateDiffHtml(diffResult, oldApiData, newApiData) { /* ... as before, ensure robustness ... */ return "<p>Diff HTML (see console for structure)</p>"; }
    function generateDiffTxt(diffResult, oldApiData, newApiData) { /* ... as before, ensure robustness ... */ return "Diff TXT (see console for structure)"; }

    // --- Event Listeners ---
    if (viewApiDumpButton) viewApiDumpButton.addEventListener('click', async () => {
        const versionAGuid = versionADropdown.value;
        const selectedFormat = apiDumpFormatDropdown.value;
        const isFullDump = fullDumpCheckbox.checked;
        if (!versionAGuid) { setStatus("Please select Version A.", true); return; }
        const apiData = await fetchApiDump(versionAGuid, isFullDump, "Version A");
        const content = apiData ? (selectedFormat === "HTML" ? generateApiHtml(apiData) : 
                               (selectedFormat === "TXT" ? generateApiTxt(apiData) : 
                                JSON.stringify(apiData, null, 2))) 
                      : "Failed to load API data.";
        displayData(content, selectedFormat);
    });

    if (compareVersionsButton) compareVersionsButton.addEventListener('click', async () => {
        const versionAGuid = versionADropdown.value; 
        const versionBGuid = versionBDropdown.value; 
        const selectedFormat = apiDumpFormatDropdown.value;
        const isFullDump = fullDumpCheckbox.checked;

        if (!versionAGuid || !versionBGuid) { setStatus("Select versions for A and B.", true); return; }
        if (versionAGuid === versionBGuid) { setStatus("Versions A and B must be different.", true); return; }

        setStatus(`Comparing ${versionAGuid} (Newer) with ${versionBGuid} (Older)`);
        toggleLoading(true);

        const newApiData = await fetchApiDump(versionAGuid, isFullDump, "Version A (Newer)");
        if (!newApiData) { toggleLoading(false); return; }
        const oldApiData = await fetchApiDump(versionBGuid, isFullDump, "Version B (Older)");
        if (!oldApiData) { toggleLoading(false); return; }

        const diffResult = generateDiff(oldApiData, newApiData);
        setStatus("Diff generated. Displaying results.");
        console.log("Generated Diff Object:", diffResult); // Log the actual diff object
        
        let diffContent = "";
        if (selectedFormat === "HTML") {
            diffContent = generateDiffHtml(diffResult, oldApiData, newApiData);
        } else if (selectedFormat === "TXT") {
            diffContent = generateDiffTxt(diffResult, oldApiData, newApiData);
        } else { 
            diffContent = JSON.stringify(diffResult, null, 2);
        }
        displayData(diffContent, selectedFormat, true); 
        toggleLoading(false);
    });

    if (apiDumpFormatDropdown) apiDumpFormatDropdown.addEventListener('change', (event) => {
        const selectedFormat = event.target.value;
        if (event.isTrusted) { 
            displayData("Select an action to view data.", selectedFormat);
            setStatus(`Format changed to ${selectedFormat}. Select an action.`);
        }
        if (downloadPngButton) downloadPngButton.disabled = selectedFormat !== "HTML";
    });
    
    function initializeUI() {
        if (apiDumpFormatDropdown) apiDumpFormatDropdown.dispatchEvent(new Event('change')); 
        setStatus("Ready");
        fetchAndParseDeployHistory(); 
    }

    if (downloadPngButton) downloadPngButton.addEventListener('click', async () => {
        if (!htmlOutputDisplay || htmlOutputDisplay.style.display === 'none' || htmlOutputDisplay.innerHTML.trim() === '') {
            setStatus("No HTML to render. View API dump/diff in HTML first.", true); return;
        }
        if (typeof html2canvas === 'undefined') {
            setStatus("html2canvas library not loaded.", true); return;
        }
        setStatus("Rendering HTML to PNG...");
        toggleLoading(true, "Rendering PNG...");
        try {
            const canvas = await html2canvas(htmlOutputDisplay, { scale: 1.5, backgroundColor: '#151515', logging: true });
            const dataUrl = canvas.toDataURL('image/png');
            const link = Object.assign(document.createElement('a'), { href: dataUrl, download: 'api-dump-diff.png' });
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setStatus("PNG download initiated.");
        } catch (error) {
            setStatus(`Error generating PNG: ${error.message}`, true);
        } finally {
            toggleLoading(false);
        }
    });

    initializeUI();
});
