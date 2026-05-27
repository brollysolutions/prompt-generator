from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from services.groq_service import (
    generate_questions,
    generate_final_prompt,
    process_prompt_scoring
)

app = FastAPI()

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# REQUEST MODELS
# =========================

class UserInput(BaseModel):
    user_input: str


class PromptScoreRequest(BaseModel):
    prompt: str

class FinalPromptRequest(BaseModel):
    user_input: str
    answers: dict
    questions: list = []
    target_ai: str = ""


# =========================
# HOME ROUTE
# =========================

@app.get("/")
def home():
    return {
        "message": "Smart Prompt Generator API Running"
    }


# =========================
# GENERATE QUESTIONS API
# =========================

@app.post("/generate-questions")
async def generate_questions_api(data: UserInput):

    questions = generate_questions(data.user_input)

    return {
        "questions": questions
    }


@app.post("/generate-final-prompt")
async def generate_final_prompt_api(data: FinalPromptRequest):

    user_input = data.user_input
    answers = data.answers
    questions = data.questions  # pass questions for proper Q&A context labeling
    target_ai = data.target_ai

    # Generate the dynamic prompt using the imported Groq service function
    result = generate_final_prompt(user_input, answers, questions, target_ai)

    return result

# =========================
# SCORE PROMPT API
# =========================

@app.post("/score-prompt")
async def score_prompt_api(data: PromptScoreRequest):
    result = process_prompt_scoring(data.prompt)
    return result
