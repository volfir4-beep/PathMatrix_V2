def calculate_route_distance(route_list, matrix):
    dist = 0
    for i in range(len(route_list) - 1):
        a, b = route_list[i], route_list[i+1]
        if a == b:
            # Same physical location twice in a row (e.g. drop one passenger,
            # pick up another at the same spot) costs 0 distance. Most distance
            # matrices don't bother listing self-distances, so we shouldn't
            # require matrix[a][a] to exist.
            continue
        dist += matrix[a][b]
    return dist

def insert_new_request(payload):
    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    requests = payload["requests"]

    current_route = [payload["start"], payload["end"]]
    active_requests = {}

    # NEW: track each active request's pickup/drop as INDEX POSITIONS in current_route,
    # instead of looking them up by name later. This is what fixes the shared-node crash --
    # list.index() can't tell apart two different route slots that happen to share a name,
    # but an explicitly tracked index always points to the right slot.
    request_slots = {}  # req_id -> (pickup_index, drop_index)

    final_dist = 0

    for req_id, req_data in requests.items():
        pickup = req_data["pickup"]
        drop = req_data["drop"]
        active_requests[req_id] = req_data

        best_route = None
        best_slots = None
        min_dist = float('inf')
        fail_reasons = set()

        # FIXED: Loop boundaries ensure insertions only happen BEFORE the 'End' node
        for i in range(1, len(current_route)):
            for j in range(i, len(current_route)):
                test_route = current_route[:i] + [pickup] + current_route[i:j] + [drop] + current_route[j:]

                # Recompute every active request's slot in the NEW route.
                # Inserting 2 new elements at position i/j shifts anything at or
                # after those positions -- this is pure arithmetic, no name lookups.
                def shifted(idx):
                    if idx < i:
                        return idx
                    elif idx < j:
                        return idx + 1
                    else:
                        return idx + 2

                test_slots = {rid: (shifted(p), shifted(d)) for rid, (p, d) in request_slots.items()}
                test_slots[req_id] = (i, j + 1)  # this request's own slot in test_route

                # 1. Simulate passenger capacity at every node, using index-based events
                #    instead of matching on location name.
                events_by_index = {}
                for rid, (p_idx, d_idx) in test_slots.items():
                    events_by_index[p_idx] = 1   # pickup -> +1 occupancy
                    events_by_index[d_idx] = -1  # drop   -> -1 occupancy

                cap_ok = True
                current_cap = 0
                for k in range(len(test_route)):
                    if k in events_by_index:
                        current_cap += events_by_index[k]
                    if current_cap > capacity:
                        cap_ok = False
                        break
                if not cap_ok:
                    fail_reasons.add("Capacity Exceeded")
                    continue

                # 2. Check Flexibility Margin for ALL active passengers, using their
                #    tracked index positions (not name lookups).
                flex_ok = True
                for a_req_id, a_req_data in active_requests.items():
                    idx_p, idx_d = test_slots[a_req_id]

                    if idx_p > idx_d:
                        flex_ok = False
                        break

                    rider_dist = calculate_route_distance(test_route[idx_p:idx_d+1], matrix)
                    max_allowed = a_req_data["base_distance"] + a_req_data["flexibility_margin"]

                    if rider_dist > max_allowed:
                        flex_ok = False
                        break
                if not flex_ok:
                    fail_reasons.add("Flexibility Margin Exceeded")
                    continue

                # 3. Optimization Check
                total_dist = calculate_route_distance(test_route, matrix)
                if total_dist < min_dist:
                    min_dist = total_dist
                    best_route = test_route
                    best_slots = test_slots

        if best_route:
            current_route = best_route
            request_slots = best_slots
            final_dist = min_dist
        else:
            reason_str = " and ".join(list(fail_reasons)) if fail_reasons else "Invalid Matrix/Route"
            return {"status": "rejected", "reason": f"Inserting '{req_id}' failed: {reason_str}."}

    return {"status": "accepted", "new_route": current_route, "total_dist": final_dist}