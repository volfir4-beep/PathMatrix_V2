function showCustomError(buttonId, message) {
    const button = document.getElementById(buttonId);
    if (!button) {
        alert(message); // Fallback just in case the button ID is wrong
        return;
    }

    // 1. Remove any existing error banner above this button so they don't stack up
    const existingError = button.previousElementSibling;
    if (existingError && existingError.classList.contains('custom-error-alert')) {
        existingError.remove();
    }

    // 2. Create the new custom error banner
    const errorDiv = document.createElement('div');
    errorDiv.className = 'custom-error-alert';
    errorDiv.innerHTML = `⚠️ ${message}`;
    
    // 3. Apply the Red Background and White Font styling
    Object.assign(errorDiv.style, {
        backgroundColor: '#d32f2f',
        color: 'white',
        padding: '12px',
        marginBottom: '15px',
        borderRadius: '6px',
        textAlign: 'center',
        fontWeight: 'bold',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'opacity 0.3s ease-in-out'
    });

    // 4. Inject it into the page directly above the button
    button.parentNode.insertBefore(errorDiv, button);

    // 5. Automatically remove the error after 3.5 seconds
    setTimeout(() => {
        errorDiv.style.opacity = '0';
        setTimeout(() => {
            if (errorDiv.parentNode) errorDiv.remove();
        }, 300);
    }, 3500);
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
function generateLocationsTable() {
    const budgetStr = document.getElementById("budgetA").value;
    const thresholdStr = document.getElementById("thresholdA").value;
    const countStr = document.getElementById("locationsCount").value;

    // 1. Gatekeeper checks for Budget and Threshold before building the table
    if (budgetStr !== "" && parseFloat(budgetStr) <= 0) {
        showCustomError("btnGenerateLocA", "Distance Budget must be greater than 0.");
        return;
    }
    if (thresholdStr !== "" && parseInt(thresholdStr) < 0) {
        showCustomError("btnGenerateLocA", "Category Threshold cannot be negative.");
        return;
    }

    // 2. Standard checks for Locations Count
    if (countStr === "") {
        showCustomError("btnGenerateLocA", "Please enter a number of locations.");
        return;
    }

    const locCount = parseInt(countStr);
    if (locCount < 0) {
        showCustomError("btnGenerateLocA", "Number of Locations cannot be negative.");
        return;
    }
    if (locCount === 0) {
        showCustomError("btnGenerateLocA", "Number of Locations must be at least 1.");
        return;
    }

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
    const budgetStr = document.getElementById("budgetA").value;
    const thresholdStr = document.getElementById("thresholdA").value;
    const countStr = document.getElementById("locationsCount").value;

    // 1. Gatekeeper checks
    if (budgetStr !== "" && parseFloat(budgetStr) <= 0) {
        showCustomError("btnGenerateMatrixA", "Distance Budget must be greater than 0.");
        return;
    }
    if (thresholdStr !== "" && parseInt(thresholdStr) < 0) {
        showCustomError("btnGenerateMatrixA", "Category Threshold cannot be negative.");
        return;
    }

    // 2. Standard Matrix checks
    if (!startNode || !endNode || countStr === "") {
        showCustomError("btnGenerateMatrixA", "Please enter the Start, End, and Number of Locations first.");
        return;
    }

    const n = parseInt(countStr);
    
    if (n < 0) {
        showCustomError("btnGenerateMatrixA", "Number of Locations cannot be a negative number.");
        return;
    }
    if (n === 0) {
        showCustomError("btnGenerateMatrixA", "Number of Locations must be at least 1.");
        return;
    }

    const totalNodes = n + 2; 
    let html = `<div class="matrix-container"><table class="generated-table">`;
    for (let i = 0; i < totalNodes; i++) {
        html += "<tr>";
        for (let j = 0; j < totalNodes; j++) {
            html += `<td><input type="number" value="${i === j ? 0 : ''}" placeholder="0" style="width:70px"></td>`;
        }
        html += "</tr>";
    }
    html += `</table></div><p style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">* Matrix order: Start, Intermediates 1-${n}, End.</p>`;
    document.getElementById("distanceMatrixA").innerHTML = html;
}

// PART B Generators
function generateRequestsTable() {
    const reqCountStr = document.getElementById("requestCount").value;
    
    if (reqCountStr === "") {
        showCustomError("btnGenerateReqB", "Please enter a number of requests.");
        return;
    }

    const reqCount = parseInt(reqCountStr);
    if (reqCount < 0) {
        showCustomError("btnGenerateReqB", "Number of Requests cannot be negative.");
        return;
    }
    if (reqCount === 0) {
        showCustomError("btnGenerateReqB", "Number of Requests must be at least 1.");
        return;
    }

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
    const reqRows = document.querySelectorAll("#requestsTableContainer tbody tr");

    let uniqueLocs = new Set();

    if (startNode) uniqueLocs.add(startNode);
    reqRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs[0].value.trim()) uniqueLocs.add(inputs[0].value.trim()); 
    });
    reqRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs[1].value.trim()) uniqueLocs.add(inputs[1].value.trim()); 
    });
    if (endNode) uniqueLocs.add(endNode);

    const locations = Array.from(uniqueLocs);
    const n = locations.length;

    if (n < 2) {
        showCustomError("btnGenerateMatrixB", "Please ensure Start, End, and at least one request are filled in first.");
        return;
    }

    let savedMatrix = {};
    const existingTable = document.querySelector("#distanceMatrixB table");
    
    if (existingTable) {
        const headers = Array.from(existingTable.querySelectorAll("th")).slice(1).map(th => th.innerText.trim());
        const rows = existingTable.querySelectorAll("tr");
        
        for(let i = 1; i < rows.length; i++) {
            const rowLabel = rows[i].querySelector("td strong").innerText.trim();
            savedMatrix[rowLabel] = {};
            const inputs = rows[i].querySelectorAll("input");
            inputs.forEach((input, j) => {
                savedMatrix[rowLabel][headers[j]] = input.value;
            });
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
            
            if (savedMatrix[rowLoc] && savedMatrix[rowLoc][colLoc] !== undefined) {
                val = savedMatrix[rowLoc][colLoc];
            }

            html += `
            <td>
                <input
                    type="number"
                    value="${val}"
                    placeholder="0"
                    style="width:70px"
                >
            </td>
            `;
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

    // 1. Completely Distinct Checks for Missing Inputs
    if (!startNode) {
        showCustomError("btnRunPartA", "Please enter a Start Location.");
        return;
    }
    if (!endNode) {
        showCustomError("btnRunPartA", "Please enter an End Location.");
        return;
    }
    if (budgetStr === "") {
        showCustomError("btnRunPartA", "Please enter a Distance Budget.");
        return;
    }
    if (thresholdStr === "") {
        showCustomError("btnRunPartA", "Please enter a Category Threshold.");
        return;
    }

    const budget = parseFloat(budgetStr);
    const threshold = parseInt(thresholdStr);

    // 2. Distinct Checks for Absurd/Negative Values
    if (budget <= 0) {
        showCustomError("btnRunPartA", "Distance Budget must be greater than 0.");
        return;
    }
    if (threshold < 0) {
        showCustomError("btnRunPartA", "Category Threshold cannot be a negative number.");
        return;
    }

    // 3. Extract Locations Table
    const locRows = document.getElementById("locationsTableContainer").querySelectorAll('tbody tr');
    let locationsPayload = {};
    let intermediateNodes = [];

    locRows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        const locName = inputs[0].value.trim();
        if (locName) {
            // Check if score is absurdly negative (optional but good practice)
            let score = parseFloat(inputs[1].value);
            if (score < 0) score = 0; 

            locationsPayload[locName] = { "score": score || 0, "category": inputs[2].value.trim() };
            intermediateNodes.push(locName);
        }
    });

    // 4. Extract Matrix
    const allNodes = [startNode, ...intermediateNodes, endNode];
    const matrixArray = extractDistanceMatrix("distanceMatrixA", allNodes.length);
    
    let distanceDict = {};
    
    // Matrix Negative Validation
    for (let i = 0; i < allNodes.length; i++) {
        let node1 = allNodes[i];
        distanceDict[node1] = {};
        for (let j = 0; j < allNodes.length; j++) {
            let node2 = allNodes[j];
            let distValue = parseFloat(matrixArray[i][j]);
            
            if (distValue < 0) {
                showCustomError("btnRunPartA", "Distances cannot be negative. Please correct the Distance Matrix.");
                return;
            }
            distanceDict[node1][node2] = distValue;
        }
    }

    // 5. Construct and Send Payload
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

            outputBox.innerHTML = `
                <strong>Optimal Route Found:</strong> ${res.optimal_route.join(' → ')}<br><br>
                <strong>Total Distance:</strong> ${totalDist} km<br><br>
                <strong>Total Effective Score:</strong> ${res.total_score}<br>
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

    if (!startNode || !endNode || capacityStr === "" || reqCountStr === "") {
        showCustomError("btnRunPartB", "Please fill in all the main parameters (Start, End, Capacity, Requests) before running.");
        return;
    }
    
    const capacity = parseInt(capacityStr);
    const reqCount = parseInt(reqCountStr);

    if (capacity < 0) {
        showCustomError("btnRunPartB", "Vehicle Capacity cannot be a negative number.");
        return;
    }
    if (capacity === 0) {
        showCustomError("btnRunPartB", "Vehicle Capacity must be at least 1.");
        return;
    }
    if (reqCount <= 0) {
        showCustomError("btnRunPartB", "Number of Requests must be 1 or greater.");
        return;
    }

    const reqRows = document.getElementById("requestsTableContainer").querySelectorAll('tbody tr');
    let requestsPayload = {};

    // Validate Requests for negative values while building payload
    for (let i = 0; i < reqRows.length; i++) {
        const inputs = reqRows[i].querySelectorAll('input');
        const baseDist = parseFloat(inputs[2].value);
        const flexMargin = parseFloat(inputs[3].value);
        
        if (baseDist < 0 || flexMargin < 0) {
            showCustomError("btnRunPartB", `Request ${i + 1} contains negative values for Base Distance or Flexibility.`);
            return;
        }
        
        requestsPayload["Req" + (i + 1)] = {
            "pickup": inputs[0].value.trim(), 
            "drop": inputs[1].value.trim(),
            "base_distance": baseDist || 0, 
            "flexibility_margin": flexMargin || 0
        };
    }

    let uniqueLocs = new Set();
    if (startNode) uniqueLocs.add(startNode);
    Object.values(requestsPayload).forEach(req => uniqueLocs.add(req.pickup)); 
    Object.values(requestsPayload).forEach(req => uniqueLocs.add(req.drop));   
    if (endNode) uniqueLocs.add(endNode);
    const uniqueNodes = Array.from(uniqueLocs);
    const matrixArray = extractDistanceMatrix("distanceMatrixB", uniqueNodes.length);
    
    let distanceDict = {};
    
    // Matrix Negative Validation
    for (let i = 0; i < uniqueNodes.length; i++) {
        let node1 = uniqueNodes[i];
        distanceDict[node1] = {};
        for (let j = 0; j < uniqueNodes.length; j++) {
            let node2 = uniqueNodes[j];
            let distValue = parseFloat(matrixArray[i][j]);
            
            if (distValue < 0) {
                showCustomError("btnRunPartB", "Distances cannot be negative. Please correct the Distance Matrix.");
                return;
            }
            distanceDict[node1][node2] = distValue;
        }
    }

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
                resultHTML += `<strong>New Route:</strong> ${res.new_route.join(' → ')}<br><strong>Total Travel Distance:</strong> ${res.total_dist} km<br>`;
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