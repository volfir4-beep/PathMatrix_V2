# PathMatrix — Intelligent Route Planning & Adaptive Optimization System

**Summer of Innovation Coding Club, IIT Dharwad**
**Team Dijkstra Trio** — Harsh Bansode, Himank Jain, Kakaday Barath Palash

---

## Overview

PathMatrix is a two-part routing and optimization system built for the Summer of Innovation Coding Club challenge. It computes mathematically optimal (not heuristic) solutions for two distinct problems:

- **Part A — Sightseeing Route Optimization:** selects and orders a subset of locations to maximize total effective satisfaction under a distance budget and category-diversity rule.
- **Part B — Dynamic Ride Sharing:** routes a shared vehicle through multiple pickup/dropoff requests, minimizing total distance while respecting vehicle capacity and each passenger's flexibility margin.

Both are exposed through a Flask REST API and driven by a single-page vanilla JS/HTML/CSS dashboard with Leaflet-based map visualization.

---

## Tech Stack

| Layer | Details |
|---|---|
| **Backend** | Python + Flask, `flask-cors` for local cross-origin requests |
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 — no build step, no framework |
| **Map Visualization** | Leaflet.js + OpenStreetMap tiles, with server-generated virtual coordinates for locations that don't have real-world GPS data |
| **Benchmarking** | `time.perf_counter()` on the backend; results shown in seconds (Part A) and milliseconds (Part B) |

---

## Algorithm Design

### Part A — Satisfaction-Maximizing DP with Pareto Pruning

**Model.**
$$S_{eff} = S \cdot e^{-k \cdot d}, \quad k = 0.1$$
`S` is a location's base score and `d` is the cumulative distance traveled *before* reaching it. If a location's category has already appeared more than `category_threshold` times among the locations chosen so far, its effective score is additionally multiplied by `0.9`.

**Why not brute force?** A naive solution tries every permutation of every subset of locations — `O(n!)` — which is infeasible past ~8–9 locations.

**Our approach.** We treat this as dynamic programming over `(visited_set, current_node)`:
- The category-penalty decision for the *next* location depends only on how many locations of that category are already in `visited_set` — a property of the set, not the order used to build it. So we don't need to enumerate every ordering of a set, only the set itself.
- What *does* vary by order is cumulative distance and cumulative score reaching that set/node. For a fixed `(visited_set, node)`, we keep every **non-dominated** `(distance, score)` pair on the frontier: if one path is both cheaper *and* scores higher than another for the same state, the worse one is discarded (Pareto pruning), since it can never lead to a better final answer.

This keeps the algorithm exact — guaranteed optimal, identical to full brute-force search — while cutting complexity to roughly `O(2^n · n · frontier_size)`, which in practice is dramatically smaller than `n!`.

**Feasibility check.** A location is only considered if the route can still reach `end` afterward within budget; a "reach `end`" check happens at every state expansion, not just at the finish, so the algorithm never terminates on a route that could not have returned home.

### Part B — Ride Sharing via Branch-and-Bound DFS

**Constraints enforced at every step:**
- Pickup must precede dropoff for each request.
- Vehicle occupancy never exceeds `vehicle_capacity` at any point.
- For each request `i`: distance traveled while that passenger is aboard must satisfy `d(pickup → drop via route) ≤ base_distance_i + flexibility_margin_i`.

**Approach.** We run a depth-first search over all valid interleavings of pickup/dropoff events for every active request, branching on "pick up request X" or "drop off request X" at each step, and backtracking whenever a partial route already exceeds the best complete route found so far (Branch-and-Bound pruning). This guarantees the **global minimum-distance route**, not a locally-optimal insertion.

**Design trade-off, stated explicitly.** This is a full recomputation over *all* active requests on every call, rather than an incremental "insert one new request into the existing route" heuristic. We chose this deliberately: incremental insertion is faster per call but can miss the true optimum once multiple requests are active, since a locally-good insertion point for a new request can block a better global reordering. Branch-and-bound pruning keeps this fast in practice for realistic request counts (the search space collapses quickly once a good bound is found), at the cost of worse worst-case scaling than a pure insertion heuristic for very large numbers of simultaneous requests.

