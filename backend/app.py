
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "project": "DocuFind AI",
        "message": "Backend is running successfully.",
        "status": "success"
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "DocuFind AI Backend"
    })


@app.route("/api/search", methods=["POST"])
def search():
    data = request.get_json(silent=True) or {}
    query = data.get("query", "").strip()

    if not query:
        return jsonify({
            "status": "error",
            "message": "Please provide a search query."
        }), 400

    return jsonify({
        "status": "success",
        "query": query,
        "message": (
            "The backend received your search query. "
            "Document search integration is not implemented yet."
        ),
        "results": []
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
