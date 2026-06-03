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
    enhance_prompt_text,
    test_generated_prompt,
    auto_categorize_prompt
)
from database import (
    save_prompt_version, 
    get_prompt_history, 
    save_library_prompt, 
    get_library_prompts, 
    update_prompt_version, 
    delete_prompt_version,
    delete_version_and_library_entry,
    delete_library_prompt
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
    caveman_mode: bool = False

class TestPromptRequest(BaseModel):
    prompt: str

class VersionRequest(BaseModel):
    session_id: str
    prompt_text: str
    source: str

class UpdateVersionRequest(BaseModel):
    prompt_text: str

class EnhancePromptRequest(BaseModel):
    prompt: str
    instruction: str


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
    result = await generate_final_prompt(user_input, answers, questions, target_ai, data.caveman_mode)

    # Auto-categorize and save to library in the background
    try:
        prompt_text = result.get("smart_prompt") or result.get("final_instruction") or result.get("final_prompt")
        if prompt_text:
            cat_data = await auto_categorize_prompt(prompt_text)
            save_library_prompt(
                name=cat_data.get("name", "New Prompt"),
                prompt_text=prompt_text,
                tags=cat_data.get("tags", []),
                category=cat_data.get("category", "General")
            )
    except Exception as e:
        logger.error(f"Failed to auto-categorize/save to library: {e}")

    return result

# =========================
# SCORE PROMPT API
# =========================

@app.post("/score-prompt")
async def score_prompt_api(data: PromptScoreRequest):
    result = await process_prompt_scoring(data.prompt)
    return result

# =========================
# ENHANCE PROMPT API
# =========================

@app.post("/enhance-prompt")
async def enhance_prompt_api(data: EnhancePromptRequest):
    enhanced_text = await enhance_prompt_text(data.prompt, data.instruction)
    return {"enhanced_prompt": enhanced_text}

# =========================
# TEST PROMPT API
# =========================

@app.post("/test-prompt")
async def test_prompt_api(data: TestPromptRequest):
    response_text = await test_generated_prompt(data.prompt)
    return {
        "response": response_text
    }

# =========================
# HISTORY API
# =========================

@app.post("/history")
async def save_history_api(data: VersionRequest):
    version_id = save_prompt_version(data.session_id, data.prompt_text, data.source)

    # Automatically save to library if it's explicitly edited in history
    if data.source == "edited (history)":
        try:
            cat_data = await auto_categorize_prompt(data.prompt_text)
            save_library_prompt(
                name=cat_data.get("name", "Edited Prompt"),
                prompt_text=data.prompt_text,
                tags=cat_data.get("tags", []),
                category=cat_data.get("category", "General")
            )
        except Exception as e:
            logger.error(f"Failed to save edited history to library: {e}")

    return {"id": version_id}

@app.put("/history/{version_id}")
async def update_history_api(version_id: int, data: UpdateVersionRequest):
    success = update_prompt_version(version_id, data.prompt_text)
    if not success:
        return JSONResponse(status_code=404, content={"message": "Version not found"})
    
    # Automatically update library if edited
    try:
        cat_data = await auto_categorize_prompt(data.prompt_text)
        save_library_prompt(
            name=cat_data.get("name", "Edited Prompt"),
            prompt_text=data.prompt_text,
            tags=cat_data.get("tags", []),
            category=cat_data.get("category", "General")
        )
    except Exception as e:
        logger.error(f"Failed to save edited version to library: {e}")
        
    return {"message": "Updated successfully"}

@app.delete("/history/{version_id}")
async def delete_history_api(version_id: int):
    success = delete_version_and_library_entry(version_id)
    if not success:
        return JSONResponse(status_code=404, content={"message": "Version not found"})
    return {"message": "Deleted successfully"}

@app.get("/history")
async def get_history_api():
    history = get_prompt_history()
    return {"history": history}

# =========================
# LIBRARY API
# =========================

@app.get("/library")
async def get_library_api():
    prompts = get_library_prompts()
    return {"prompts": prompts}

@app.delete("/library/{prompt_id}")
async def delete_library_api(prompt_id: int):
    success = delete_library_prompt(prompt_id)
    if not success:
        return JSONResponse(status_code=404, content={"message": "Prompt not found"})
    return {"message": "Deleted successfully"}

import asyncio

@app.get("/migrate-history")
async def migrate_history_api():
    history = get_prompt_history()
    existing_library = get_library_prompts()
    existing_texts = {p['prompt_text'] for p in existing_library}
    
    migrated = 0
    for h in history:
        text = h['prompt_text']
        if text and text not in existing_texts:
            try:
                cat_data = await auto_categorize_prompt(text)
                save_library_prompt(
                    name=cat_data.get("name", "Migrated Prompt"),
                    prompt_text=text,
                    tags=cat_data.get("tags", []),
                    category=cat_data.get("category", "General")
                )
                existing_texts.add(text)
                migrated += 1
                await asyncio.sleep(1) # delay to prevent rate limits
            except Exception as e:
                logger.error(f"Failed to migrate prompt: {e}")
                
    return {"message": f"Successfully categorized and migrated {migrated} historical prompts to your Library!"}
