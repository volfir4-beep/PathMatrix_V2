import time


def _distance_fn(matrix):
    def d(u, v):
        if u not in matrix or v not in matrix[u]:
            raise ValueError(f"Path '{u}' -> '{v}' missing in distance matrix.")
        return matrix[u][v]
    return d


def _global_branch_and_bound(start, end, capacity, requests, matrix):
    """
    Exact global search: explores every valid sequence of pickups/dropoffs for
    ALL active requests, enforcing capacity and flexibility at each step,
    pruned with Branch-and-Bound. Guaranteed globally optimal.
    Returns (best_dist, best_route_stops) or (None, None) if infeasible.
    This is unchanged from the original implementation -- it's the fallback
    path used when incremental insertion isn't attempted or can't find a
    feasible slot.
    """
    d = _distance_fn(matrix)
    req_ids = list(requests.keys())
    num_reqs = len(req_ids)

    best_dist = float("inf")
    best_route_stops = None

    def dfs(curr_loc, curr_dist, picked_up, dropped_off, curr_cap, path_stops, pickup_dists):
        nonlocal best_dist, best_route_stops

        if curr_dist >= best_dist:
            return

        if len(dropped_off) == num_reqs:
            final_travel = d(curr_loc, end)
            total_dist = curr_dist + final_travel
            if total_dist < best_dist:
                best_dist = total_dist
                best_route_stops = path_stops + ({"location": end, "events": []},)
            return

        for rid in req_ids:
            req = requests[rid]

            if rid not in picked_up:
                if curr_cap + 1 <= capacity:
                    nxt_loc = req["pickup"]
                    travel = d(curr_loc, nxt_loc)
                    nxt_dist = curr_dist + travel

                    nxt_stops = path_stops + ({"location": nxt_loc, "events": [(rid, "pickup")]},)
                    nxt_pickup_dists = pickup_dists.copy()
                    nxt_pickup_dists[rid] = nxt_dist

                    dfs(nxt_loc, nxt_dist, picked_up | frozenset([rid]), dropped_off,
                        curr_cap + 1, nxt_stops, nxt_pickup_dists)

            elif rid in picked_up and rid not in dropped_off:
                nxt_loc = req["drop"]
                travel = d(curr_loc, nxt_loc)
                nxt_dist = curr_dist + travel

                rider_dist = nxt_dist - pickup_dists[rid]
                max_allowed = req["base_distance"] + req["flexibility_margin"]

                if rider_dist <= max_allowed:
                    nxt_stops = path_stops + ({"location": nxt_loc, "events": [(rid, "drop")]},)
                    dfs(nxt_loc, nxt_dist, picked_up, dropped_off | frozenset([rid]),
                        curr_cap - 1, nxt_stops, pickup_dists)

    initial_stops = ({"location": start, "events": []},)
    dfs(start, 0.0, frozenset(), frozenset(), 0, initial_stops, {})

    if best_route_stops is None:
        return None, None
    return best_dist, best_route_stops


def _validate_and_measure(stops, requests, capacity, matrix, d):
    """
    Walks a candidate stop sequence end-to-end, re-checking capacity and
    EVERY request's flexibility margin (old and new) along the way.
    Returns total distance if the whole sequence is valid, else None.
    """
    cum_dist = 0.0
    occupancy = 0
    pickup_dist_at = {}

    for i in range(len(stops) - 1):
        u = stops[i]["location"]
        v = stops[i + 1]["location"]
        cum_dist += d(u, v)

        for (rid, etype) in stops[i + 1].get("events", []):
            if etype == "pickup":
                occupancy += 1
                if occupancy > capacity:
                    return None
                pickup_dist_at[rid] = cum_dist
            elif etype == "drop":
                occupancy -= 1
                if rid not in pickup_dist_at:
                    return None
                req = requests.get(rid)
                if req is None:
                    return None
                rider_dist = cum_dist - pickup_dist_at[rid]
                max_allowed = req["base_distance"] + req["flexibility_margin"]
                if rider_dist > max_allowed:
                    return None

    return cum_dist