**Output.** Alongside the route and total distance, the backend also returns a stop-by-stop passenger count table (`passenger_counts`) showing occupancy at every pickup/dropoff, for use in the UI or in Part B's technical write-up.

---

## API Reference

### `POST /api/optimize_a`
```json
{
  "start": "Start",
  "end": "End",
  "distance_budget": 20,
  "category_threshold": 2,
  "locations": {
    "Museum": { "score": 8, "category": "Historical" },
    "Park":   { "score": 6, "category": "Nature" }
  },
  "distance_matrix": {
    "Start":  { "Start": 0, "Museum": 3, "Park": 5, "End": 10 },
    "Museum": { "Start": 3, "Museum": 0, "Park": 4, "End": 7 },
    "Park":   { "Start": 5, "Museum": 4, "Park": 0, "End": 5 },
    "End":    { "Start": 10, "Museum": 7, "Park": 5, "End": 0 }
  }
}
```
Returns `optimal_route`, `total_score`, `feasible`, `runtime_ms`, plus `runtime` and `coordinates` injected by the API layer for the UI.

### `POST /api/optimize_b`
```json
{
  "start": "S",
  "end": "E",
  "vehicle_capacity": 2,
  "requests": {
    "Req1": { "pickup": "P1", "drop": "D1", "base_distance": 5, "flexibility_margin": 2 }
  },
  "distance_matrix": {
    "S":  { "S": 0, "P1": 4, "D1": 11, "E": 15 },
    "P1": { "S": 4, "P1": 0, "D1": 5, "E": 12 },
    "D1": { "S": 11, "P1": 5, "D1": 0, "E": 5 },
    "E":  { "S": 15, "P1": 12, "D1": 5, "E": 0 }
  }
}
```
Returns `status` (`accepted`/`rejected`), `new_route`, `total_dist`, `passenger_counts`, `runtime_ms`, plus `coordinates`.

---

## Validation & Error Handling

- Both endpoints validate required fields and reject malformed payloads with a structured `{"status": "error", "message": ...}` response (HTTP 400) instead of crashing.
- The frontend blocks table/matrix generation until start, end, budget/capacity, and count fields are filled and non-negative, and flags individual invalid cells inline rather than failing silently.
- Infeasible scenarios (no route fits the budget, or no combination of requests satisfies capacity/flexibility) return a clear `feasible: false` / `status: "rejected"` result rather than an error.

---

## Running the Application Locally

1. Extract the project folder and open it in VS Code (or your preferred IDE).
2. Open a terminal in the project directory.
3. Install dependencies:
   ```bash
   pip install flask flask-cors
   ```
4. Start the backend:
   ```bash
   python app.py
   ```
   You should see `Team Dijkstra Backend API initialized on http://127.0.0.1:5000`.
5. Open `index.html` directly in a browser (double-click it, or serve it via your IDE's Live Server / integrated browser). The dashboard talks to the Flask backend at `http://127.0.0.1:5000`.

Both the backend and frontend must be running for the dashboard to function — a "Connection Error" message in the output box means the Flask server isn't reachable.

---

## Project Structure

```
├── app.py                      # Flask API — routes, virtual coordinate generation
├── sightseeing_optimizer_new.py  # Part A: DP + Pareto pruning
├── dynamic_router_new.py       # Part B: Branch-and-Bound DFS
├── index.html                  # Dashboard shell
├── style.css                   # Theming, layout, responsive design
├── script.js                   # UI logic, table generation, API calls, map rendering
```

---

## Roadmap / Bonus Directions

- Route animation or 3D map visualization for step-by-step playback of a computed route.
- Surfacing the `passenger_counts` table already returned by Part B's API in the dashboard UI.
- Optional real-time traffic weighting on the distance matrix for Part A/B.

---

## Team

**Team Dijkstra Trio** — Harsh Bansode, Himank Jain, Kakaday Barath Palash
Summer of Innovation Coding Club, IIT Dharwad