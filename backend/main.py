from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from services.groq_service import (
    generate_questions,
    generate_final_prompt,
    process_prompt_scoring,
    test_generated_prompt
)

app = FastAPI()

# =========================
# CORS - Robust Configuration
# =========================

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Keeping wildcard for dev, but will ensure it works
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler to prevent CORS issues on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
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

class TestPromptRequest(BaseModel):
    prompt: str


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

    questions = await generate_questions(data.user_input)

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
    result = await generate_final_prompt(user_input, answers, questions, target_ai)

    return result

# =========================
# SCORE PROMPT API
# =========================

@app.post("/score-prompt")
async def score_prompt_api(data: PromptScoreRequest):
    result = await process_prompt_scoring(data.prompt)
    return result

# =========================
# TEST PROMPT API
# =========================

@app.post("/test-prompt")
async def test_prompt_api(data: TestPromptRequest):
    response_text = await test_generated_prompt(data.prompt)
    return {
        "response": response_text
    }
