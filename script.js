// ==================================================
// 0. IN-LINE ERROR ENGINE
// ==================================================
function showInlineError(inputId, message) {
    // Check if we passed an ID string or an actual HTML element (for dynamic tables)
    const inputField = typeof inputId === 'string' ? document.getElementById(inputId) : inputId;
    if (!inputField) return;

    // 1. Wrap the input so adding text below doesn't break CSS Grid/Tables
    let wrapper = inputField.parentElement;
    if (!wrapper.classList.contains('inline-error-wrapper')) {
        wrapper = document.createElement('div');
        wrapper.className = 'inline-error-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.width = '100%';
        inputField.parentNode.insertBefore(wrapper, inputField);
        wrapper.appendChild(inputField);
    }

    // 2. Clear any existing error message in this wrapper so they don't stack
    const existingError = wrapper.querySelector('.inline-error-text');
    if (existingError) existingError.remove();

    // 3. Apply the Red Border styling to the input box
    inputField.style.border = "1px solid #d32f2f";
    inputField.style.backgroundColor = "#fffcfc";

    // 4. Create and inject the error message text below the input
    const errorMsg = document.createElement('span');
    errorMsg.className = 'inline-error-text';
    errorMsg.innerHTML = message;
    
    Object.assign(errorMsg.style, {
        color: '#d32f2f',
        fontSize: '12px',
        marginTop: '6px',
        textAlign: 'left',
        fontWeight: '600'
    });

    wrapper.appendChild(errorMsg);

    // 5. UX MAGIC: Automatically remove the error state as soon as the user starts typing to fix it!
    inputField.addEventListener('input', function removeError() {
        inputField.style.border = "";
        inputField.style.backgroundColor = "";
        if (errorMsg.parentNode) errorMsg.remove();
        inputField.removeEventListener('input', removeError);
    });
}

/* ==================================================
   1. NAVIGATION & THEME
   ================================================== */
function navigateTo(targetPage, clickedButton) {
    document.getElementById('welcome-view').classList.add('hidden');
    document.getElementById('optimization-view').classList.add('hidden');
    document.getElementById('ridesharing-view').classList.add('hidden');

    document.getElementById(targetPage + '-view').classList.remove('hidden');

    const allButtons = document.querySelectorAll('.button');
    allButtons.forEach(btn => btn.classList.remove('active'));

    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

function toggleTheme() {
    const rootElement = document.documentElement;
    const currentTheme = rootElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        rootElement.setAttribute('data-theme', 'light');
    } else {
        rootElement.setAttribute('data-theme', 'dark');
    }
}

function goHome() {
    document.getElementById('welcome-view').classList.remove('hidden');
    document.getElementById('optimization-view').classList.add('hidden');
    document.getElementById('ridesharing-view').classList.add('hidden');

    const allButtons = document.querySelectorAll('.button');
    allButtons.forEach(btn => btn.classList.remove('active'));
}

/* ==================================================
   2. MAP VISUALIZATION ENGINE
   ================================================== */
let mapA, mapB;
let pathLayerA, pathLayerB;
let nodeLayersA = [], nodeLayersB = [];

function drawVirtualRoute(routeSequence, coordinateData, part) {
    const containerId = part === 'A' ? 'mapContainer' : 'mapContainerB';
    document.getElementById(containerId).style.display = 'block';
    
    let currentMap;

    if (part === 'A') {
        if (!mapA) {
            mapA = L.map(containerId);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapA);
        }
        currentMap = mapA;
        if (pathLayerA) currentMap.removeLayer(pathLayerA);
        nodeLayersA.forEach(marker => currentMap.removeLayer(marker));
        nodeLayersA = [];
    } else {
        if (!mapB) {
            mapB = L.map(containerId);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapB);
        }
        currentMap = mapB;
        if (pathLayerB) currentMap.removeLayer(pathLayerB);
        nodeLayersB.forEach(marker => currentMap.removeLayer(marker));
        nodeLayersB = [];
    }

    let latLngs = [];

    routeSequence.forEach((nodeName, index) => {
        if (!coordinateData[nodeName]) return;
        
        let coords = coordinateData[nodeName];
        let point = [coords.lat, coords.lng]; 
        latLngs.push(point);

        let marker = L.circleMarker(point, {
            radius: 6, fillColor: "#4b7a32", color: "#fff", weight: 2, opacity: 1, fillOpacity: 1
        }).bindPopup(`<b>${nodeName}</b><br>Stop ${index + 1}`).addTo(currentMap);
        
        if (part === 'A') nodeLayersA.push(marker);
        else nodeLayersB.push(marker);
    });

    let newPath = L.polyline(latLngs, {
        color: '#6aab44', weight: 4, dashArray: '5, 10'
    }).addTo(currentMap);

    if (part === 'A') pathLayerA = newPath;
    else pathLayerB = newPath;

    currentMap.fitBounds(newPath.getBounds(), { padding: [40, 40] });
}

