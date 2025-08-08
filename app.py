from flask import Flask, jsonify, render_template, request
import requests
import logging
import os

app = Flask(__name__)

COOKIES = {
    "USSQ-API-SESSION": "s%3APE8jY-sfNLcTxNMF7OpMObK_-uam7Dxj.Ng8VsElXZGW%2F6Uj4zplmu1%2BnIdIpBZYaJMlpoaxydEs"
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route("/proxy/user/<int:user_id>/rankings")
def proxy_user_rankings(user_id):
    api_url = f"https://api.ussquash.com/resources/res/user/{user_id}/rankings?history=yes"
    logger.info(f"Fetching user rankings from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {e}")
        return jsonify({"error": "Error fetching API data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/proxy/user/<int:user_id>/matches/page/<int:page>")
def proxy_user_matches(user_id, page):
    api_url = f"https://api.ussquash.com/resources/res/user/{user_id}/matches/page/{page}"
    logger.info(f"Fetching user matches from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {e}")
        return jsonify({"error": "Error fetching API data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/proxy/user/<int:user_id>/ratings")
def proxy_user_ratings(user_id):
    api_url = f"https://api.ussquash.com/resources/res/user/{user_id}/ratings"
    logger.info(f"Fetching user ratings from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {e}")
        return jsonify({"error": "Error fetching API data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/proxy/user/<int:user_id>/ratings-top")
def proxy_user_ratings_top(user_id):
    api_url = f"https://api.ussquash.com/resources/res/user/{user_id}/ratings-top"
    logger.info(f"Fetching user top rating from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for ratings-top: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for ratings-top: {e}")
        return jsonify({"error": "Error fetching top rating API data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error for ratings-top: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/proxy/user/<int:user_id>/record")
def proxy_user_record(user_id):
    api_url = f"https://api.ussquash.com/resources/res/user/{user_id}/record"
    logger.info(f"Fetching user record from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for record API: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for record API: {e}")
        return jsonify({"error": "Error fetching user record data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error for record API: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/proxy/user/<int:user_id>")
def proxy_user_details(user_id):
    api_url = f"https://api.ussquash.com/resources/res/user/{user_id}"
    logger.info(f"Fetching user details from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for user details API: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for user details API: {e}")
        return jsonify({"error": "Error fetching user details."}), 500
    except Exception as e:
        logger.error(f"Unexpected error for user details API: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

# NEW ROUTE: Proxy for search API
@app.route("/proxy/resources/res/search/<query>")
def proxy_search(query):
    api_url = f"https://api.ussquash.com/resources/res/search/{query}"
    logger.info(f"Fetching search results from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for search API: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for search API: {e}")
        return jsonify({"error": "Error fetching search data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error for search API: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

# NEW ROUTE: Proxy for liveScoreDetails API
@app.route("/proxy/liveScoreDetails")
def proxy_live_score_details():
    match_id = request.args.get('match_id')
    if not match_id:
        return jsonify({"error": "match_id is required"}), 400
    
    api_url = f"https://api.ussquash.com/resources/res/matches/{match_id}/liveScoreDetails"
    logger.info(f"Fetching live score details from: {api_url}")
    try:
        response = requests.get(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for liveScoreDetails API: {e}")
        return jsonify({"error": str(e)}), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for liveScoreDetails API: {e}")
        return jsonify({"error": "Error fetching live score details data."}), 500
    except Exception as e:
        logger.error(f"Unexpected error for liveScoreDetails API: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500
    
@app.route("/proxy/player_tracker/add", methods=["POST"])
def proxy_add_to_tracker():
    try:
        data = request.get_json(force=True)
        app.logger.info(f"Received JSON data: {data}")

        if not data:
            return jsonify({"error": "No JSON data sent"}), 400

        player_id = data.get("playerId")
        if not player_id:
            return jsonify({"error": "Missing playerId"}), 400

        api_url = "https://api.ussquash.com/resources/res/player_tracker/add"
        payload = {"playerId": player_id}

        response = requests.post(
            api_url,
            cookies=COOKIES,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        response.raise_for_status()

        if response.content:
            api_response = response.json()
        else:
            api_response = {}

        return jsonify({"success": True, "data": api_response})

    except Exception as e:
        app.logger.error(f"Exception in proxy_add_to_tracker: {e}", exc_info=True)
        return jsonify({"error": "Server error occurred"}), 500
    


@app.route("/proxy/player_tracker/<int:player_id>", methods=["DELETE"])
def proxy_delete_player(player_id):
    try:
        api_url = f"https://api.ussquash.com/resources/res/player_tracker/{player_id}"
        response = requests.delete(api_url, cookies=COOKIES, timeout=10)
        response.raise_for_status()
        return jsonify({"success": True})
    except Exception as e:
        app.logger.error(f"Error deleting player {player_id}: {e}", exc_info=True)
        return jsonify({"error": "Server error occurred"}), 500



@app.route("/trackertool")
def trackertool():
    return render_template("trackertool.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/analytics")
def analytics():
    return render_template("analytics.html")

@app.route("/collegeteams")
def collegeteams():
    return render_template("collegeteams.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
