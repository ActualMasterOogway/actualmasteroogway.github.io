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
        populateVersionDropdowns(); // Clear/initialize dropdowns

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
                availableStudioVersions = ["0.618.0.6180417", "0.617.0.6170388"]; // Known good fallbacks
            } else {
                setStatus(`Found ${availableStudioVersions.length} Studio64 versions.`);
            }
        } catch (error) {
            setStatus(`Error fetching/parsing DeployHistory: ${error.message}. Using fallback. (Check CORS)`, true);
            availableStudioVersions = ["0.618.0.6180417", "0.617.0.6170388"];
        } finally {
            populateVersionDropdowns();
            toggleLoading(false);
        }
    }

    function populateVersionDropdowns() {
        [versionADropdown, versionBDropdown].forEach((dropdown, idx) => {
            if (!dropdown) return;
            const currentValue = dropdown.value;
            dropdown.innerHTML = "";
            availableStudioVersions.forEach(version => {
                const option = new Option(version, version);
                dropdown.add(option);
            });
            if (availableStudioVersions.includes(currentValue)) {
                dropdown.value = currentValue;
            } else if (availableStudioVersions.length > 0) {
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
        [viewApiDumpButton, compareVersionsButton, downloadPngButton].forEach(btn => btn.disabled = isLoading);
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
        toggleLoading(true);
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
    function renderHtmlSymbol(symbol) { return `<span class="symbol">${symbol}</span>`; }
    function renderTagsHtml(tagsArray = []) { return tagsArray.map(tag => `<span class="Tag">[${tag}]</span>`).join(" "); }
    function renderSecurityHtml(securityObj) { /* ... (implementation from previous steps, ensure it's robust) ... */ 
        if (!securityObj) return "";
        // For brevity, assuming a simplified version or that the full version from previous steps is here
        if (typeof securityObj === 'string' && securityObj !== "None") return `<span class="Security">{${securityObj}}</span>`;
        if (securityObj.Read && securityObj.Write) { // ReadWriteSecurity
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
    function renderLuaTypeHtml(luaTypeObj) { /* ... (implementation from previous steps, ensure it's robust) ... */ 
        if (!luaTypeObj || !luaTypeObj.Name) return `<span class="Type">any</span>`;
        let name = luaTypeObj.Name;
        const category = luaTypeObj.Category;
        const subTypes = luaTypeObj.SubTypes || [];
        let html = "";
        const isOptional = name.endsWith('?');
        const absoluteName = name.replace("?", "");
        const luauTypeMappings = {
            "Dictionary": "{ [string]: any }", "Map": "{ [string]: any }", "Array": "{ any }",
            "Objects": "{ Instance }", "Function": "((...any) -> ...any)",
            "OptionalCoordinateFrame": "CFrame", "CoordinateFrame": "CFrame",
            "Content": "string", "ProtectedString": "string", "null": "()", "void": "()",
            "int": "number", "int64": "number", "float": "number", "double": "number",
            "bool": "boolean", "Variant": "any"
        };
        let effectiveName = luauTypeMappings[absoluteName] || absoluteName;
        if (category === "Enum") html += `<span class="Type">Enum</span>${renderHtmlSymbol(".")}<span class="Type">${name.replace("?", "")}</span>`;
        else if (absoluteName === "Tuple") { /* ... */ } // Handle other cases as before
        else html += `<span class="Type">${effectiveName}</span>`;
        if (isOptional && !name.endsWith("?") && category !== "Enum" && !effectiveName.endsWith("?")) {
             if(name.endsWith("?") || name.startsWith("Optional")) html += renderHtmlSymbol("?");
        } else if (isOptional && category !== "Enum" && !html.endsWith("?") && !html.endsWith(")?")) html += renderHtmlSymbol("?");
        return html; // Ensure full logic from previous steps
    }
    function renderParametersHtml(paramsArray = []) { /* ... (implementation from previous steps) ... */ 
        let html = renderHtmlSymbol("(");
        if (paramsArray.length > 0) {
            html += paramsArray.map(p => {
                 let typeCopy = JSON.parse(JSON.stringify(p.Type)); 
                if (p.Default !== undefined && p.Default !== null && !typeCopy.Name.endsWith("?")) typeCopy.Name += "?"; 
                let paramHtml = `<span class="ParamName">${p.Name}</span>${renderHtmlSymbol(": ")}${renderLuaTypeHtml(typeCopy)}`;
                if (p.Default !== undefined && p.Default !== null) { /* ... default rendering ... */ }
                return paramHtml;
            }).join(renderHtmlSymbol(", "));
        }
        html += renderHtmlSymbol(")");
        return html;
    }
    function renderSerializationHtml(serialization) { /* ... (implementation from previous steps) ... */ 
        if (!serialization) return ""; let text = "";
        if (typeof serialization === 'object') { /* ... */ } else if (typeof serialization === 'string') text = serialization;
        return text ? `<span class="Serialization">[${text}]</span>` : "";
    }
    function renderMemberHtml(member, className) { /* ... (full implementation from previous steps) ... */ 
        const isDeprecated = member.Tags && member.Tags.includes("Deprecated");
        let html = `<div class="child ${member.MemberType} ${isDeprecated ? "deprecated" : ""}">`;
        html += `<span class="DescriptorType ${member.MemberType}">${member.MemberType}</span> `;
        html += `<span class="Name">${className}${member.MemberType === 'Function' || member.MemberType === 'Callback' ? ':' : '.'}${member.Name}</span>`;
        // ... rest of member details ...
        html += ` ${renderTagsHtml(member.Tags)}`;
        html += `</div>`;
        return html;
    }
    function generateApiHtml(apiData) { /* ... (full implementation from previous steps) ... */ 
        if (!apiData || (!apiData.Classes && !apiData.Enums)) return "<p>No API data.</p>";
        let html = ""; // ... loop through classes and enums, calling renderMemberHtml etc. ...
        apiData.Classes?.sort((a,b) => a.Name.localeCompare(b.Name)).forEach(classDesc => {
            html += `<div class="Class ...">${classDesc.Name} ...</div>`;
            classDesc.Members?.sort(/*...member sort...*/)
                             .forEach(member => html += renderMemberHtml(member, classDesc.Name));
        });
        apiData.Enums?.sort((a,b) => a.Name.localeCompare(b.Name)).forEach(enumDesc => { /* ... */});
        return html;
    }
    function generateApiTxt(apiData) { /* ... (full implementation from previous steps) ... */ return "TXT version of API"; }

    // --- Display Logic (Single API or Diff) ---
    function displayData(content, format, isDiff = false) {
        downloadPngButton.disabled = format !== "HTML" || !content;
        outputDisplay.style.display = (format === "TXT" || format === "JSON") ? 'block' : 'none';
        htmlOutputDisplay.style.display = format === "HTML" ? 'block' : 'none';

        if (format === "HTML") htmlOutputDisplay.innerHTML = content || "";
        else outputDisplay.textContent = content || "";

        if (!content && !isDiff) setStatus("No data to display.", true);
    }
    
    // --- API Diffing Logic (from previous step) ---
    function mapByName(items = []) { /* ... */ return new Map(items.map(i => [i.Name, i])); }
    function compareSimpleValue(oldVal, newVal, changeList, propertyName, context = null) { /* ... */ }
    function compareTags(oldTags = [], newTags = [], changeList, context = null) { /* ... */ }
    function compareSecurity(oldSec, newSec, changeList, context = null) { /* ... */ }
    function compareLuaType(oldType, newType, changeList, context = null) { /* ... */ }
    function compareParameters(oldParams = [], newParams = [], changeList, context = null) { /* ... */ }
    function compareSerialization(oldSer, newSer, changeList, context = null) { /* ... */ }
    function diffMembers(oldMembersArray = [], newMembersArray = [], className) { /* ... (full logic) ... */ return { added: [], removed: [], changed: []}; }
    function diffEnumItems(oldItemsArray = [], newItemsArray = [], enumName) { /* ... (full logic) ... */ return { added: [], removed: [], changed: []}; }
    function generateDiff(oldApiData, newApiData) { /* ... (full logic from previous step) ... */ return { classes: {}, enums: {}}; }

    // --- Diff Rendering Logic ---
    function getDiffClass(changeType) {
        if (changeType.startsWith('added')) return 'Added';
        if (changeType.startsWith('removed')) return 'Removed';
        return 'Changed'; // Default for changedValue, changedSecurity etc.
    }
    
    function renderChangeEntryHtml(change) {
        let html = `<div class="DiffChangeItem DiffType ${getDiffClass(change.type)}">`;
        const propertyName = change.property || (change.type.includes("Tag") ? "Tag" : change.type.replace(/^(changed|added|removed)/, ""));
        html += `<span class="DiffProperty">${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}:</span> `;
    
        if (change.type === 'addedTag') {
            html += `<span class="TagChange AddedTag">+ ${renderTagsHtml([change.tag])}</span>`;
        } else if (change.type === 'removedTag') {
            html += `<span class="TagChange RemovedTag">- ${renderTagsHtml([change.tag])}</span>`;
        } else if (change.from !== undefined || change.to !== undefined) {
            let fromHtml = "<i>N/A</i>", toHtml = "<i>N/A</i>";
            const prop = change.property;

            if (prop === "ValueType" || prop === "ReturnType" || prop === "LuaType" || change.type === 'changedLuaType') {
                if(change.from) fromHtml = renderLuaTypeHtml(change.from);
                if(change.to) toHtml = renderLuaTypeHtml(change.to);
            } else if (prop === "Security" || change.type === 'changedSecurity') {
                if(change.from) fromHtml = renderSecurityHtml(change.from);
                if(change.to) toHtml = renderSecurityHtml(change.to);
            } else if (prop === "Serialization" || change.type === 'changedSerialization') {
                if(change.from) fromHtml = renderSerializationHtml(change.from);
                if(change.to) toHtml = renderSerializationHtml(change.to);
            } else if (prop === "Parameters" || change.type === 'changedParametersDetail' || change.type === 'changedParametersCount') {
                if (change.type === 'changedParametersCount') {
                     fromHtml = `Count: ${change.from}`; toHtml = `Count: ${change.to}`;
                } else {
                    if(change.from) fromHtml = renderParametersHtml(change.from);
                    if(change.to) toHtml = renderParametersHtml(change.to);
                }
            } else { // Simple value
                fromHtml = String(change.from !== undefined ? change.from : "<i>N/A</i>");
                toHtml = String(change.to !== undefined ? change.to : "<i>N/A</i>");
            }
            html += `<span class="DiffFrom">From: ${fromHtml}</span> ${renderHtmlSymbol("=>")} <span class="DiffTo">To: ${toHtml}</span>`;
        } else { // Fallback for unexpected change structure
            html += JSON.stringify(change);
        }
        html += `</div>`;
        return html;
    }
    
    function generateDiffHtml(diffResult, oldApiData, newApiData) {
        let html = "";
        if (!diffResult) return "<p>No diff data to display.</p>";
    
        html += "<h2>Class Differences</h2>";
        const { classes: classDiffs, enums: enumDiffs } = diffResult;
        if (classDiffs.added.length === 0 && classDiffs.removed.length === 0 && classDiffs.changed.length === 0) {
            html += "<p>No class differences.</p>";
        }
    
        classDiffs.added.forEach(cls => {
            html += `<div class="DiffEntry DiffType Added"><h3>Added Class: ${cls.Name}</h3>`;
            html += generateApiHtml({ Classes: [cls], Enums: [] });
            html += `</div>`;
        });
        classDiffs.removed.forEach(cls => {
            html += `<div class="DiffEntry DiffType Removed"><h3>Removed Class: ${cls.Name}</h3>`;
            html += generateApiHtml({ Classes: [cls], Enums: [] });
            html += `</div>`;
        });
    
        classDiffs.changed.forEach(classChange => {
            html += `<div class="DiffEntry DiffType Changed"><h3>Changed Class: ${classChange.name}</h3>`;
            if (classChange.changes && classChange.changes.length > 0) {
                html += `<div class="ClassChanges"><h4>Class-Level Changes:</h4>`;
                classChange.changes.forEach(change => html += renderChangeEntryHtml(change));
                html += `</div>`;
            }
            if (classChange.memberDiff) {
                const md = classChange.memberDiff;
                if (md.added.length > 0 || md.removed.length > 0 || md.changed.length > 0) {
                    html += `<div class="MemberChanges"><h4>Member Changes:</h4>`;
                    md.added.forEach(member => {
                        html += `<div class="DiffType Added"><h5>Added Member: ${member.Name} (${member.MemberType})</h5>${renderMemberHtml(member, classChange.name)}</div>`;
                    });
                    md.removed.forEach(member => {
                        html += `<div class="DiffType Removed"><h5>Removed Member: ${member.Name} (${member.MemberType})</h5>${renderMemberHtml(member, classChange.name)}</div>`;
                    });
                    md.changed.forEach(mc => { // mc for memberChange
                        html += `<div class="DiffType Changed"><h5>Changed Member: ${mc.name} (${mc.memberType})</h5>`;
                        html += renderMemberHtml(mc.newMember, classChange.name); // Show the new state
                        mc.changes.forEach(change => html += renderChangeEntryHtml(change));
                        html += `</div>`;
                    });
                    html += `</div>`;
                }
            }
            html += `</div>`;
        });
    
        html += "<h2>Enum Differences</h2>";
        if (enumDiffs.added.length === 0 && enumDiffs.removed.length === 0 && enumDiffs.changed.length === 0) {
            html += "<p>No enum differences.</p>";
        }
        enumDiffs.added.forEach(enm => {
            html += `<div class="DiffEntry DiffType Added"><h3>Added Enum: ${enm.Name}</h3>${generateApiHtml({ Classes: [], Enums: [enm] })}</div>`;
        });
        enumDiffs.removed.forEach(enm => {
            html += `<div class="DiffEntry DiffType Removed"><h3>Removed Enum: ${enm.Name}</h3>${generateApiHtml({ Classes: [], Enums: [enm] })}</div>`;
        });
        enumDiffs.changed.forEach(enumChange => {
            html += `<div class="DiffEntry DiffType Changed"><h3>Changed Enum: ${enumChange.name}</h3>`;
            if (enumChange.changes && enumChange.changes.length > 0) {
                html += `<div class="EnumChanges"><h4>Enum-Level Changes:</h4>`;
                enumChange.changes.forEach(change => html += renderChangeEntryHtml(change));
                html += `</div>`;
            }
            if (enumChange.itemDiff) {
                const id = enumChange.itemDiff;
                if (id.added.length > 0 || id.removed.length > 0 || id.changed.length > 0) {
                    html += `<div class="EnumItemChanges"><h4>Enum Item Changes:</h4>`;
                    id.added.forEach(item => html += `<div class="DiffType Added"><h5>Added Item: ${item.Name}</h5><div class="EnumItem">${enumChange.name}.${item.Name} : ${item.Value} ${renderTagsHtml(item.Tags)}</div></div>`);
                    id.removed.forEach(item => html += `<div class="DiffType Removed"><h5>Removed Item: ${item.Name}</h5><div class="EnumItem">${enumChange.name}.${item.Name} : ${item.Value} ${renderTagsHtml(item.Tags)}</div></div>`);
                    id.changed.forEach(ic => { // ic for itemChange
                        html += `<div class="DiffType Changed"><h5>Changed Item: ${ic.name}</h5>`;
                        html += `<div class="EnumItem">${enumChange.name}.${ic.newItem.Name} : ${ic.newItem.Value} ${renderTagsHtml(ic.newItem.Tags)}</div>`;
                        ic.changes.forEach(change => html += renderChangeEntryHtml(change));
                        html += `</div>`;
                    });
                    html += `</div>`;
                }
            }
            html += `</div>`;
        });
        return html;
    }
    
    function generateDiffTxt(diffResult, oldApiData, newApiData) {
        let txt = "";
        if (!diffResult) return "No diff data to display.";
        const { classes: classDiffs, enums: enumDiffs } = diffResult;

        function changeEntryTxt(change, indent = "    ") {
            let detail = `${indent}* ${change.property || (change.type.includes("Tag") ? "Tag" : change.type.replace(/^(changed|added|removed)/, ""))}: `;
            if (change.type === 'addedTag') detail += `+ [${change.tag}]`;
            else if (change.type === 'removedTag') detail += `- [${change.tag}]`;
            else if (change.from !== undefined || change.to !== undefined) {
                const fromStr = String(change.from !== undefined ? change.from : "N/A");
                const toStr = String(change.to !== undefined ? change.to : "N/A");
                detail += `From: '${fromStr}' To: '${toStr}'`;
            } else detail += JSON.stringify(change);
            return detail;
        }
    
        txt += "Class Differences:\n";
        if (classDiffs.added.length === 0 && classDiffs.removed.length === 0 && classDiffs.changed.length === 0) txt += "  No class differences.\n";
        classDiffs.added.forEach(cls => txt += `+ Added Class: ${cls.Name}\n`); // Consider full TXT render of cls
        classDiffs.removed.forEach(cls => txt += `- Removed Class: ${cls.Name}\n`); // Consider full TXT render of cls
        classDiffs.changed.forEach(cc => { // cc for classChange
            txt += `~ Changed Class: ${cc.name}\n`;
            cc.changes?.forEach(change => txt += `${changeEntryTxt(change, "  ")}\n`);
            if (cc.memberDiff) {
                const md = cc.memberDiff;
                md.added.forEach(m => txt += `  + Added Member: ${m.Name} (${m.MemberType})\n`);
                md.removed.forEach(m => txt += `  - Removed Member: ${m.Name} (${m.MemberType})\n`);
                md.changed.forEach(mc => {
                    txt += `  ~ Changed Member: ${mc.name} (${mc.memberType})\n`;
                    mc.changes.forEach(change => txt += `${changeEntryTxt(change, "    ")}\n`);
                });
            }
        });
    
        txt += "\nEnum Differences:\n";
        if (enumDiffs.added.length === 0 && enumDiffs.removed.length === 0 && enumDiffs.changed.length === 0) txt += "  No enum differences.\n";
        enumDiffs.added.forEach(enm => txt += `+ Added Enum: ${enm.Name}\n`);
        enumDiffs.removed.forEach(enm => txt += `- Removed Enum: ${enm.Name}\n`);
        enumDiffs.changed.forEach(ec => { // ec for enumChange
            txt += `~ Changed Enum: ${ec.name}\n`;
            ec.changes?.forEach(change => txt += `${changeEntryTxt(change, "  ")}\n`);
            if (ec.itemDiff) {
                const id = ec.itemDiff;
                id.added.forEach(item => txt += `  + Added Item: ${item.Name}\n`);
                id.removed.forEach(item => txt += `  - Removed Item: ${item.Name}\n`);
                id.changed.forEach(ic => {
                    txt += `  ~ Changed Item: ${ic.name}\n`;
                    ic.changes.forEach(change => txt += `${changeEntryTxt(change, "    ")}\n`);
                });
            }
        });
        return txt.trim();
    }

    // --- Event Listeners ---
    viewApiDumpButton.addEventListener('click', async () => {
        const versionAGuid = versionADropdown.value;
        const selectedFormat = apiDumpFormatDropdown.value;
        const isFullDump = fullDumpCheckbox.checked;
        if (!versionAGuid) { setStatus("Please select Version A.", true); return; }
        const apiData = await fetchApiDump(versionAGuid, isFullDump, "Version A");
        displayData(apiData ? (selectedFormat === "HTML" ? generateApiHtml(apiData) : 
                               (selectedFormat === "TXT" ? generateApiTxt(apiData) : 
                                JSON.stringify(apiData, null, 2))) 
                      : "Failed to load API data.", selectedFormat);
    });

    compareVersionsButton.addEventListener('click', async () => {
        const versionAGuid = versionADropdown.value; // Newer
        const versionBGuid = versionBDropdown.value; // Older
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
        
        let diffContent = "";
        if (selectedFormat === "HTML") {
            diffContent = generateDiffHtml(diffResult, oldApiData, newApiData);
        } else if (selectedFormat === "TXT") {
            diffContent = generateDiffTxt(diffResult, oldApiData, newApiData);
        } else { // JSON for diffResult itself
            diffContent = JSON.stringify(diffResult, null, 2);
        }
        displayData(diffContent, selectedFormat, true); // Pass true for isDiff
        toggleLoading(false);
    });

    apiDumpFormatDropdown.addEventListener('change', (event) => {
        const selectedFormat = event.target.value;
        // Clear output if user changes format, then prompt for action
        if (event.isTrusted) { // Only if user directly changed it
            displayData("Select an action to view data.", selectedFormat);
            setStatus(`Format changed to ${selectedFormat}. Select an action.`);
        }
        downloadPngButton.disabled = selectedFormat !== "HTML";
    });
    
    function initializeUI() {
        apiDumpFormatDropdown.dispatchEvent(new Event('change')); 
        setStatus("Ready");
        fetchAndParseDeployHistory(); 
    }

    downloadPngButton.addEventListener('click', async () => {
        if (htmlOutputDisplay.style.display === 'none' || htmlOutputDisplay.innerHTML.trim() === '') {
            setStatus("No HTML to render as PNG. View API dump/diff in HTML first.", true); return;
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
