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
    function renderHtmlSymbol(symbol) { return `<span class="symbol">${symbol}</span>`; }
    function renderTagsHtml(tagsArray = []) { return (tagsArray || []).map(tag => `<span class="Tag">[${tag}]</span>`).join(" "); }
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
        if (category === "Enum") {
            html += `<span class="Type">Enum</span>${renderHtmlSymbol(".")}<span class="Type">${name.replace("?", "")}</span>`;
        } else if (absoluteName === "Tuple") {
            html += renderHtmlSymbol("(");
            if (subTypes.length > 0) {
                html += subTypes.map(st => renderLuaTypeHtml(st)).join(renderHtmlSymbol(", "));
            } else {
                html += `${renderHtmlSymbol("...")}<span class="Type">any</span>`;
            }
            html += renderHtmlSymbol(")");
        } else if (absoluteName === "Array") {
             html += `${renderHtmlSymbol("{")} <span class="Type">any</span> ${renderHtmlSymbol("}")}`;
        } else if (absoluteName === "Dictionary" || absoluteName === "Map") {
             html += `${renderHtmlSymbol("{ [")}<span class="Type">string</span>${renderHtmlSymbol("]: ")}<span class="Type">any</span> ${renderHtmlSymbol("}")}`;
        } else if (absoluteName === "Objects") {
             html += `${renderHtmlSymbol("{ ")}<span class="Type">Instance</span>${renderHtmlSymbol(" }")}`;
        } else if (absoluteName === "Function") {
            if(isOptional && !effectiveName.startsWith('(')) html += renderHtmlSymbol("("); 
            html += `<span class="Type">${effectiveName}</span>`; 
            if(isOptional && !effectiveName.startsWith('(')) html += renderHtmlSymbol(")");
        } else if (absoluteName === "null" || absoluteName === "void") {
            html += renderHtmlSymbol("()");
        } else {
             html += `<span class="Type">${effectiveName}</span>`;
        }
        
        if (isOptional && !html.endsWith("?") && !html.endsWith(")?")) {
             html += renderHtmlSymbol("?");
        }
        return html;
    }
    function renderParametersHtml(paramsArray = []) { 
        let html = renderHtmlSymbol("(");
        if (paramsArray && paramsArray.length > 0) {
            html += paramsArray.map(p => {
                let typeCopy = JSON.parse(JSON.stringify(p.Type)); 
                if (p.Default !== undefined && p.Default !== null && !typeCopy.Name.endsWith("?")) typeCopy.Name += "?"; 
                let paramHtml = `<span class="ParamName">${p.Name}</span>${renderHtmlSymbol(": ")}${renderLuaTypeHtml(typeCopy)}`;
                if (p.Default !== undefined && p.Default !== null) { 
                    let defaultVal = p.Default;
                    const typeAbsoluteName = (typeCopy.AbsoluteName || typeCopy.Name || "").replace("?", "");
                    if ((typeAbsoluteName === "string" || typeCopy.Category === "Enum") && !(String(defaultVal).startsWith('"') && String(defaultVal).endsWith('"'))) {
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
            (classDesc.Members || []).sort((a,b) => ((a.MemberType||"Z").localeCompare(b.MemberType||"Z")) || a.Name.localeCompare(b.Name))
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
        const formatTags = (tags = []) => tags.map(t => `[${t}]`).join(" ");
        const formatSecurity = (sec) => { 
            if (!sec) return "";
            if (typeof sec === 'string' && sec !== "None") return `{${sec}}`;
            if (sec.Read && sec.Write) {
                let s = "";
                if (sec.Read !== "None") s += `{${sec.Read}}`;
                if (sec.Read !== sec.Write && sec.Write !== "None") s += (s ? " " : "") + `{${sec.Write}}`;
                return s;
            }
            if (sec.Type && sec.Type !== "None") return `{${sec.Type}}`;
            return "";
        };
        const formatLuaType = (lt) => lt ? lt.Name : "any";
        const formatParams = (params = []) => `(${(params || []).map(p => `${p.Name}: ${formatLuaType(p.Type)}`).join(", ")})`;

        (apiData.Classes || []).sort((a,b)=>a.Name.localeCompare(b.Name)).forEach(c => {
            txt += `Class ${c.Name}${c.Superclass && c.Superclass !== "<<<ROOT>>>" ? ` : ${c.Superclass}` : ""} ${formatSecurity(c.Security)} ${formatTags(c.Tags)}\n`;
            (c.Members || []).sort((a,b)=>a.Name.localeCompare(b.Name)).forEach(m => {
                txt += `\t${m.MemberType} ${c.Name}${m.MemberType === 'Function' || m.MemberType === 'Callback' ? ':' : '.'}${m.Name}`;
                if (m.MemberType === "Property") txt += `: ${formatLuaType(m.ValueType)}`;
                else if (m.MemberType === "Function" || m.MemberType === "Event" || m.MemberType === "Callback") {
                    txt += formatParams(m.Parameters);
                    if (m.ReturnType) txt += ` -> ${formatLuaType(m.ReturnType)}`;
                }
                txt += ` ${formatSecurity(m.Security)} ${formatTags(m.Tags)}\n`;
            });
            txt += "\n";
        });
        (apiData.Enums || []).sort((a,b)=>a.Name.localeCompare(b.Name)).forEach(e => {
            txt += `Enum ${e.Name} ${formatTags(e.Tags)}\n`;
            (e.Items || []).sort((a,b)=>a.Value - b.Value).forEach(i => {
                txt += `\tEnumItem ${e.Name}.${i.Name} : ${i.Value} ${formatTags(i.Tags)}\n`;
            });
            txt += "\n";
        });
        return txt.trim() || "No classes or enums found.";
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
        const oldSet = new Set(oldTags || []); const newSet = new Set(newTags || []); let changed = false;
        (oldTags || []).forEach(t => { if (!newSet.has(t)) { changeList.push({ type: 'removedTag', tag: t, context }); changed = true; }});
        (newTags || []).forEach(t => { if (!oldSet.has(t)) { changeList.push({ type: 'addedTag', tag: t, context }); changed = true; }});
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
    function compareParameters(oldP = [], newP = [], changeList, context = null) { 
        const oldParams = oldP || []; const newParams = newP || [];
        const oldStr = JSON.stringify(oldParams.map(p=>({N:p.Name, T:p.Type?.Name, D:p.Default}))); 
        const newStr = JSON.stringify(newParams.map(p=>({N:p.Name, T:p.Type?.Name, D:p.Default})));
        if (oldStr !== newStr) { changeList.push({ type: 'changedParametersDetail', from: oldParams, to: newParams, context }); return true; }
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
            if (!oldM) {diff.added.push(newM); return;}
            
            if (oldM.MemberType !== newM.MemberType) { 
                diff.removed.push(oldM); diff.added.push(newM); return;
            }
            const changes = [];
            compareTags(oldM.Tags, newM.Tags, changes, "Tags");
            compareSecurity(oldM.Security, newM.Security, changes, "Security");
            compareSimpleValue(oldM.ThreadSafety, newM.ThreadSafety, changes, "ThreadSafety");

            if (newM.MemberType === "Property") {
                compareLuaType(oldM.ValueType, newM.ValueType, changes, "ValueType");
                compareSerialization(oldM.Serialization, newM.Serialization, changes, "Serialization");
                compareSimpleValue(oldM.Category, newM.Category, changes, "Category");
            } else if (newM.MemberType === "Function" || newM.MemberType === "Callback") {
                compareLuaType(oldM.ReturnType, newM.ReturnType, changes, "ReturnType");
                compareParameters(oldM.Parameters, newM.Parameters, changes, "Parameters");
            } else if (newM.MemberType === "Event") {
                compareParameters(oldM.Parameters, newM.Parameters, changes, "Parameters");
            }
            if (changes.length > 0) diff.changed.push({ name, memberType: newM.MemberType, oldMember: oldM, newMember: newM, changes });
        });
        mapOld.forEach((oldM, name) => { if (!mapNew.has(name)) diff.removed.push(oldM); });
        return diff;
    }
    function diffEnumItems(oldItems = [], newItems = [], enumName) {
        const mapOld = mapByName(oldItems); const mapNew = mapByName(newItems);
        const diff = { added: [], removed: [], changed: [] };
        mapNew.forEach((newI, name) => {
            const oldI = mapOld.get(name);
            if (!oldI) {diff.added.push(newI); return;}
            const changes = [];
            compareSimpleValue(oldI.Value, newI.Value, changes, "Value");
            compareTags(oldI.Tags, newI.Tags, changes, "Tags");
            if (changes.length > 0) diff.changed.push({ name, oldItem: oldI, newItem: newI, changes });
        });
        mapOld.forEach((oldI, name) => { if (!mapNew.has(name)) diff.removed.push(oldI); });
        return diff;
    }

    function generateDiff(oldApiData, newApiData) {
        const diffResult = { 
            classes: { added: [], removed: [], changed: [] }, 
            enums: { added: [], removed: [], changed: [] } 
        };
    
        oldApiData = oldApiData || { Classes: [], Enums: [] };
        newApiData = newApiData || { Classes: [], Enums: [] };
        oldApiData.Classes = oldApiData.Classes || []; oldApiData.Enums = oldApiData.Enums || [];
        newApiData.Classes = newApiData.Classes || []; newApiData.Enums = newApiData.Enums || [];
    
        const oldClassesMap = mapByName(oldApiData.Classes);
        const newClassesMap = mapByName(newApiData.Classes);
        const processedOldClassNames = new Set();
    
        newClassesMap.forEach((newC, className) => {
            const oldC = oldClassesMap.get(className);
            if (!oldC) { 
                diffResult.classes.added.push(newC);
            } else { 
                processedOldClassNames.add(className); 
                const classSpecificChanges = [];
                compareSimpleValue(oldC.Superclass, newC.Superclass, classSpecificChanges, "Superclass");
                compareTags(oldC.Tags, newC.Tags, classSpecificChanges, "Class Tags");
                compareSecurity(oldC.Security, newC.Security, classSpecificChanges, "Class Security");
                
                const memberDiff = diffMembers(oldC.Members, newC.Members, className);
                
                if (classSpecificChanges.length > 0 || 
                    (memberDiff.added && memberDiff.added.length > 0) || 
                    (memberDiff.removed && memberDiff.removed.length > 0) || 
                    (memberDiff.changed && memberDiff.changed.length > 0)) {
                    diffResult.classes.changed.push({ 
                        name: className, 
                        oldClass: oldC, 
                        newClass: newC, 
                        changes: classSpecificChanges, 
                        memberDiff 
                    });
                }
            }
        });
    
        oldClassesMap.forEach((oldC, className) => {
            if (!processedOldClassNames.has(className)) { 
                diffResult.classes.removed.push(oldC);
            }
        });
    
        const oldEnumsMap = mapByName(oldApiData.Enums);
        const newEnumsMap = mapByName(newApiData.Enums);
        const processedOldEnumNames = new Set();
    
        newEnumsMap.forEach((newE, enumName) => {
            const oldE = oldEnumsMap.get(enumName);
            if (!oldE) {
                diffResult.enums.added.push(newE);
            } else {
                processedOldEnumNames.add(enumName);
                const enumSpecificChanges = [];
                compareTags(oldE.Tags, newE.Tags, enumSpecificChanges, "Enum Tags");
                const itemDiff = diffEnumItems(oldE.Items, newE.Items, enumName);
    
                if (enumSpecificChanges.length > 0 ||
                    (itemDiff.added && itemDiff.added.length > 0) ||
                    (itemDiff.removed && itemDiff.removed.length > 0) ||
                    (itemDiff.changed && itemDiff.changed.length > 0)) {
                    diffResult.enums.changed.push({
                        name: enumName,
                        oldEnum: oldE,
                        newEnum: newE,
                        changes: enumSpecificChanges,
                        itemDiff
                    });
                }
            }
        });
    
        oldEnumsMap.forEach((oldE, enumName) => {
            if (!processedOldEnumNames.has(enumName)) {
                diffResult.enums.removed.push(oldE);
            }
        });
        
        return diffResult;
    }

    // --- Diff Rendering Logic ---
    function getDiffClass(changeType = "") { 
        if (changeType.startsWith('added')) return 'Added';
        if (changeType.startsWith('removed')) return 'Removed';
        return 'Changed'; // Default for changedValue, changedSecurity etc.
     }
    function renderChangeEntryHtml(change) { 
        let html = `<div class="DiffChangeItem DiffType ${getDiffClass(change.type)}">`;
        const propertyNameText = change.property || (change.type.includes("Tag") ? "Tag" : change.type.replace(/^(changed|added|removed)/, ""));
        html += `<span class="DiffProperty">${propertyNameText.charAt(0).toUpperCase() + propertyNameText.slice(1)}:</span> `;
        if (change.type === 'addedTag') {
            html += `<span class="TagChange AddedTag">+ ${renderTagsHtml([change.tag])}</span>`;
        } else if (change.type === 'removedTag') {
            html += `<span class="TagChange RemovedTag">- ${renderTagsHtml([change.tag])}</span>`;
        } else if (change.from !== undefined || change.to !== undefined) {
            let fromHtml = "<i>N/A</i>", toHtml = "<i>N/A</i>";
            const prop = change.property; // This is the key for what changed e.g. "Superclass", "ValueType" etc
            if (prop === "ValueType" || prop === "ReturnType" || (change.type === 'changedLuaType' && prop)) {
                if(change.from) fromHtml = renderLuaTypeHtml(change.from); if(change.to) toHtml = renderLuaTypeHtml(change.to);
            } else if (prop === "Security" || change.type === 'changedSecurity') {
                if(change.from) fromHtml = renderSecurityHtml(change.from); if(change.to) toHtml = renderSecurityHtml(change.to);
            } else if (prop === "Serialization" || change.type === 'changedSerialization') {
                if(change.from) fromHtml = renderSerializationHtml(change.from); if(change.to) toHtml = renderSerializationHtml(change.to);
            } else if (prop === "Parameters" || change.type === 'changedParametersDetail' || change.type === 'changedParametersCount') {
                if (change.type === 'changedParametersCount') { fromHtml = `Count: ${change.from}`; toHtml = `Count: ${change.to}`; }
                else { if(change.from) fromHtml = renderParametersHtml(change.from); if(change.to) toHtml = renderParametersHtml(change.to); }
            } else { 
                fromHtml = String(change.from !== undefined ? change.from : "<i>N/A</i>");
                toHtml = String(change.to !== undefined ? change.to : "<i>N/A</i>");
            }
            html += `<span class="DiffFrom">From: ${fromHtml}</span> ${renderHtmlSymbol("=>")} <span class="DiffTo">To: ${toHtml}</span>`;
        } else { html += JSON.stringify(change); } // Fallback
        html += `</div>`;
        return html;
    }
    function generateDiffHtml(diffResult, oldApiData, newApiData) { 
        let html = "";
        if (!diffResult) return "<p>No diff data to display.</p>"; // Should not happen if generateDiff is robust
        const { classes: classDiffs, enums: enumDiffs } = diffResult; // Destructure for easier access
    
        html += "<h2>Class Differences</h2>";
        if (!classDiffs || ((classDiffs.added?.length || 0) === 0 && (classDiffs.removed?.length || 0) === 0 && (classDiffs.changed?.length || 0) === 0)) {
            html += "<p>No class differences.</p>";
        } else {
            (classDiffs.added || []).forEach(cls => { html += `<div class="DiffEntry DiffType Added"><h3>Added Class: ${cls.Name}</h3>${generateApiHtml({ Classes: [cls] })}</div>`; });
            (classDiffs.removed || []).forEach(cls => { html += `<div class="DiffEntry DiffType Removed"><h3>Removed Class: ${cls.Name}</h3>${generateApiHtml({ Classes: [cls] })}</div>`; });
            (classDiffs.changed || []).forEach(cc => { // cc for classChange
                html += `<div class="DiffEntry DiffType Changed"><h3>Changed Class: ${cc.name}</h3>`;
                if (cc.changes && cc.changes.length > 0) { html += `<div class="ClassChanges"><h4>Class-Level Changes:</h4>${cc.changes.map(renderChangeEntryHtml).join('')}</div>`; }
                if (cc.memberDiff) {
                    const md = cc.memberDiff;
                    if ((md.added?.length || 0) > 0 || (md.removed?.length || 0) > 0 || (md.changed?.length || 0) > 0) {
                        html += `<div class="MemberChanges"><h4>Member Changes:</h4>`;
                        (md.added || []).forEach(m => html += `<div class="DiffType Added"><h5>Added Member: ${m.Name} (${m.MemberType})</h5>${renderMemberHtml(m, cc.name)}</div>`);
                        (md.removed || []).forEach(m => html += `<div class="DiffType Removed"><h5>Removed Member: ${m.Name} (${m.MemberType})</h5>${renderMemberHtml(m, cc.name)}</div>`);
                        (md.changed || []).forEach(mc => {
                            html += `<div class="DiffType Changed"><h5>Changed Member: ${mc.name} (${mc.memberType})</h5>${renderMemberHtml(mc.newMember, cc.name)}${mc.changes.map(renderChangeEntryHtml).join('')}</div>`;
                        });
                        html += `</div>`; // Close MemberChanges
                    }
                }
                html += `</div>`; // Close DiffEntry Changed Class
            });
        }
    
        html += "<h2>Enum Differences</h2>";
        if (!enumDiffs || ((enumDiffs.added?.length || 0) === 0 && (enumDiffs.removed?.length || 0) === 0 && (enumDiffs.changed?.length || 0) === 0)) {
            html += "<p>No enum differences.</p>";
        } else {
            (enumDiffs.added || []).forEach(enm => { html += `<div class="DiffEntry DiffType Added"><h3>Added Enum: ${enm.Name}</h3>${generateApiHtml({ Enums: [enm] })}</div>`; });
            (enumDiffs.removed || []).forEach(enm => { html += `<div class="DiffEntry DiffType Removed"><h3>Removed Enum: ${enm.Name}</h3>${generateApiHtml({ Enums: [enm] })}</div>`; });
            (enumDiffs.changed || []).forEach(ec => { // ec for enumChange
                html += `<div class="DiffEntry DiffType Changed"><h3>Changed Enum: ${ec.name}</h3>`;
                if (ec.changes && ec.changes.length > 0) { html += `<div class="EnumChanges"><h4>Enum-Level Changes:</h4>${ec.changes.map(renderChangeEntryHtml).join('')}</div>`; }
                if (ec.itemDiff) {
                    const id = ec.itemDiff;
                    if ((id.added?.length || 0) > 0 || (id.removed?.length || 0) > 0 || (id.changed?.length || 0) > 0) {
                        html += `<div class="EnumItemChanges"><h4>Enum Item Changes:</h4>`;
                        (id.added || []).forEach(item => html += `<div class="DiffType Added"><h5>Added Item: ${item.Name}</h5><div class="EnumItem">${ec.name}.${item.Name} : ${item.Value} ${renderTagsHtml(item.Tags)}</div></div>`);
                        (id.removed || []).forEach(item => html += `<div class="DiffType Removed"><h5>Removed Item: ${item.Name}</h5><div class="EnumItem">${ec.name}.${item.Name} : ${item.Value} ${renderTagsHtml(item.Tags)}</div></div>`);
                        (id.changed || []).forEach(ic => {
                            html += `<div class="DiffType Changed"><h5>Changed Item: ${ic.name}</h5><div class="EnumItem">${ec.name}.${ic.newItem.Name} : ${ic.newItem.Value} ${renderTagsHtml(ic.newItem.Tags)}</div>${ic.changes.map(renderChangeEntryHtml).join('')}</div>`;
                        });
                        html += `</div>`; // Close EnumItemChanges
                    }
                }
                html += `</div>`; // Close DiffEntry Changed Enum
            });
        }
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
        if (!classDiffs || ((classDiffs.added?.length || 0) === 0 && (classDiffs.removed?.length || 0) === 0 && (classDiffs.changed?.length || 0) === 0)) {
            txt += "  No class differences.\n";
        } else {
            (classDiffs.added || []).forEach(cls => txt += `+ Added Class: ${cls.Name}\n`);
            (classDiffs.removed || []).forEach(cls => txt += `- Removed Class: ${cls.Name}\n`);
            (classDiffs.changed || []).forEach(cc => {
                txt += `~ Changed Class: ${cc.name}\n`;
                (cc.changes || []).forEach(change => txt += `${changeEntryTxt(change, "  ")}\n`);
                if (cc.memberDiff) {
                    const md = cc.memberDiff;
                    (md.added || []).forEach(m => txt += `  + Added Member: ${m.Name} (${m.MemberType})\n`);
                    (md.removed || []).forEach(m => txt += `  - Removed Member: ${m.Name} (${m.MemberType})\n`);
                    (md.changed || []).forEach(mc => {
                        txt += `  ~ Changed Member: ${mc.name} (${mc.memberType})\n`;
                        (mc.changes || []).forEach(change => txt += `${changeEntryTxt(change, "    ")}\n`);
                    });
                }
            });
        }
    
        txt += "\nEnum Differences:\n";
        if (!enumDiffs || ((enumDiffs.added?.length || 0) === 0 && (enumDiffs.removed?.length || 0) === 0 && (enumDiffs.changed?.length || 0) === 0)) {
             txt += "  No enum differences.\n";
        } else {
            (enumDiffs.added || []).forEach(enm => txt += `+ Added Enum: ${enm.Name}\n`);
            (enumDiffs.removed || []).forEach(enm => txt += `- Removed Enum: ${enm.Name}\n`);
            (enumDiffs.changed || []).forEach(ec => {
                txt += `~ Changed Enum: ${ec.name}\n`;
                (ec.changes || []).forEach(change => txt += `${changeEntryTxt(change, "  ")}\n`);
                if (ec.itemDiff) {
                    const id = ec.itemDiff;
                    (id.added || []).forEach(item => txt += `  + Added Item: ${item.Name}\n`);
                    (id.removed || []).forEach(item => txt += `  - Removed Item: ${item.Name}\n`);
                    (id.changed || []).forEach(ic => {
                        txt += `  ~ Changed Item: ${ic.name}\n`;
                        (ic.changes || []).forEach(change => txt += `${changeEntryTxt(change, "    ")}\n`);
                    });
                }
            });
        }
        return txt.trim();
    }

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
        if (!newApiData) { toggleLoading(false); setStatus("Failed to fetch new API data.", true); return; } // Added status
        const oldApiData = await fetchApiDump(versionBGuid, isFullDump, "Version B (Older)");
        if (!oldApiData) { toggleLoading(false); setStatus("Failed to fetch old API data.", true); return; } // Added status

        const diffResult = generateDiff(oldApiData, newApiData);
        console.log("Generated Diff Object:", JSON.parse(JSON.stringify(diffResult))); 
        
        let diffContent = "";
        if (selectedFormat === "HTML") {
            diffContent = generateDiffHtml(diffResult, oldApiData, newApiData);
            console.log("Generated HTML Diff Content Length:", diffContent?.length);
        } else if (selectedFormat === "TXT") {
            diffContent = generateDiffTxt(diffResult, oldApiData, newApiData);
            console.log("Generated TXT Diff Content Length:", diffContent?.length);
        } else { 
            diffContent = JSON.stringify(diffResult, null, 2);
            console.log("Generated JSON Diff Content Length:", diffContent?.length);
        }

        if (!diffContent && (selectedFormat === "HTML" || selectedFormat === "TXT")) {
             setStatus("Diff content generation resulted in empty output. Check console.", true);
        } else if (selectedFormat === "JSON" && (!diffResult || Object.keys(diffResult.classes).every(key => (diffResult.classes[key]?.length || 0) === 0) && Object.keys(diffResult.enums).every(key => (diffResult.enums[key]?.length || 0) === 0) )) {
             setStatus("No differences found.", false); // More user-friendly message
        } else {
            setStatus("Diff generated. Displaying results.");
        }
        
        displayData(diffContent, selectedFormat, true); 
        toggleLoading(false);
    });

    if (apiDumpFormatDropdown) apiDumpFormatDropdown.addEventListener('change', (event) => {
        const selectedFormat = event.target.value;
        if (event.isTrusted) { 
            displayData("Select an action to view data.", selectedFormat); // Clear display
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
