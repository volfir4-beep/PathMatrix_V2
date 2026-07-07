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

    // 1. Map Initialization (The part you just updated)
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

    // 2. Plot nodes
    routeSequence.forEach((nodeName, index) => {
        if (!coordinateData[nodeName]) return;
        
        let coords = coordinateData[nodeName];
        let point = [coords.lat, coords.lng]; // Explicitly using lat and lng
        latLngs.push(point);

        let marker = L.circleMarker(point, {
            radius: 6, fillColor: "#4b7a32", color: "#fff", weight: 2, opacity: 1, fillOpacity: 1
        }).bindPopup(`<b>${nodeName}</b><br>Stop ${index + 1}`).addTo(currentMap);
        
        if (part === 'A') nodeLayersA.push(marker);
        else nodeLayersB.push(marker);
    });

    // 3. Draw path
    let newPath = L.polyline(latLngs, {
        color: '#6aab44', weight: 4, dashArray: '5, 10'
    }).addTo(currentMap);

    if (part === 'A') pathLayerA = newPath;
    else pathLayerB = newPath;

    // 4. THIS IS WHERE THE LAST LINE GOES
    // Auto-adjust the map view to fit the drawn route perfectly
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
    const n = parseInt(document.getElementById("locationsCount").value);
    if (!n || n <= 0) return alert("Enter a valid number of locations");

    let html = `<table class="generated-table"><thead><tr><th>Location Name</th><th>Score</th><th>Category</th></tr></thead><tbody>`;
    for (let i = 0; i < n; i++) {
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
    const n = parseInt(document.getElementById("locationsCount").value);

    if (!n || n <= 0 || !startNode || !endNode) {
        return alert("Please enter the Start, End, and Number of Locations first.");
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
    const reqCount = parseInt(document.getElementById("requestCount").value);
    if (!reqCount || reqCount < 1) {
        alert("Please enter a valid number of requests.");
        return;
    }

    // 1. Memorize existing data before overwriting
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

    // 2. Build the new table
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
        // Retrieve saved values if they exist for this row, otherwise leave blank
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
        alert("Please ensure Start, End, and at least one request are filled in first.");
        return;
    }

    // 1. Memorize existing matrix data by mapping Row Name to Column Name
    let savedMatrix = {};
    const existingTable = document.querySelector("#distanceMatrixB table");
    
    if (existingTable) {
        // Get the header names (skipping the first empty top-left cell)
        const headers = Array.from(existingTable.querySelectorAll("th")).slice(1).map(th => th.innerText.trim());
        const rows = existingTable.querySelectorAll("tr");
        
        // Loop through rows (skipping the header row itself)
        for(let i = 1; i < rows.length; i++) {
            const rowLabel = rows[i].querySelector("td strong").innerText.trim();
            savedMatrix[rowLabel] = {};
            const inputs = rows[i].querySelectorAll("input");
            inputs.forEach((input, j) => {
                savedMatrix[rowLabel][headers[j]] = input.value;
            });
        }
    }

    // 2. Generate the new matrix
    let html = `<div class="matrix-container"><table class="generated-table">`;
    html += `<tr><th></th>${locations.map(loc => `<th>${loc}</th>`).join('')}</tr>`;

    for (let i = 0; i < n; i++) {
        let rowLoc = locations[i];
        html += `<tr><td><strong>${rowLoc}</strong></td>`; // Row Label
        
        for (let j = 0; j < n; j++) {
            let colLoc = locations[j];
            let val = i === j ? 0 : ''; 
            
            // Check if we have a saved value for this exact Row to Column path
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
    const budget = parseFloat(document.getElementById("budgetA").value) || 0;
    const threshold = parseInt(document.getElementById("thresholdA").value) || 1;
    const numLocations = parseInt(document.getElementById("locationsCount").value) || 0;

    if (!startNode || !endNode || numLocations === 0) return alert("Please fill in the Start, End, and generate the Locations Table.");

    const locRows = document.getElementById("locationsTableContainer").querySelectorAll('tbody tr');
    let locationsPayload = {};
    let intermediateNodes = [];

    locRows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        const locName = inputs[0].value.trim();
        if (locName) {
            locationsPayload[locName] = { "score": parseFloat(inputs[1].value) || 0, "category": inputs[2].value.trim() };
            intermediateNodes.push(locName);
        }
    });

    const allNodes = [startNode, ...intermediateNodes, endNode];
    const matrixArray = extractDistanceMatrix("distanceMatrixA", allNodes.length);
    
    let distanceDict = {};
    allNodes.forEach((node1, i) => {
        distanceDict[node1] = {};
        allNodes.forEach((node2, j) => distanceDict[node1][node2] = matrixArray[i][j]);
    });

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
            
            // Calculate the total distance of the optimal route using the matrix
            let totalDist = 0;
            for (let i = 0; i < res.optimal_route.length - 1; i++) {
                totalDist += distanceDict[res.optimal_route[i]][res.optimal_route[i+1]];
            }

            // Display Route, Distance, and Score
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
    const capacity = parseInt(document.getElementById("capacityB").value) || 1;
    const numRequests = parseInt(document.getElementById("requestCount").value) || 0;

    if (!startNode || !endNode || numRequests === 0) return alert("Please fill in the Start, End, and generate the Requests Table.");

    const reqRows = document.getElementById("requestsTableContainer").querySelectorAll('tbody tr');
    let requestsPayload = {};

    reqRows.forEach((row, index) => {
        const inputs = row.querySelectorAll('input');
        requestsPayload["Req" + (index + 1)] = {
            "pickup": inputs[0].value.trim(), "drop": inputs[1].value.trim(),
            "base_distance": parseFloat(inputs[2].value) || 0, "flexibility_margin": parseFloat(inputs[3].value) || 0
        };
    });
    // Ensure extraction order exactly matches the Matrix generation order
    let uniqueLocs = new Set();
    if (startNode) uniqueLocs.add(startNode);
    Object.values(requestsPayload).forEach(req => uniqueLocs.add(req.pickup)); // All Pickups
    Object.values(requestsPayload).forEach(req => uniqueLocs.add(req.drop));   // All Drops
    if (endNode) uniqueLocs.add(endNode);
    const uniqueNodes = Array.from(uniqueLocs);
    const matrixArray = extractDistanceMatrix("distanceMatrixB", uniqueNodes.length);
    
    let distanceDict = {};
    uniqueNodes.forEach((node1, i) => {
        distanceDict[node1] = {};
        uniqueNodes.forEach((node2, j) => distanceDict[node1][node2] = matrixArray[i][j]);
    });

    // Construct Final Payload for Batch Processing
    const payloadB = {
        "start": startNode,
        "end": endNode,
        "vehicle_capacity": capacity,
        "requests": requestsPayload, // Sending ALL requests instead of just Req1
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
    // 1. Clear the top form inputs
    document.getElementById("startB").value = "";
    document.getElementById("endB").value = "";
    document.getElementById("capacityB").value = "";
    document.getElementById("requestCount").value = "";

    // 2. Empty out the generated requests table and distance matrix
    document.getElementById("requestsTableContainer").innerHTML = "";
    document.getElementById("distanceMatrixB").innerHTML = "";

    // 3. Reset the output box back to its default message
    const outputBox = document.querySelector("#ridesharing-view .output-box");
    outputBox.innerHTML = `<strong>Part B Output</strong><br><br>Results will appear here after execution.`;

    // 4. Hide and clear the map (remove drawn route + markers, keep the map instance)
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