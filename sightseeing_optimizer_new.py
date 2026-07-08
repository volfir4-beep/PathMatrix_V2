import math
import time


def optimize_route(payload):
    """
    Finds the sightseeing route maximising total effective satisfaction
    within a distance budget, applying satisfaction decay and category penalties.

    DP formulation:
      State = (visited_set, current_location)
      For a fixed visited_set, the category-penalty decision for the NEXT
      location to add depends only on how many locations of that category
      are already in visited_set (a pure function of the set, not the order
      used to reach it) -- so we don't need to enumerate permutations of the
      set, only the set itself.
      Distance/decay still varies by the order used to reach (set, node), so
      for each (set, node) we keep every "non-dominated" (distance, score)
      pair: if one path is both cheaper AND higher-scoring than another for
      the same (set, node), the worse one can never lead to a better final
      answer and is discarded (Pareto pruning).
    This keeps the algorithm exact (guaranteed optimal, same as the original
    brute-force DFS) while cutting the complexity from O(n!) to roughly
    O(2^n * n * frontier_size), which is dramatically smaller in practice.
    """
    t_start = time.perf_counter()

    # ---- Basic input validation ----
    required_top = ["start", "end", "distance_budget", "category_threshold", "locations", "distance_matrix"]
    missing = [k for k in required_top if k not in payload]
    if missing:
        raise ValueError(f"Missing required field(s): {', '.join(missing)}")

    start = payload["start"]
    end = payload["end"]
    budget = payload["distance_budget"]
    threshold = payload["category_threshold"]
    locations = payload["locations"]
    matrix = payload["distance_matrix"]

    if not isinstance(budget, (int, float)) or budget < 0:
        raise ValueError(f"distance_budget must be a non-negative number, got {budget!r}")
    if not isinstance(threshold, (int, float)) or threshold < 0:
        raise ValueError(f"category_threshold must be a non-negative number, got {threshold!r}")
    if start not in matrix or end not in matrix:
        raise ValueError(f"'{start}' or '{end}' is missing from distance_matrix")

    for name, info in locations.items():
        if "score" not in info or "category" not in info:
            raise ValueError(f"Location '{name}' is missing 'score' or 'category'")
        if name not in matrix:
            raise ValueError(f"Location '{name}' is missing from distance_matrix")

    loc_names = list(locations.keys())
    n = len(loc_names)
    categories = [locations[name]["category"] for name in loc_names]
    scores = [locations[name]["score"] for name in loc_names]

    def d(u, v):
        try:
            return matrix[u][v]
        except KeyError as e:
            raise ValueError(f"distance_matrix is missing an entry: {u} -> {v}") from e

    # Each DP state is a dict: mask, node (-1 = still at `start`), dist, score, prev(state or None)
    start_state = {"mask": 0, "node": -1, "dist": 0.0, "score": 0.0, "prev": None}
    frontier = {(0, -1): [start_state]}

    best_state = None
    best_score = float("-inf")

    def consider_finish(state):
        nonlocal best_state, best_score
        cur_name = start if state["node"] == -1 else loc_names[state["node"]]
        finish_dist = state["dist"] + d(cur_name, end)
        # FIXED: was `<` in the old code, which could skip the only feasible
        # route when a location sat exactly on the budget boundary.
        if finish_dist <= budget and state["score"] > best_score:
            best_score = state["score"]
            best_state = state

    consider_finish(start_state)

    masks_by_popcount = sorted(range(1 << n), key=lambda m: bin(m).count("1"))

    for mask in masks_by_popcount:
        node_candidates = [-1] if mask == 0 else [i for i in range(n) if mask & (1 << i)]
        for node_idx in node_candidates:
            key = (mask, node_idx)
            states = frontier.get(key)
            if not states:
                continue
            cur_name = start if node_idx == -1 else loc_names[node_idx]

            # Category counts within this SET -- order-independent (see docstring).
            cat_counts = {}
            for i in range(n):
                if mask & (1 << i):
                    c = categories[i]
                    cat_counts[c] = cat_counts.get(c, 0) + 1

            for state in states:
                d0 = state["dist"]
                s0 = state["score"]
                for nxt in range(n):
                    bit = 1 << nxt
                    if mask & bit:
                        continue
                    nxt_name = loc_names[nxt]
                    travel = d(cur_name, nxt_name)
                    new_dist = d0 + travel
                    # FIXED boundary bug: <= not <, and this now checks reachability
                    # to `end` explicitly rather than a loose "< budget" heuristic.
                    if new_dist + d(nxt_name, end) > budget:
                        continue

                    eff = scores[nxt] * math.exp(-0.1 * d0)
                    c = categories[nxt]
                    if cat_counts.get(c, 0) + 1 > threshold:
                        eff *= 0.9
                    new_score = s0 + eff
                    new_mask = mask | bit
                    new_state = {"mask": new_mask, "node": nxt, "dist": new_dist,
                                 "score": new_score, "prev": state}

                    nk = (new_mask, nxt)
                    bucket = frontier.get(nk, [])
                    dominated = False
                    kept = []
                    for existing in bucket:
                        if existing["dist"] <= new_dist and existing["score"] >= new_score:
                            dominated = True
                            kept.append(existing)
                        elif new_dist <= existing["dist"] and new_score >= existing["score"]:
                            pass  # existing is dominated by new_state -> drop it
                        else:
                            kept.append(existing)
                    if not dominated:
                        kept.append(new_state)
                    frontier[nk] = kept

                    if not dominated:
                        consider_finish(new_state)

    runtime_ms = round((time.perf_counter() - t_start) * 1000, 3)

    if best_state is None:
        return {
            "optimal_route": [],
            "total_score": 0.0,
            "feasible": False,
            "message": "No feasible route exists within the given distance budget.",
            "runtime_ms": runtime_ms,
        }

    path_nodes = []
    s = best_state
    while s is not None:
        if s["node"] != -1:
            path_nodes.append(loc_names[s["node"]])
        s = s["prev"]
    path_nodes.reverse()
    route = [start] + path_nodes + [end]

    return {
        "optimal_route": route,
        "total_score": round(best_score, 3),
        "feasible": True,
        "runtime_ms": runtime_ms,
    }