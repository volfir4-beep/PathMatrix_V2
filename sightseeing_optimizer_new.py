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

    # OPTIMIZATION 1: Explore highest-scoring locations first. This doesn't change
    # the final answer (DFS still considers every valid branch unless pruned) but
    # it finds a strong max_score early, which makes the pruning below far more
    # effective from the very start of the search.
    loc_names.sort(key=lambda name: locations[name]["score"], reverse=True)

    # Precompute the total base score across all locations once, so that at any
    # point in the search we can cheaply work out "sum of base scores not yet visited".
    total_base_score = sum(locations[name]["score"] for name in loc_names)

    # DFS function to explore routes efficiently, now with branch-and-bound pruning
    def dfs(current_node, current_dist, current_score, visited, category_counts, path, visited_base_sum):
        nonlocal best_route, max_score

        # 1. Check if we can safely return to the destination
        dist_to_end = matrix[current_node][end]
        if current_dist + dist_to_end <= budget:
            if current_score > max_score:
                max_score = current_score
                best_route = path + [end]

        # OPTIMIZATION 2: Branch-and-bound pruning.
        # Satisfaction only ever decays with distance (never grows), and the category
        # penalty only ever reduces score (never increases it). So the best possible
        # score any remaining unvisited location could still contribute, from this
        # point onward, is capped at:
        #     its base score * exp(-0.1 * current_dist)
        # (using the CURRENT cumulative distance is a safe over-estimate, since any
        # future visit can only happen at an equal or greater distance, where decay
        # is equal or worse -- never better). Summing that over every unvisited
        # location gives a guaranteed ceiling on how much more score is achievable.
        # If even that best case can't beat what we've already found, this whole
        # branch is dead -- prune it without exploring any children.
        remaining_base_score = total_base_score - visited_base_sum
        upper_bound = current_score + remaining_base_score * math.exp(-0.1 * current_dist)
        if upper_bound <= max_score:
            return

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
                    dfs(nxt, nxt_dist, current_score + effective_score, visited, nxt_cat_counts,
                        path + [nxt], visited_base_sum + base_score)
                    visited.remove(nxt)

    # Initialize DFS from the starting location
    dfs(start, 0.0, 0.0, set(), {}, [start], 0.0)

    return {
        "optimal_route": best_route,
        "total_score": round(max_score, 3)  # Rounded to 3 decimals per PDF examples
    }