from locust import HttpUser, task, between
import random

class SmartPromptUser(HttpUser):
    wait_time = between(1, 5)

    @task(1)
    def home(self):
        self.client.get("/")

    # Designed Prompt for Question Generation
    QUESTION_GENERATION_PROMPT = """
    You are the **Lead Requirements Architect**, a world-class expert in information elicitation and prompt engineering. Your goal is to analyze a raw user idea and generate "High-Reasoning Clarification Questions" that will enable the creation of a production-ready AI tool.

    ### # Analysis Protocol
    Before generating questions, perform a domain-specific audit of the input:
    1. **Technical:** Identify the stack, environment, and scale.
    2. **Creative/Logic:** Determine the tone, perspective, and intended reasoning depth.
    3. **Missing Links:** Find the "invisible variables" that would lead to a generic output if not defined.

    ### # Task
    Analyze the following user idea and generate 5-7 highly relevant, clear, and context-aware questions.
    **IDEA:** "{user_input}"

    ### # Question Constraints
    - **Anti-Generic:** DO NOT ask "What is your goal?" or "Who is the audience?" generically. Instead, tailor them: "For this SaaS tool, is the target user a technical project manager or a non-technical small business owner?"
    - **Diversity:** Cover objectives, technical challenges, specific use cases, and missing constraints.
    - **Uniqueness:** Each question must extract a distinct variable that significantly changes the final AI output.
    - **Tone:** Professional, direct, and insightful.

    ### # Expected Output Format
    Respond ONLY with a JSON object. No conversational filler or meta-comments.
    {{
      "questions": [
        {{
          "question": "Clear and specific question text",
          "type": "radio | checkbox | dropdown | text | textarea",
          "options": ["If radio/checkbox/dropdown, provide 3-5 specific, smart options", "..."]
        }}
      ]
    }}
    """

    # Designed Prompt for Final Prompt Generation
    FINAL_PROMPT_GENERATION_PROMPT = """
    Act as an expert AI prompt engineer and design a prompt that takes an input idea and responses from the generated questions and generate a set of highly relevant, clear, and context-aware Prompt. 
    
    ### # Context
    - **Input Idea:** "{user_input}"
    - **User Responses:** {qa_context}
    
    ### # Task
    The Prompt should cover the key aspects, objectives, challenges, use cases, and important details related to the idea and responses from the generated questions, while avoiding ambiguity, repetition, and irrelevant content. 
    
    ### # Final Optimization
    Based on this generated prompt, create a final optimized prompt that can consistently produce accurate, comprehensive, and contextually aware results, ensuring high-quality output suitable for downstream AI processing.
    
    ### # Output Format
    Return ONLY the final optimized prompt text.
    """

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

    # Designed Prompt for Score Generation
    SCORE_GENERATION_PROMPT = """
    Act as an expert AI prompt engineer and design a prompt that takes generated final prompt as input and generates a set of highly relevant, clear, and context-aware score . The generated score should cover the key aspects, objectives, challenges, use cases, and important details related to the idea while avoiding ambiguity, repetition, and irrelevant content. Based on these generated prompt, create a final optimized score that can consistently produce accurate, comprehensive, and contextually relevant score for any given idea, ensuring high-quality output suitable for downstream AI processing.
    """

    @task(2)
    def score_prompt(self):
        prompts = [
            "You are a professional project manager. Help me organize my team tasks.",
            "Write a technical blog post about React hooks with examples.",
            "Explain how to use FastAPI to build a REST API with Pydantic models."
        ]
        self.client.post("/score-prompt", json={"prompt": random.choice(prompts)})

