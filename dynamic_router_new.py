import time


def calculate_route_distance(names, matrix):
    dist = 0
    for i in range(len(names) - 1):
        dist += matrix[names[i]][names[i + 1]]
    return dist


def insert_new_request(payload):
    """
    Inserts ride requests one at a time into a route, respecting pickup-before-
    drop ordering, vehicle capacity, and each request's flexibility margin.

    FIXED vs the original: capacity and flexibility used to be checked by
    matching *location names* (test_route.index(name), name == pickup/drop).
    That breaks whenever two different requests share a pickup/drop location
    name (e.g. a common hub) -- both requests' deltas fire on the first
    occurrence of that name, causing false "Capacity Exceeded" rejections,
    and .index() silently returns the wrong occurrence for the flexibility
    distance calculation.
    Fix: track each stop as {"location": name, "events": [(req_id, type)]} so
    every pickup/drop is identified by its exact POSITION in the route, never
    by name matching.
    """
    t_start = time.perf_counter()

    # ---- Basic input validation ----
    required = ["start", "end", "vehicle_capacity", "requests", "distance_matrix"]
    missing = [k for k in required if k not in payload]
    if missing:
        raise ValueError(f"Missing required field(s): {', '.join(missing)}")

    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    requests = payload["requests"]
    start = payload["start"]
    end = payload["end"]

    if not isinstance(capacity, (int, float)):
        raise ValueError(f"vehicle_capacity must be a number, got {capacity!r}")
    if start not in matrix or end not in matrix:
        raise ValueError(f"'{start}' or '{end}' is missing from distance_matrix")

    for rid, r in requests.items():
        for key in ("pickup", "drop", "base_distance", "flexibility_margin"):
            if key not in r:
                raise ValueError(f"Request '{rid}' is missing '{key}'")
        if r["pickup"] not in matrix or r["drop"] not in matrix:
            raise ValueError(f"Request '{rid}' pickup/drop location missing from distance_matrix")

    stops = [
        {"location": start, "events": []},
        {"location": end, "events": []},
    ]
    active_requests = {}
    final_dist = calculate_route_distance([s["location"] for s in stops], matrix)

    def names_of(stop_list):
        return [s["location"] for s in stop_list]

    # Force strict sequential checking for Test Case 2.6
def simulate(stop_list):
    names = names_of(stop_list)
    cap = 0
    for stop in stop_list:
        for (rid, etype) in stop["events"]:
            cap += 1 if etype == "pickup" else -1
            # STRICT CAPACITY CHECK
            if cap > capacity: 
                return False, True, "Capacity Exceeded", None
    
    # ... rest of flexibility checks ...

        # 2. Flexibility margin, using exact event positions
        pickup_idx, drop_idx = {}, {}
        for idx, stop in enumerate(stop_list):
            for (rid, etype) in stop["events"]:
                if etype == "pickup":
                    pickup_idx[rid] = idx
                else:
                    drop_idx[rid] = idx

        for rid, req in active_requests.items():
            if rid not in pickup_idx or rid not in drop_idx:
                continue
            ip, idr = pickup_idx[rid], drop_idx[rid]
            if ip > idr:
                return True, False, "Pickup-after-Dropoff Order Violated", None
            rider_dist = calculate_route_distance(names[ip:idr + 1], matrix)
            max_allowed = req["base_distance"] + req["flexibility_margin"]
            if rider_dist > max_allowed:
                return True, False, "Flexibility Margin Exceeded", None

        total_dist = calculate_route_distance(names, matrix)
        return True, True, None, total_dist

    for req_id, req_data in requests.items():
        pickup = req_data["pickup"]
        drop = req_data["drop"]
        active_requests[req_id] = req_data

        best_stops = None
        min_dist = float("inf")
        fail_reasons = set()

        n = len(stops)
        for i in range(1, n):
            for j in range(i, n):
                test_stops = (
                    stops[:i]
                    + [{"location": pickup, "events": [(req_id, "pickup")]}]
                    + stops[i:j]
                    + [{"location": drop, "events": [(req_id, "drop")]}]
                    + stops[j:]
                )
                cap_ok, flex_ok, reason, total_dist = simulate(test_stops)
                if not cap_ok or not flex_ok:
                    fail_reasons.add(reason)
                    continue
                if total_dist < min_dist:
                    min_dist = total_dist
                    best_stops = test_stops

        if best_stops is not None:
            stops = best_stops
            final_dist = min_dist
        else:
            reason_str = " and ".join(sorted(fail_reasons)) if fail_reasons else "Invalid Matrix/Route"
            runtime_ms = round((time.perf_counter() - t_start) * 1000, 3)
            return {
                "status": "rejected",
                "reason": f"Inserting '{req_id}' failed: {reason_str}.",
                "runtime_ms": runtime_ms,
            }

    # Passenger-count-per-stop table (PS 2.7 "recommended" output)
    passenger_table = []
    running = 0
    for stop in stops:
        labels = []
        for (rid, etype) in stop["events"]:
            running += 1 if etype == "pickup" else -1
            labels.append(f"{'Pickup' if etype == 'pickup' else 'Dropoff'} {rid}")
        passenger_table.append({
            "location": stop["location"],
            "event": ", ".join(labels) if labels else "-",
            "passengers": running,
        })

    runtime_ms = round((time.perf_counter() - t_start) * 1000, 3)
    return {
        "status": "accepted",
        "new_route": names_of(stops),
        "total_dist": final_dist,
        "passenger_counts": passenger_table,
        "runtime_ms": runtime_ms,
    }