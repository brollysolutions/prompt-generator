import requests
import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
BASE_URL = "http://127.0.0.1:8000"

TEST_CASES = [
    {
        "name": "Project Management Landing Page",
        "input": {
            "user_input": "I want to build a SaaS landing page for a project management tool.",
            "answers": {
                "0": "Remote teams and startups",
                "1": "Project tracking, task management, team collaboration",
                "2": "Professional but energetic",
                "3": "Next.js and Tailwind CSS"
            },
            "questions": [
                {"question": "Who is the target audience?"},
                {"question": "What are the core features?"},
                {"question": "What is the desired tone?"},
                {"question": "What is the tech stack?"}
            ],
            "target_ai": "ChatGPT"
        },
        "gold_standard": """# Role & Persona
You are a world-class Copywriter and UX Strategist specializing in SaaS landing pages.

# Context & Background
The user is building a landing page for a project management tool. The target audience is remote teams and startups who need efficient project tracking, task management, and collaboration features.

# Core Objective
Generate high-converting landing page copy and structural layout using Next.js and Tailwind CSS components.

# Instructions
1. Create a compelling hero section.
2. Detail the core features (tracking, tasks, collaboration).
3. Use a professional but energetic tone.

# Rules & Constraints
- Focus on remote work benefits.
- Use Tailwind CSS naming conventions for UI suggestions.

# Expected Output Format
Clean markdown with sections for Hero, Features, and Tech Implementation."""
    }
]

def get_generated_prompt(test_case):
    print(f"Generating prompt for: {test_case['name']}...")
    response = requests.post(f"{BASE_URL}/generate-final-prompt", json=test_case["input"])
    if response.status_code == 200:
        data = response.json()
        return data.get("smart_prompt", "")
    else:
        print(f"Error calling API: {response.text}")
        return ""

def evaluate_match(generated, gold_standard):
    print("Evaluating match score via LLM-as-a-Judge...")
    eval_prompt = f"""You are an expert Prompt Evaluation Judge.
Compare the GENERATED PROMPT against the GOLD STANDARD REFERENCE PROMPT.
Rate the semantic similarity and quality match on a scale of 0 to 100, where 100 means the generated prompt perfectly captures all the intent, structure, and quality of the gold standard.

GOLD STANDARD:
{gold_standard}

GENERATED PROMPT:
{generated}

Return ONLY a JSON object:
{{
  "match_percentage": 85,
  "reasoning": "Brief explanation of why this score was given."
}}"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": eval_prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        print(f"Error during evaluation: {e}")
        return {"match_percentage": 0, "reasoning": str(e)}

def main():
    results = []
    for test in TEST_CASES:
        generated = get_generated_prompt(test)
        if generated:
            eval_result = evaluate_match(generated, test["gold_standard"])
            results.append({
                "test_case": test["name"],
                "match_percentage": eval_result.get("match_percentage"),
                "reasoning": eval_result.get("reasoning")
            })
        else:
            results.append({
                "test_case": test["name"],
                "match_percentage": 0,
                "reasoning": "Failed to generate prompt."
            })

    print("\n=== EVALUATION RESULTS ===")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
