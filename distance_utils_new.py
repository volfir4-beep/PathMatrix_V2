def get_distance_matrix():
    """
    Returns a mock 2D dictionary representing our Distance Matrix.
    """
    return {
        "College": {"Museum": 4, "Fort": 6, "Temple": 8, "Beach": 40},
        "Museum": {"College": 4, "Fort": 3, "Temple": 5, "Beach": 35},
        "Fort": {"College": 6, "Museum": 3, "Temple": 4, "Beach": 32},
        "Temple": {"College": 8, "Museum": 5, "Fort": 4, "Beach": 28},
        "Beach": {"College": 40, "Museum": 35, "Fort": 32, "Temple": 28}
    }

    # Updated distance_utils.py snippet
def get_locations_with_coordinates():
    return {
        "Start": {"x": 10, "y": 50},
        "Museum": {"x": 30, "y": 70},
        "Park": {"x": 60, "y": 60},
        "End": {"x": 90, "y": 50}
    }