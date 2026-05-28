from locust import HttpUser, task, between
import random

class SmartPromptUser(HttpUser):
    wait_time = between(1, 5)

    @task(1)
    def home(self):
        self.client.get("/")

    @task(3)
    def generate_questions(self):
        ideas = [
            "I want to build a SaaS landing page for a project management tool.",
            "I need a Python script to scrape news from a website.",
            "Write a blog post about the benefits of remote work.",
            "Create a workout plan for a beginner.",
            "Explain quantum computing to a 5-year old."
        ]
        self.client.post("/generate-questions", json={"user_input": random.choice(ideas)})

    @task(2)
    def generate_final_prompt(self):
        self.client.post("/generate-final-prompt", json={
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
        })

    @task(2)
    def score_prompt(self):
        prompts = [
            "You are a professional project manager. Help me organize my team tasks.",
            "Write a technical blog post about React hooks with examples.",
            "Explain how to use FastAPI to build a REST API with Pydantic models."
        ]
        self.client.post("/score-prompt", json={"prompt": random.choice(prompts)})
