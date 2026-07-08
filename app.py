import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import math
from sightseeing_optimizer_new import optimize_route
from dynamic_router_new import insert_new_request

app = Flask(__name__)
CORS(app)

# Helper function to arrange virtual nodes in a circle on a 100x100 grid
# Helper function to arrange virtual nodes in a circle over a real geographic area
# Helper function to arrange virtual nodes in a circle over India
def generate_virtual_coordinates(node_names):
    coords = {}
    n = len(node_names)
    if n == 0: return coords
    
    # Center of India (roughly Nagpur)
    center_lat, center_lng = 21.1458, 79.0882
    
    # A radius of 6 degrees will spread the points widely across Indian states
    radius = 6.0 
    
    for i, node in enumerate(node_names):
        angle = 2 * math.pi * i / n
        coords[node] = {
            "lat": round(center_lat + radius * math.sin(angle), 5),
            "lng": round(center_lng + radius * math.cos(angle), 5)
        }
    return coords

@app.route('/api/optimize_a', methods=['POST'])
def run_optimization_a():
    start_time = time.perf_counter()
    try:
        payload = request.get_json()
        result = optimize_route(payload)
        
        # Calculate and inject runtime
        result["runtime"] = f"{round(time.perf_counter() - start_time, 4)}s"
        
        all_nodes = list(payload["distance_matrix"].keys())
        result["coordinates"] = generate_virtual_coordinates(all_nodes)
        
        return jsonify({"status": "success", "data": result}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/optimize_b', methods=['POST'])
def run_optimization_b():
    start_time = time.perf_counter()
    try:
        payload = request.get_json()
        result = insert_new_request(payload)
        
        # Calculate and inject runtime (Part B uses ms)
        result["runtime_ms"] = round((time.perf_counter() - start_time) * 1000, 3)
        
        all_nodes = list(payload["distance_matrix"].keys())
        result["coordinates"] = generate_virtual_coordinates(all_nodes)
        
        return jsonify({"status": "success", "data": result}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    print("Team Dijkstra Backend API initialized on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)