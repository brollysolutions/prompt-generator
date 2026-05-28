from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

payload = {
    "user_input": "Build a personalized diet food recommendation system using machine learning",
    "answers": {
        "0": "2000 calories per day",
        "1": "Vegetarian and gluten-free",
        "2": "Weight loss and muscle gain",
        "3": "Python with scikit-learn",
        "4": "Web application with REST API"
    },
    "questions": [
        {"question": "What is your daily caloric intake goal?", "type": "text"},
        {"question": "Do you have any dietary restrictions?", "type": "text"},
        {"question": "What are your primary fitness goals?", "type": "text"},
        {"question": "Which ML framework do you prefer?", "type": "text"},
        {"question": "What type of application should this be?", "type": "text"}
    ]
}

print("Calling /generate-final-prompt ...")
r = client.post("/generate-final-prompt", json=payload)
data = r.json()

print("\n=== TITLE ===")
print(data.get("title", "MISSING"))

print("\n=== SUMMARY ===")
print(data.get("summary", "MISSING"))

print(f"\n=== SMART PROMPT ({len(data.get('smart_prompt', ''))} chars) ===")
print(data.get("smart_prompt", "MISSING"))

print("\n=== ROLE ===")
print(data.get("role", "MISSING"))

print("\n=== TASK ===")
print(data.get("task", "MISSING"))
