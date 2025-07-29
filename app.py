from flask import Flask, jsonify, render_template
import requests
import logging
import os

app = Flask(__name__)

COOKIES = {
    "USSQ-API-SESSION": "s%3AnP8iOvjFv4N5MtnTsq2NikJ0DhzWUQAK.nDc6GCWcX6fO3ek%2FnAlrRf9WXQNfWbWivmwg9bAymqA"
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
    
    
@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
