# PathMatrix: Intelligent Route Planning & Adaptive Optimization System

**Summer of Innovation Coding Club, IIT Dharwad -**
**Team Dijkstra Trio**

---

## Overview

PathMatrix is a full-stack, high-performance web application designed to solve complex routing and optimization problems. The system computes mathematically optimal paths for two distinct scenarios:

- Maximizing sightseeing satisfaction within a strict distance budget
- Dynamically routing shared rides while rigorously enforcing vehicle capacity and passenger flexibility constraints

---

## Core Architecture & Tech Stack

| Layer | Details |
|---|---|
| **Backend (The Engine)** | Python driven by the **Flask** framework. The RESTful API architecture decouples the heavy mathematical processing from the frontend, ensuring rapid calculations and structured JSON responses. |
| **Frontend (The Interface)** | Dependency-free Vanilla JavaScript, HTML5, and CSS3. |
| **Geospatial Visualization** | Integrated with Leaflet.js and OpenStreetMap to dynamically render optimal routes and calculate virtual geographic coordinates on the fly. |
| **CORS** | Fully configured to ensure seamless and secure data handoffs between the local server and the browser dashboard. |

---

## Algorithmic Implementations (The Brains)

### Part A: Sightseeing Route Optimization
- **Intelligent Pathfinding:** Maximizes total effective satisfaction within a strict distance budget.
- **Mathematical Modeling:** Natively implements the exponential Satisfaction Decay Model:
  ```
  S_eff = S * e^(-k * d)
  ```
- **Dynamic Penalties:** Automatically applies category-diversity penalties to prevent over-visiting similar location types.

### Part B: Dynamic Ride Sharing (Global Exact Search)
- **Branch-and-Bound Depth-First Search (DFS):** Replaces standard greedy heuristics with a rigorous DFS algorithm that explores all valid topological permutations of pickups and dropoffs to find the *absolute global minimum* distance.
- **Algorithmic Pruning:** Utilizes Branch-and-Bound logic to instantly terminate calculation paths the moment they exceed the best-known distance, saving massive amounts of computational overhead.
- **Strict Constraint Enforcement:** Mathematically guarantees that vehicle occupancy never exceeds capacity `C` at any point, and that passenger detour distances never violate their flexibility margin `Δ`.

---

## Defensive Programming & Error Handling

The system is built to never crash silently. A strict "Gatekeeper" architecture sanitizes inputs and handles edge cases gracefully:

- **Backend Validation:** The Flask server actively intercepts impossible routes, negative scores, or invalid matrices before algorithmic processing begins.
- **Targeted UI Highlighting:** Instead of server crashes, errors are caught via `try-except` blocks and returned as clean JSON. The frontend dashboard parses these exceptions and displays them as clear, red error banners directly on the screen, instructing the user exactly what went wrong (e.g., "Capacity Exceeded" or "Score cannot be negative").
- **Data Synchronization:** UI grid generation and API extraction are tightly coupled in strict sequential order (`Start -> P1 -> D1 -> P2 -> D2 -> End`) to prevent any hidden data-scrambling.

---

## Performance Metrics

- **High-Precision Benchmarking:** The backend utilizes Python's `time.perf_counter()` to measure the exact round-trip algorithmic execution time.
- **Real-Time Analytics:** The UI instantly renders these metrics (in seconds for Part A, and milliseconds for Part B), proving the system handles complex routing calculations without latency.

---

## Instructions for Judges: How to Run the Application

### 1. Running Locally on Your PC (VS Code / Terminal)

To test the application on your local machine, follow these steps:

1. **Extract the project folder** and open it in Visual Studio Code (or your preferred IDE).
2. **Open a new Terminal** within the project directory.
3. **Install the required dependencies** (ensure Python is installed):
   ```bash
   pip install flask flask-cors
   ```
4. **Start the Flask Backend:**
   ```bash
   python app.py
   ```
   You should see a message confirming the server is running on `http://127.0.0.1:5000`.
5. **Launch the Frontend:** Simply double-click the `index.html` file to open it in any modern web browser (Chrome, Edge, Firefox, Safari). The system is now fully operational.

### 2. Testing on a Mobile Device (Local Network)

The UI is fully responsive and can be tested on a mobile phone to demonstrate cross-device compatibility. To run it on your mobile device, both your PC and your phone must be connected to the **same Wi-Fi network**.

1. **Find your PC's Local IP Address:**
   - *Windows:* Open Command Prompt and type `ipconfig`. Look for the `IPv4 Address` (e.g., `192.168.1.x`).
   - *Mac/Linux:* Open Terminal and type `ifconfig`. Look for the `inet` address under your active connection.
2. **Update the Flask App:** Open `app.py` and ensure the final run command is set to host on all network interfaces:
   ```python
   if __name__ == '__main__':
       app.run(host='0.0.0.0', port=5000, debug=True)
   ```
3. **Restart the Flask Server:** Stop the server (`Ctrl + C`) and run `python app.py` again.
4. **Access from Mobile:** Open the web browser on your smartphone and type your PC's IP address followed by the port into the URL bar (e.g., `http://192.168.1.x:5000`). The full web app will render dynamically on your mobile screen.

   > **Note:** For large distance matrices, simply swipe horizontally on the table container to view all columns.

---

## Team

**Team Dijkstra Trio - Harsh Bansode, Himank Jain, Kakaday Barath Palash** — Summer of Innovation Coding Club, IIT Dharwad