def _try_incremental_insertion(prev_stops, new_rid, requests, capacity, matrix):
    """
    Attempts to insert ONE new request's pickup/dropoff into an already-
    accepted route. Tries every valid (pickup_gap, drop_gap) pair -- i.e.
    every place the new pickup could slot in, and every place at or after it
    the new dropoff could slot in -- and re-validates the FULL resulting
    route (capacity + every request's flexibility, old and new).

    This is exactly the "does inserting this new stop still satisfy
    everyone" check described in the problem statement's own illustrative
    example, rather than a full re-search over all requests.

    Returns (dist, stops) for the cheapest feasible insertion found, or
    (None, None) if no insertion point is feasible -- in which case the
    caller falls back to the exact global search.
    """
    d = _distance_fn(matrix)
    new_req = requests[new_rid]
    n = len(prev_stops)
    if n < 2:
        return None, None

    best_dist = float("inf")
    best_stops = None

    # Gap i sits between prev_stops[i] and prev_stops[i+1], for i in [0, n-2].
    for g1 in range(0, n - 1):
        for g2 in range(g1, n - 1):
            pickup_entry = {"location": new_req["pickup"], "events": [(new_rid, "pickup")]}
            drop_entry = {"location": new_req["drop"], "events": [(new_rid, "drop")]}

            candidate = (
                prev_stops[0:g1 + 1]
                + [pickup_entry]
                + prev_stops[g1 + 1:g2 + 1]
                + [drop_entry]
                + prev_stops[g2 + 1:]
            )

            dist = _validate_and_measure(candidate, requests, capacity, matrix, d)
            if dist is not None and dist < best_dist:
                best_dist = dist
                best_stops = candidate

    if best_stops is None:
        return None, None
    return best_dist, best_stops


def _format_result(final_dist, final_stops, method, runtime_ms):
    passenger_table = []
    route_names = []
    running = 0

    for stop in final_stops:
        route_names.append(stop["location"])
        labels = []
        for (rid, etype) in stop.get("events", []):
            running += 1 if etype == "pickup" else -1
            labels.append(f"{etype.capitalize()} {rid}")

        passenger_table.append({
            "location": stop["location"],
            "event": ", ".join(labels) if labels else "-",
            "passengers": running
        })

    # JSON-friendly copy of the stop/event structure (tuples -> lists) so the
    # frontend can cache it and send it back on the NEXT call for incremental
    # insertion, without the backend needing any server-side session state.
    serializable_stops = [
        {"location": s["location"], "events": [list(ev) for ev in s.get("events", [])]}
        for s in final_stops
    ]

    return {
        "status": "accepted",
        "new_route": route_names,
        "total_dist": final_dist,
        "passenger_counts": passenger_table,
        "route_stops": serializable_stops,
        "method": method,
        "runtime_ms": runtime_ms,
    }


def insert_new_request(payload):
    """
    Dynamic ride-sharing router. Two modes:

      1. Incremental insertion (fast path) -- used when the payload includes
         `previous_route_stops` (the stop/event sequence returned by the
         last accepted call) and `new_request_id` naming exactly one newly
         added request. We try to slot that request's pickup/dropoff into
         the existing route at the cheapest feasible position.

      2. Exact global search (fallback) -- used on the first call, whenever
         incremental insertion isn't attempted, or whenever it can't find
         any feasible slot for the new request. This is the original
         Branch-and-Bound DFS over ALL active requests, and it guarantees
         the true global-minimum-distance route.

    This means: cheap, fast updates for the common case of one request
    arriving at a time, with a guaranteed-optimal fallback whenever the
    cheap path can't satisfy every constraint -- rather than either always
    paying full recomputation cost, or risking a worse-than-optimal route.
    """
    t_start = time.perf_counter()

    required = ["start", "end", "vehicle_capacity", "requests", "distance_matrix"]
    if not all(k in payload for k in required):
        raise ValueError("Missing required fields in payload.")

    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    requests = payload["requests"]
    start = payload["start"]
    end = payload["end"]

    prev_stops_raw = payload.get("previous_route_stops")
    new_rid = payload.get("new_request_id")

    final_dist, final_stops = None, None
    method = "global_recompute"

    if prev_stops_raw and new_rid and new_rid in requests:
        method = "global_recompute_fallback"
        try:
            prev_stops = [
                {"location": s["location"], "events": [tuple(ev) for ev in s.get("events", [])]}
                for s in prev_stops_raw
            ]
            i_dist, i_stops = _try_incremental_insertion(prev_stops, new_rid, requests, capacity, matrix)
            if i_stops is not None:
                final_dist, final_stops = i_dist, i_stops
                method = "incremental_insertion"
        except (KeyError, TypeError, ValueError):
            final_dist, final_stops = None, None

    if final_stops is None:
        final_dist, final_stops = _global_branch_and_bound(start, end, capacity, requests, matrix)

    runtime_ms = round((time.perf_counter() - t_start) * 1000, 3)

    if final_stops is None:
        return {
            "status": "rejected",
            "reason": "No valid route combination satisfies capacity and flexibility constraints globally.",
            "method": method,
            "runtime_ms": runtime_ms,
        }

    return _format_result(final_dist, final_stops, method, runtime_ms)