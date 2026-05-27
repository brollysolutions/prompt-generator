import re
import json

content = """
```json
{
  "title": "Personalized Diet Food Recommendation System",
  "summary": "Build a machine learning model to recommend personalized diet food based on user input.",
  "role": "You are a machine learning engineer tasked with developing a web application.",
  "context": "The user has specific dietary restrictions and fitness goals, requiring a tailored approach.",
  "task": "Develop a web application with a REST API using Python and scikit-learn to provide personalized diet food recommendations.",
  "constraints": "The application must accommodate vegetarian and gluten-free diets, support weight loss and muscle gain, and adhere to a 2000 calorie daily intake.",
  "output_format": "The final model should be integrated into a web application with a user-friendly interface.",
  "tone": "Professional and technical"
```
"""

fallback = {
    "title": "Your Smart Prompt",
    "summary": "A detailed AI prompt based on your inputs.",
    "role": "",
    "context": "",
    "task": "",
    "constraints": "",
    "output_format": "",
    "tone": ""
}

for key in fallback.keys():
    # Use re.DOTALL to match across lines, and match non-greedy or match up to the end-quote
    match = re.search(rf'"{key}"\s*:\s*"([^"]*?)"\s*(?:,|\n|}})', content, re.DOTALL)
    if match:
        fallback[key] = match.group(1)
    else:
        # Try a simpler match if that fails
        match_simple = re.search(rf'"{key}"\s*:\s*"([^"]*)"', content)
        if match_simple:
            fallback[key] = match_simple.group(1)

print(json.dumps(fallback, indent=2))
