import time

def insert_new_request(payload):
    """
    Global exact search algorithm for dynamic ride-sharing.
    Computes the absolute global minimum by evaluating all valid sequences 
    of pickups and dropoffs for ALL active requests, enforcing capacity 
    and flexibility constraints at each step using Branch and Bound.
    """
    t_start = time.perf_counter()

    # ---- Basic input validation ----
    required = ["start", "end", "vehicle_capacity", "requests", "distance_matrix"]
    if not all(k in payload for k in required):
        raise ValueError("Missing required fields in payload.")

    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    requests = payload["requests"]
    start = payload["start"]
    end = payload["end"]

    def d(u, v):
        if u not in matrix or v not in matrix[u]:
            raise ValueError(f"Path '{u}' -> '{v}' missing in distance matrix.")
        return matrix[u][v]

    req_ids = list(requests.keys())
    num_reqs = len(req_ids)

    best_dist = float("inf")
    best_route_stops = None

    # DFS State Definitions:
    # curr_loc: string (current location name)
    # curr_dist: float (cumulative route distance)
    # picked_up: frozenset of req_ids currently in the vehicle or already processed
    # dropped_off: frozenset of req_ids that have reached their destination
    # curr_cap: int (current number of passengers in the vehicle)
    # path_stops: tuple of dicts tracking locations and events
    # pickup_dists: dict mapping req_id -> cumulative route distance at their specific pickup
    
    def dfs(curr_loc, curr_dist, picked_up, dropped_off, curr_cap, path_stops, pickup_dists):
        nonlocal best_dist, best_route_stops
        
        # Branch and Bound: Prune if current path is already longer/equal to the best known
        if curr_dist >= best_dist:
            return
            
        # Base Case: All requests have been dropped off
        if len(dropped_off) == num_reqs:
            final_travel = d(curr_loc, end)
            total_dist = curr_dist + final_travel
            
            if total_dist < best_dist:
                best_dist = total_dist
                # Finalize the stops with the destination node
                best_route_stops = path_stops + ({"location": end, "events": []},)
            return

        # Explore all valid next actions (Pickup or Dropoff)
        for rid in req_ids:
            req = requests[rid]
            
            # Option 1: Pickup this request
            if rid not in picked_up:
                if curr_cap + 1 <= capacity:
                    nxt_loc = req["pickup"]
                    travel = d(curr_loc, nxt_loc)
                    nxt_dist = curr_dist + travel
                    
                    nxt_stops = path_stops + ({"location": nxt_loc, "events": [(rid, "pickup")]},)
                    nxt_pickup_dists = pickup_dists.copy()
                    nxt_pickup_dists[rid] = nxt_dist
                    
                    dfs(nxt_loc, nxt_dist, picked_up | frozenset([rid]), dropped_off, curr_cap + 1, nxt_stops, nxt_pickup_dists)
            
            # Option 2: Dropoff this request
            elif rid in picked_up and rid not in dropped_off:
                nxt_loc = req["drop"]
                travel = d(curr_loc, nxt_loc)
                nxt_dist = curr_dist + travel
                
                # Enforce Flexibility Constraint strictly
                rider_dist = nxt_dist - pickup_dists[rid]
                max_allowed = req["base_distance"] + req["flexibility_margin"]
                
                if rider_dist <= max_allowed:
                    nxt_stops = path_stops + ({"location": nxt_loc, "events": [(rid, "drop")]},)
                    dfs(nxt_loc, nxt_dist, picked_up, dropped_off | frozenset([rid]), curr_cap - 1, nxt_stops, pickup_dists)

    # Initialize DFS from the Start Node
    initial_stops = ({"location": start, "events": []},)
    dfs(start, 0.0, frozenset(), frozenset(), 0, initial_stops, {})

    runtime_ms = round((time.perf_counter() - t_start) * 1000, 3)

    # Handle Infeasible Routes
    if best_route_stops is None:
        return {
            "status": "rejected",
            "reason": "No valid route combination satisfies capacity and flexibility constraints globally.",
            "runtime_ms": runtime_ms,
        }

    # Format Output for UI and Coordinates
    passenger_table = []
    route_names = []
    running = 0
    
    for stop in best_route_stops:
        route_names.append(stop["location"])
        labels = []
        for (rid, etype) in stop["events"]:
            running += 1 if etype == "pickup" else -1
            # Standardize label (e.g., "Pickup Req1")
            labels.append(f"{etype.capitalize()} {rid}")
            
        passenger_table.append({
            "location": stop["location"],
            "event": ", ".join(labels) if labels else "-",
            "passengers": running
        })

    return {
        "status": "accepted",
        "new_route": route_names,
        "total_dist": best_dist,
        "passenger_counts": passenger_table,
        "runtime_ms": runtime_ms,
    }