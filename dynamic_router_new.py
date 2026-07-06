def calculate_route_distance(route_list, matrix):
    dist = 0
    for i in range(len(route_list) - 1):
        dist += matrix[route_list[i]][route_list[i+1]]
    return dist

def insert_new_request(payload):
    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    requests = payload["requests"]
    
    current_route = [payload["start"], payload["end"]]
    active_requests = {}
    final_dist = 0
    
    for req_id, req_data in requests.items():
        pickup = req_data["pickup"]
        drop = req_data["drop"]
        active_requests[req_id] = req_data
        
        best_route = None
        min_dist = float('inf')
        fail_reasons = set()
        
        # FIXED: Loop boundaries ensure insertions only happen BEFORE the 'End' node
        for i in range(1, len(current_route)):
            for j in range(i, len(current_route)):
                test_route = current_route[:i] + [pickup] + current_route[i:j] + [drop] + current_route[j:]
                
                # 1. Simulate passenger capacity at every node
                cap_ok = True
                current_cap = 0
                for node in test_route:
                    for a_req_id, a_req_data in active_requests.items():
                        if node == a_req_data["pickup"]:
                            current_cap += 1
                        elif node == a_req_data["drop"]:
                            current_cap -= 1
                    if current_cap > capacity:
                        cap_ok = False
                        break
                if not cap_ok:
                    fail_reasons.add("Capacity Exceeded")
                    continue
                    
                # 2. Check Flexibility Margin for ALL active passengers
                flex_ok = True
                for a_req_id, a_req_data in active_requests.items():
                    p_node = a_req_data["pickup"]
                    d_node = a_req_data["drop"]
                    
                    if p_node in test_route and d_node in test_route:
                        idx_p = test_route.index(p_node)
                        idx_d = test_route.index(d_node)
                        
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

        if best_route:
            current_route = best_route
            final_dist = min_dist
        else:
            reason_str = " and ".join(list(fail_reasons)) if fail_reasons else "Invalid Matrix/Route"
            return {"status": "rejected", "reason": f"Inserting '{req_id}' failed: {reason_str}."}

    return {"status": "accepted", "new_route": current_route, "total_dist": final_dist}