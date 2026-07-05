import math

def optimize_route(payload):
    start = payload["start"]
    end = payload["end"]
    budget = payload["distance_budget"]
    threshold = payload["category_threshold"]
    locations = payload["locations"]
    matrix = payload["distance_matrix"]
    
    best_route = []
    max_score = -1.0
    loc_names = list(locations.keys())
    
    # DFS function to explore routes efficiently
    def dfs(current_node, current_dist, current_score, visited, category_counts, path):
        nonlocal best_route, max_score
        
        # 1. Check if we can safely return to the destination
        dist_to_end = matrix[current_node][end]
        if current_dist + dist_to_end <= budget:
            if current_score > max_score:
                max_score = current_score
                best_route = path + [end]
                
        # 2. Explore next possible locations
        for nxt in loc_names:
            if nxt not in visited:
                travel_dist = matrix[current_node][nxt]
                nxt_dist = current_dist + travel_dist
                
                # Pruning: Only proceed if the next jump doesn't blow our budget
                if nxt_dist < budget:
                    # FIX: Decay uses current_dist (cumulative distance BEFORE reaching)
                    base_score = locations[nxt]["score"]
                    effective_score = base_score * math.exp(-0.1 * current_dist)
                    
                    # Category tracking
                    cat = locations[nxt]["category"]
                    nxt_cat_counts = category_counts.copy()
                    nxt_cat_counts[cat] = nxt_cat_counts.get(cat, 0) + 1
                    
                    if nxt_cat_counts[cat] > threshold:
                        effective_score *= 0.90
                        
                    # Backtracking step
                    visited.add(nxt)
                    dfs(nxt, nxt_dist, current_score + effective_score, visited, nxt_cat_counts, path + [nxt])
                    visited.remove(nxt)

    # Initialize DFS from the starting location
    dfs(start, 0.0, 0.0, set(), {}, [start])

    return {
        "optimal_route": best_route,
        "total_score": round(max_score, 3) # Rounded to 3 decimals per PDF examples
    }