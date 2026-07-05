def calculate_route_distance(route_list, matrix):
    dist = 0
    for i in range(len(route_list) - 1):
        dist += matrix[route_list[i]][route_list[i+1]]
    return dist

def insert_new_request(payload):
    route = payload["current_route"]
    matrix = payload["distance_matrix"]
    capacity = payload["vehicle_capacity"]
    active_requests = payload.get("active_requests", {}) 
    new_req = payload["new_request"]
    
    # Merge new request with active ones to validate everyone
    all_reqs = active_requests.copy()
    new_req_id = new_req.get("id", "NEW_REQ")
    all_reqs[new_req_id] = new_req
    
    pickup = new_req["pickup"]
    drop = new_req["drop"]
    
    best_route = None
    min_dist = float('inf')
    
    for i in range(1, len(route)):
        for j in range(i, len(route) + 1):
            test_route = route[:i] + [pickup] + route[i:j] + [drop] + route[j:]
            
            # 1. Simulate passenger capacity at every node
            cap_ok = True
            current_cap = 0
            for node in test_route:
                for req_id, req_data in all_reqs.items():
                    if node == req_data["pickup"]:
                        current_cap += 1
                    elif node == req_data["drop"]:
                        current_cap -= 1
                if current_cap > capacity:
                    cap_ok = False
                    break
            if not cap_ok:
                continue
                
            # 2. Check Flexibility Margin for ALL passengers
            flex_ok = True
            for req_id, req_data in all_reqs.items():
                p_node = req_data["pickup"]
                d_node = req_data["drop"]
                
                if p_node in test_route and d_node in test_route:
                    idx_p = test_route.index(p_node)
                    idx_d = test_route.index(d_node)
                    
                    if idx_p > idx_d: # Pickup must always be before drop
                        flex_ok = False
                        break
                        
                    rider_dist = calculate_route_distance(test_route[idx_p:idx_d+1], matrix)
                    max_allowed = req_data["base_distance"] + req_data["flexibility_margin"]
                    
                    if rider_dist > max_allowed:
                        flex_ok = False
                        break
            if not flex_ok:
                continue
                
            # 3. Optimization Check
            total_dist = calculate_route_distance(test_route, matrix)
            if total_dist < min_dist:
                min_dist = total_dist
                best_route = test_route

    if best_route:
        return {"status": "accepted", "new_route": best_route, "total_dist": min_dist}
    else:
        return {"status": "rejected", "reason": "Violates capacity or flexibility constraints"}