/* ==================================================
   3. DATA GENERATION & EXTRACTION
   ================================================== */
function extractDistanceMatrix(containerId, n) {
    const container = document.getElementById(containerId);
    const inputs = container.querySelectorAll('input');
    let matrix = [];
    let k = 0;
    for (let i = 0; i < n; i++) {
        let row = [];
        for (let j = 0; j < n; j++) {
            row.push(parseFloat(inputs[k].value) || 0);
            k++;
        }
        matrix.push(row);
    }
    return matrix;
}

// PART A Generators
// PART A Generators
function generateLocationsTable() {
    const startNode = document.getElementById("startA").value.trim();
    const endNode = document.getElementById("endA").value.trim();
    const budgetStr = document.getElementById("budgetA").value;
    const thresholdStr = document.getElementById("thresholdA").value;
    const countStr = document.getElementById("locationsCount").value;

    let hasError = false;

    // Strict Gatekeeper: Check ALL fields before generating the table
    if (!startNode) { showInlineError("startA", "Required."); hasError = true; }
    if (!endNode) { showInlineError("endA", "Required."); hasError = true; }
    
    if (budgetStr === "") { showInlineError("budgetA", "Required."); hasError = true; } 
    else if (parseFloat(budgetStr) <= 0) { showInlineError("budgetA", "Must be > 0."); hasError = true; }
    
    if (thresholdStr === "") { showInlineError("thresholdA", "Required."); hasError = true; } 
    else if (parseInt(thresholdStr) < 0) { showInlineError("thresholdA", "Cannot be negative."); hasError = true; }
    
    if (countStr === "") { showInlineError("locationsCount", "Required."); hasError = true; } 
    else {
        const locCount = parseInt(countStr);
        if (locCount < 0) { showInlineError("locationsCount", "Cannot be negative."); hasError = true; } 
        else if (locCount === 0) { showInlineError("locationsCount", "Must be at least 1."); hasError = true; }
    }

    if (hasError) return; // Completely block table generation if anything is missing/invalid

    const locCount = parseInt(countStr);
    let html = `<table class="generated-table"><thead><tr><th>Location Name</th><th>Score</th><th>Category</th></tr></thead><tbody>`;
    for (let i = 0; i < locCount; i++) {
        html += `<tr>
            <td><input type="text" placeholder="Location ${i + 1}"></td>
            <td><input type="number" placeholder="Score"></td>
            <td><input type="text" placeholder="Category"></td>
        </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById("locationsTableContainer").innerHTML = html;
}

function generateDistanceMatrixA() {
    const startNode = document.getElementById("startA").value.trim();
    const endNode = document.getElementById("endA").value.trim();
    const countStr = document.getElementById("locationsCount").value;
    
    // 1. Same Gatekeeper checks
    if (!startNode || !endNode || countStr === "") {
        showInlineError("locationsCount", "Required.");
        return;
    }

    const n = parseInt(countStr);
    // Get intermediate nodes from the already generated table if it exists
    const locRows = document.getElementById("locationsTableContainer").querySelectorAll('tbody tr');
    let intermediates = [];
    locRows.forEach(row => {
        const name = row.querySelectorAll('input')[0].value.trim();
        if(name) intermediates.push(name);
    });

    // Match the order: Start, Intermediates, End
    const allNodes = [startNode, ...intermediates, endNode];
    const totalNodes = allNodes.length;

    // 2. Generate matrix WITH labels
    let html = `<div class="matrix-container"><table class="generated-table">`;
    
    // Header Row
    html += `<tr><th></th>${allNodes.map(node => `<th>${node}</th>`).join('')}</tr>`;

    // Data Rows
    for (let i = 0; i < totalNodes; i++) {
        html += `<tr><td><strong>${allNodes[i]}</strong></td>`;
        for (let j = 0; j < totalNodes; j++) {
            html += `<td><input type="number" value="${i === j ? 0 : ''}" placeholder="0" style="width:70px"></td>`;
        }
        html += "</tr>";
    }
    
    html += `</table></div>`;
    document.getElementById("distanceMatrixA").innerHTML = html;
}
// PART B Generators
function generateRequestsTable() {
    const startNode = document.getElementById("startB").value.trim();
    const endNode = document.getElementById("endB").value.trim();
    const capacityStr = document.getElementById("capacityB").value;
    const reqCountStr = document.getElementById("requestCount").value;
    
    let hasError = false;

    // Strict Gatekeeper: Check ALL top fields before generating the requests table
    if (!startNode) { showInlineError("startB", "Required."); hasError = true; }
    if (!endNode) { showInlineError("endB", "Required."); hasError = true; }
    
    if (capacityStr === "") { showInlineError("capacityB", "Required."); hasError = true; } 
    else if (parseInt(capacityStr) <= 0) { showInlineError("capacityB", "Must be at least 1."); hasError = true; }
    
    if (reqCountStr === "") { showInlineError("requestCount", "Required."); hasError = true; } 
    else {
        const reqCount = parseInt(reqCountStr);
        if (reqCount <= 0) { showInlineError("requestCount", "Must be at least 1."); hasError = true; }
    }

    // Block table generation instantly if anything is missing or invalid
    if (hasError) return;

    const reqCount = parseInt(reqCountStr);
    const existingRows = document.querySelectorAll("#requestsTableContainer tbody tr");
    let savedData = [];
    if (existingRows) {
        existingRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            savedData.push({
                pickup: inputs[0] ? inputs[0].value : "",
                drop: inputs[1] ? inputs[1].value : "",
                base: inputs[2] ? inputs[2].value : "",
                flex: inputs[3] ? inputs[3].value : ""
            });
        });
    }

    let html = `<table class="generated-table">
        <thead>
            <tr>
                <th>Pickup</th>
                <th>Dropoff</th>
                <th>Base Distance</th>
                <th>Flexibility</th>
            </tr>
        </thead>
        <tbody>`;
    
    for (let i = 0; i < reqCount; i++) {
        let p = "", d = "", b = "", f = "";
        if (i < savedData.length) {
            p = savedData[i].pickup; 
            d = savedData[i].drop; 
            b = savedData[i].base; 
            f = savedData[i].flex;
        }
        html += `<tr>
            <td><input type="text" value="${p}" placeholder="e.g. A"></td>
            <td><input type="text" value="${d}" placeholder="e.g. B"></td>
            <td><input type="number" value="${b}" placeholder="0"></td>
            <td><input type="number" value="${f}" placeholder="0"></td>
        </tr>`;
    }
    
    html += `</tbody></table>`;
    document.getElementById("requestsTableContainer").innerHTML = html;
}

function generateDistanceMatrixB() {
    const startNode = document.getElementById("startB").value.trim();
    const endNode = document.getElementById("endB").value.trim();
    const capacityStr = document.getElementById("capacityB").value;
    const reqCountStr = document.getElementById("requestCount").value;
    
    let hasError = false;

    // Strict Gatekeeper checks for Part B Matrix
    if (!startNode) { showInlineError("startB", "Required."); hasError = true; }
    if (!endNode) { showInlineError("endB", "Required."); hasError = true; }
    
    if (capacityStr === "") { showInlineError("capacityB", "Required."); hasError = true; } 
    else if (parseInt(capacityStr) <= 0) { showInlineError("capacityB", "Must be at least 1."); hasError = true; }
    
    if (reqCountStr === "") { showInlineError("requestCount", "Required."); hasError = true; } 
    else if (parseInt(reqCountStr) <= 0) { showInlineError("requestCount", "Must be at least 1."); hasError = true; }

    const reqRows = document.querySelectorAll("#requestsTableContainer tbody tr");
    if (reqRows.length === 0) {
        hasError = true; 
    }

    if (hasError) return;

    let uniqueLocs = new Set();
    if (startNode) uniqueLocs.add(startNode);
    reqRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs[0].value.trim()) uniqueLocs.add(inputs[0].value.trim()); 
        if (inputs[1].value.trim()) uniqueLocs.add(inputs[1].value.trim()); 
    });
    if (endNode) uniqueLocs.add(endNode);

    const locations = Array.from(uniqueLocs);
    const n = locations.length;

    if (n < 2) return;

    let savedMatrix = {};
    const existingTable = document.querySelector("#distanceMatrixB table");
    
    if (existingTable) {
        const headers = Array.from(existingTable.querySelectorAll("th")).slice(1).map(th => th.innerText.trim());
        const rows = existingTable.querySelectorAll("tr");
        for(let i = 1; i < rows.length; i++) {
            const rowLabel = rows[i].querySelector("td strong").innerText.trim();
            savedMatrix[rowLabel] = {};
            const inputs = rows[i].querySelectorAll("input");
            inputs.forEach((input, j) => { savedMatrix[rowLabel][headers[j]] = input.value; });
        }
    }

    let html = `<div class="matrix-container"><table class="generated-table">`;
    html += `<tr><th></th>${locations.map(loc => `<th>${loc}</th>`).join('')}</tr>`;

    for (let i = 0; i < n; i++) {
        let rowLoc = locations[i];
        html += `<tr><td><strong>${rowLoc}</strong></td>`; 
        for (let j = 0; j < n; j++) {
            let colLoc = locations[j];
            let val = i === j ? 0 : ''; 
            if (savedMatrix[rowLoc] && savedMatrix[rowLoc][colLoc] !== undefined) { val = savedMatrix[rowLoc][colLoc]; }
            html += `<td><input type="number" value="${val}" placeholder="0" style="width:70px"></td>`;
        }
        html += "</tr>";
    }

    html += `</table></div>`;
    document.getElementById("distanceMatrixB").innerHTML = html;
}

/* ==================================================
   4. EXECUTION (API CALLS)
   ================================================== */
function runPartA() {
    const startNode = document.getElementById("startA").value.trim();
    const endNode = document.getElementById("endA").value.trim();
    const budgetStr = document.getElementById("budgetA").value;
    const thresholdStr = document.getElementById("thresholdA").value;

    let hasError = false;

    if (!startNode) {
        showInlineError("startA", "Required.");
        hasError = true;
    }
    if (!endNode) {
        showInlineError("endA", "Required.");
        hasError = true;
    }
    if (budgetStr === "") {
        showInlineError("budgetA", "Required.");
        hasError = true;
    } else if (parseFloat(budgetStr) <= 0) {
        showInlineError("budgetA", "Must be > 0.");
        hasError = true;
    }

    if (thresholdStr === "") {
        showInlineError("thresholdA", "Required.");
        hasError = true;
    } else if (parseInt(thresholdStr) < 0) {
        showInlineError("thresholdA", "Cannot be negative.");
        hasError = true;
    }

    if (hasError) return;

    const budget = parseFloat(budgetStr);
    const threshold = parseInt(thresholdStr);

    const locRows = document.getElementById("locationsTableContainer").querySelectorAll('tbody tr');
    let locationsPayload = {};
    let intermediateNodes = [];

    locRows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        const locName = inputs[0].value.trim();
        if (locName) {
            let score = parseFloat(inputs[1].value);
            if (score < 0) score = 0; 
            locationsPayload[locName] = { "score": score || 0, "category": inputs[2].value.trim() };
            intermediateNodes.push(locName);
        }
    });

    const allNodes = [startNode, ...intermediateNodes, endNode];
    const matrixArray = extractDistanceMatrix("distanceMatrixA", allNodes.length);
    const matrixInputs = document.getElementById("distanceMatrixA").querySelectorAll('input');
    
    let distanceDict = {};
    let matrixError = false;
    
    // Matrix Negative Validation tied directly to the specific cell
    for (let i = 0; i < allNodes.length; i++) {
        let node1 = allNodes[i];
        distanceDict[node1] = {};
        for (let j = 0; j < allNodes.length; j++) {
            let node2 = allNodes[j];
            let distValue = parseFloat(matrixArray[i][j]);
            
            if (distValue < 0) {
                let cellInput = matrixInputs[i * allNodes.length + j];
                showInlineError(cellInput, "Cannot be negative.");
                matrixError = true;
            }
            distanceDict[node1][node2] = distValue;
        }
    }
    if (matrixError) return;

    const payloadA = {
        "start": startNode, "end": endNode, "distance_budget": budget,
        "category_threshold": threshold, "locations": locationsPayload, "distance_matrix": distanceDict
    };

    const outputBox = document.querySelector("#optimization-view .output-box");
    outputBox.innerHTML = `<strong>Processing route optimization...</strong>`;

    fetch('http://127.0.0.1:5000/api/optimize_a', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadA)
    })
    .then(res => res.json())
    .then(data => {
            if (data.status === 'success') {
                const res = data.data;
                let totalDist = 0;
                for (let i = 0; i < res.optimal_route.length - 1; i++) {
                    totalDist += distanceDict[res.optimal_route[i]][res.optimal_route[i+1]];
                }

                // Updated output to include the new runtime metric
                outputBox.innerHTML = `
                    <strong>Optimal Route Found:</strong> ${res.optimal_route.join(' → ')}<br>
                    <strong>Total Distance:</strong> ${totalDist} km<br>
                    <strong>Total Effective Score:</strong> ${res.total_score}<br>
                    <hr>
                    <small><em>Processing time: ${res.runtime}s</em></small>
                `;
                
                drawVirtualRoute(res.optimal_route, res.coordinates, 'A');
            } else {
                outputBox.innerHTML = `<strong style="color:red;">Error:</strong> ${data.message}`;
            }
        })
    .catch((error) => outputBox.innerHTML = `<strong style="color:red;">Connection Error:</strong> Ensure the Flask server is running in your terminal.`);  
}

function runPartB() {
    const startNode = document.getElementById("startB").value.trim();
    const endNode = document.getElementById("endB").value.trim();
    const capacityStr = document.getElementById("capacityB").value;
    const reqCountStr = document.getElementById("requestCount").value;

    let hasError = false;

    if (!startNode) {
        showInlineError("startB", "Required.");
        hasError = true;
    }
    if (!endNode) {
        showInlineError("endB", "Required.");
        hasError = true;
    }
    if (capacityStr === "") {
        showInlineError("capacityB", "Required.");
        hasError = true;
    } else if (parseInt(capacityStr) < 0) {
        showInlineError("capacityB", "Cannot be negative.");
        hasError = true;
    } else if (parseInt(capacityStr) === 0) {
        showInlineError("capacityB", "Must be at least 1.");
        hasError = true;
    }

    if (reqCountStr === "") {
        showInlineError("requestCount", "Required.");
        hasError = true;
    } else if (parseInt(reqCountStr) <= 0) {
        showInlineError("requestCount", "Must be 1 or greater.");
        hasError = true;
    }

    if (hasError) return;
    
    const capacity = parseInt(capacityStr);
    const reqRows = document.getElementById("requestsTableContainer").querySelectorAll('tbody tr');
    let requestsPayload = {};
    let reqError = false;

    // Validate Requests for negative values, attaching errors directly to cells
    for (let i = 0; i < reqRows.length; i++) {
        const inputs = reqRows[i].querySelectorAll('input');
        if (!inputs[0].value.trim() && !inputs[1].value.trim()) continue;

        const baseDist = parseFloat(inputs[2].value);
        const flexMargin = parseFloat(inputs[3].value);
        
        if (baseDist < 0) {
            showInlineError(inputs[2], "Cannot be negative.");
            reqError = true;
        }
        if (flexMargin < 0) {
            showInlineError(inputs[3], "Negative flexibility not allowed.");
            reqError = true;
        }
        
        requestsPayload["Req" + (i + 1)] = {
            "pickup": inputs[0].value.trim(), 
            "drop": inputs[1].value.trim(),
            "base_distance": baseDist || 0, 
            "flexibility_margin": flexMargin || 0
        };
    }
    if (reqError) return;

    let uniqueLocs = new Set();
    if (startNode) uniqueLocs.add(startNode);
    Object.values(requestsPayload).forEach(req => uniqueLocs.add(req.pickup)); 
    Object.values(requestsPayload).forEach(req => uniqueLocs.add(req.drop));   
    if (endNode) uniqueLocs.add(endNode);
    const uniqueNodes = Array.from(uniqueLocs);
    
    const matrixArray = extractDistanceMatrix("distanceMatrixB", uniqueNodes.length);
    const matrixInputs = document.getElementById("distanceMatrixB").querySelectorAll('input');
    
    let distanceDict = {};
    let matrixError = false;
    
    // Matrix Negative Validation tied directly to the specific cell
    for (let i = 0; i < uniqueNodes.length; i++) {
        let node1 = uniqueNodes[i];
        distanceDict[node1] = {};
        for (let j = 0; j < uniqueNodes.length; j++) {
            let node2 = uniqueNodes[j];
            let distValue = parseFloat(matrixArray[i][j]);
            
            if (distValue < 0) {
                let cellInput = matrixInputs[i * uniqueNodes.length + j];
                showInlineError(cellInput, "Cannot be negative.");
                matrixError = true;
            }
            distanceDict[node1][node2] = distValue;
        }
    }
    if (matrixError) return;

    const payloadB = {
        "start": startNode,
        "end": endNode,
        "vehicle_capacity": capacity,
        "requests": requestsPayload,
        "distance_matrix": distanceDict
    };

    const outputBox = document.querySelector("#ridesharing-view .output-box");
    outputBox.innerHTML = `<strong>Processing dynamic request...</strong>`;

    fetch('http://127.0.0.1:5000/api/optimize_b', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadB)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            const res = data.data;
            let resultHTML = `<strong>Status:</strong> ${res.status.toUpperCase()}<br>`;
            if (res.status === 'accepted') {
                resultHTML += `
                    <strong>New Route:</strong> ${res.new_route.join(' → ')}<br>
                    <strong>Total Travel Distance:</strong> ${res.total_dist} km<br>
                    <hr>
                    <small><em>Processing time: ${res.runtime_ms}ms</em></small>
                `;
                drawVirtualRoute(res.new_route, res.coordinates, 'B'); 
            } else {
                resultHTML += `<strong>Reason:</strong> ${res.reason}`;
            }
            outputBox.innerHTML = resultHTML;
        } else {
            outputBox.innerHTML = `<strong style="color:red;">Error:</strong> ${data.message}`;
        }
    })
    .catch((error) => outputBox.innerHTML = `<strong style="color:red;">Connection Error:</strong> Ensure the Flask server is running in your VS Code terminal.`);
}

/* ==================================================
   5. RESET (PART B ONLY)
   ================================================== */
function resetPartB() {
    document.getElementById("startB").value = "";
    document.getElementById("endB").value = "";
    document.getElementById("capacityB").value = "";
    document.getElementById("requestCount").value = "";

    document.getElementById("requestsTableContainer").innerHTML = "";
    document.getElementById("distanceMatrixB").innerHTML = "";

    const outputBox = document.querySelector("#ridesharing-view .output-box");
    outputBox.innerHTML = `<strong>Part B Output</strong><br><br>Results will appear here after execution.`;

    const mapContainerB = document.getElementById("mapContainerB");
    mapContainerB.style.display = "none";

    if (mapB) {
        if (pathLayerB) {
            mapB.removeLayer(pathLayerB);
            pathLayerB = null;
        }
        nodeLayersB.forEach(marker => mapB.removeLayer(marker));
        nodeLayersB = [];
    }
}