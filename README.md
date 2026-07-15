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

**Approach — two modes, chosen automatically per request:**

1. **Incremental insertion (fast path).** When a new request arrives on top of an already-accepted route, we try every valid `(pickup_slot, drop_slot)` pair for slotting its pickup and dropoff into the *existing* stop sequence — including interleaved slots, not just appending at the end — and re-validate capacity plus **every** request's flexibility margin (old and new) against the resulting route. The cheapest feasible slot wins. No previous stop is ever reordered or removed; only the two new stops are placed.
2. **Exact global search (fallback).** If incremental insertion can't find any feasible slot for the new request — or on the very first request, where there's no existing route to insert into — we fall back to a Branch-and-Bound DFS over **all** active requests: branching on "pick up request X" / "drop off request X" at each step, backtracking whenever a partial route already exceeds the best complete route found so far. This guarantees the true global-minimum-distance route.

This gives cheap, near-instant updates for the common case of one request arriving at a time, while never accepting a route that's actually infeasible or leaving a request unnecessarily rejected just because the fast path couldn't place it — the exact search is always there as a safety net. Each API response reports which mode was used (`method: "incremental_insertion"`, `"global_recompute_fallback"`, or `"global_recompute"`), and the dashboard surfaces this to the user.

**Statelessness.** The backend holds no server-side session — each accepted response includes the full stop/event sequence (`route_stops`), which the frontend caches and sends back as `previous_route_stops` on the next call. This keeps the API a pure function of its input, at the cost of the client being responsible for tracking "what was last accepted."

**Output.** Alongside the route and total distance, the backend also returns a stop-by-stop passenger count table (`passenger_counts`) showing occupancy at every pickup/dropoff — rendered directly in the Part B dashboard output.

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

First call (no prior route — always exact global search):
```json
{
  "start": "S",
  "end": "E",
  "vehicle_capacity": 2,
  "requests": {
    "Req1": { "pickup": "P1", "drop": "D1", "base_distance": 5, "flexibility_margin": 2 }
  },
  "distance_matrix": { "...": "..." }
}
```

Subsequent call, a new request arrives — pass back what the previous call returned as `route_stops`, plus the id of the new request, to attempt fast incremental insertion:
```json
{
  "start": "S",
  "end": "E",
  "vehicle_capacity": 2,
  "requests": {
    "Req1": { "pickup": "P1", "drop": "D1", "base_distance": 5, "flexibility_margin": 2 },
    "Req2": { "pickup": "P2", "drop": "D2", "base_distance": 4, "flexibility_margin": 3 }
  },
  "distance_matrix": { "...": "..." },
  "previous_route_stops": [ "...as returned in the prior response's route_stops..." ],
  "new_request_id": "Req2"
}
```

Returns `status` (`accepted`/`rejected`), `new_route`, `total_dist`, `passenger_counts`, `route_stops` (cache this for the next call), `method` (`incremental_insertion` / `global_recompute_fallback` / `global_recompute`), `runtime_ms`, plus `coordinates`.

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
- Optional real-time traffic weighting on the distance matrix for Part A/B.
- Persisting `route_stops` server-side (e.g. keyed by session) as an alternative to client-side caching, for multi-client scenarios.

---

## Team

**Team Dijkstra Trio** — Harsh Bansode, Himank Jain, Kakaday Barath Palash
Summer of Innovation Coding Club, IIT Dharwad