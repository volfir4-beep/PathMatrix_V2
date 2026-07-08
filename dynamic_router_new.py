import time

def calculate_route_distance(names, matrix):
    dist = 0
    for i in range(len(names) - 1):
        u, v = names[i], names[i + 1]
        if u not in matrix or v not in matrix[u]:
            raise ValueError(f"Path '{u}' -> '{v}' missing in distance matrix.")
        dist += matrix[u][v]
    return dist

def insert_new_request(payload):
    t_start = time.perf_counter()

    # ---- Basic input validation ----
    required = ["start", "end", "vehicle_capacity", "requests", "distance_matrix"]
    if not all(k in payload for k in required):
        raise ValueError("Missing required fields")

    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    requests = payload["requests"]
    start = payload["start"]
    end = payload["end"]

    stops = [
        {"location": start, "events": []},
        {"location": end, "events": []},
    ]
    active_requests = {}
    final_dist = calculate_route_distance([s["location"] for s in stops], matrix)

    def names_of(stop_list):
        return [s["location"] for s in stop_list]

    # NESTED SIMULATE FUNCTION (Now correctly indented)
    def simulate(stop_list):
        names = names_of(stop_list)
        
        # 1. Capacity check
        cap = 0
        for stop in stop_list:
            for (rid, etype) in stop["events"]:
                cap += 1 if etype == "pickup" else -1
            if cap > capacity: 
                return False, True, "Capacity Exceeded", None
        
        # 2. Flexibility margin
        pickup_idx, drop_idx = {}, {}
        for idx, stop in enumerate(stop_list):
            for (rid, etype) in stop["events"]:
                if etype == "pickup": pickup_idx[rid] = idx
                else: drop_idx[rid] = idx

        for rid, req in active_requests.items():
            if rid in pickup_idx and rid in drop_idx:
                ip, idr = pickup_idx[rid], drop_idx[rid]
                if ip > idr:
                    return True, False, "Pickup-after-Dropoff Order Violated", None
                rider_dist = calculate_route_distance(names[ip:idr + 1], matrix)
                max_allowed = req["base_distance"] + req["flexibility_margin"]
                if rider_dist > max_allowed:
                    return True, False, "Flexibility Margin Exceeded", None

        total_dist = calculate_route_distance(names, matrix)
        return True, True, None, total_dist

    # Main optimization loop
    for req_id, req_data in requests.items():
        active_requests[req_id] = req_data
        best_stops = None
        min_dist = float("inf")
        fail_reasons = set()

        n = len(stops)
        for i in range(1, n):
            for j in range(i, n):
                test_stops = (
                    stops[:i]
                    + [{"location": req_data["pickup"], "events": [(req_id, "pickup")]}]
                    + stops[i:j]
                    + [{"location": req_data["drop"], "events": [(req_id, "drop")]}]
                    + stops[j:]
                )
                
                cap_ok, flex_ok, reason, total_dist = simulate(test_stops)
                if not cap_ok or not flex_ok:
                    if reason: fail_reasons.add(reason)
                    continue
                
                if total_dist < min_dist:
                    min_dist = total_dist
                    best_stops = test_stops

        if best_stops is not None:
            stops = best_stops
            final_dist = min_dist
        else:
            reason_str = " and ".join(sorted(fail_reasons)) if fail_reasons else "Invalid Matrix"
            return {"status": "rejected", "reason": f"Inserting '{req_id}' failed: {reason_str}.", "runtime_ms": round((time.perf_counter() - t_start) * 1000, 3)}

    # Final output construction
    passenger_table = []
    running = 0
    for stop in stops:
        labels = []
        for (rid, etype) in stop["events"]:
            running += 1 if etype == "pickup" else -1
            labels.append(f"{etype.capitalize()} {rid}")
        passenger_table.append({"location": stop["location"], "event": ", ".join(labels) if labels else "-", "passengers": running})

    return {
        "status": "accepted",
        "new_route": names_of(stops),
        "total_dist": final_dist,
        "passenger_counts": passenger_table,
        "runtime_ms": round((time.perf_counter() - t_start) * 1000, 3),
    }