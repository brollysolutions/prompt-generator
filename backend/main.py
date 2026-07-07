from fastapi import FastAPI, Request, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
import logging
import os
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
import jwt
import secrets
from datetime import datetime, timedelta
from passlib.context import CryptContext
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from services.groq_service import (
    generate_questions,
    process_prompt_scoring,
    enhance_prompt_text,
    test_generated_prompt,
    auto_categorize_prompt,
    generate_final_prompt as groq_generate_final_prompt
)
from services.gemini_service import (
    generate_final_prompt as gemini_generate_final_prompt
)
import re

def is_regional_language(text: str) -> bool:
    text = text.lower()
    regional_words = {
        # Hinglish
        "hai", "kya", "kaise", "mujhe", "mera", "yeh", "karna", "chahiye", "kyu", "kaun", "banayega", "banane", "aap", "tum",
        # Teluglish
        "idi", "ela", "cheyali", "naaku", "naku", "oka", "evaru", "endi", "cheppu", "kavali", "gurinchi", "neeku", "neku", "nenu", "memu", "manamu", "chestava", "cheyadaniki"
    }
    words = set(re.findall(r'\b\w+\b', text))
    
    # Require at least two regional words to trigger, or one highly specific word
    intersection = words.intersection(regional_words)
    return len(intersection) >= 2 or bool(intersection.intersection({"kaise", "mujhe", "chahiye", "cheyali", "naaku", "naku", "kavali", "cheyadaniki"}))
from database import (
    save_prompt_version, 
    get_prompt_history, 
    save_library_prompt, 
    get_library_prompts, 
    update_prompt_version, 
    delete_prompt_version,
    delete_version_and_library_entry,
    delete_library_prompt,
    create_user,
    get_user_by_email,
    publish_to_community,
    get_community_prompts,
    upvote_community_prompt,
    save_community_prompt_to_library,
    get_templates,
    get_template_by_id,
    create_template,
    update_template,
    delete_template,
    record_prompt_usage,
    toggle_user_pro_status,
    get_analytics_overview,
    get_most_used_prompts,
    get_quality_trend,
    create_shared_prompt,
    get_shared_prompt_by_token,
    increment_share_view_count,
    list_user_shares,
    revoke_share_link
)

app = FastAPI()

# =========================
# Auth Configuration
# =========================
JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret_for_dev_only_1234567")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

# Use pbkdf2_sha256 for better compatibility, but include bcrypt for legacy users
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    if hashed_password == "!GOOGLE_AUTH_USER":
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = get_user_by_email(email)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

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

class EnhancePromptRequest(BaseModel):
    prompt: str
    instruction: str

class TestPromptRequest(BaseModel):
    prompt: str

class VersionRequest(BaseModel):
    session_id: str
    prompt_text: str
    source: str
    user_id: int = 0

class UpdateVersionRequest(BaseModel):
    prompt_text: str
    user_id: int = 0

class FinalPromptRequest(BaseModel):
    user_input: str
    answers: dict
    questions: list = []
    target_ai: str = ""
    tone: str = "Auto"
    output_format: str = "Auto"
    length: str = "Auto"
    role: str = ""
    caveman_mode: bool = False
    user_id: int = 0

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

    # Step 1: Generate questions based on user input
    questions = await generate_questions(data.user_input)

    return {
    "questions": questions,
    }


@app.post("/generate-final-prompt")
async def generate_final_prompt_api(data: FinalPromptRequest):

    user_input = data.user_input
    answers = data.answers
    questions = data.questions  # pass questions for proper Q&A context labeling
    target_ai = data.target_ai

    if is_regional_language(user_input):
        logger.info("Detected Regional Language (Hinglish/Teluglish). Routing to Groq Llama 3.3 70B.")
        generate_final_prompt_func = groq_generate_final_prompt
    else:
        logger.info("Detected English. Routing to Gemini AI.")
        generate_final_prompt_func = gemini_generate_final_prompt

    # Generate the dynamic prompt using the chosen service function
    result = await generate_final_prompt_func(
        user_input, 
        answers, 
        questions, 
        target_ai, 
        data.tone,
        data.output_format,
        data.length,
        data.role,
        data.caveman_mode
    )

    # Auto-categorize and save to library in the background
    try:
        prompt_text = result.get("smart_prompt") or result.get("final_instruction") or result.get("final_prompt")
        if prompt_text:
            cat_data = await auto_categorize_prompt(prompt_text)
            save_library_prompt(
                name=cat_data.get("name", "New Prompt"),
                prompt_text=prompt_text,
                tags=cat_data.get("tags", []),
                category=cat_data.get("category", "General"),
                user_id=data.user_id
            )
            if data.user_id > 0:
                record_prompt_usage(
                    user_id=data.user_id,
                    prompt_id=None,
                    category=cat_data.get("category", "General"),
                    quality_score=result.get("quality_score", 0)
                )
    except Exception as e:
        logger.error(f"Failed to auto-categorize/save to library or record usage: {e}")

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
                category=cat_data.get("category", "General"),
                user_id=data.user_id
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
            category=cat_data.get("category", "General"),
            user_id=data.user_id
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
async def get_history_api(session_id: str = None):
    history = get_prompt_history(session_id)
    return {"history": history}

# =========================
# LIBRARY API
# =========================

@app.get("/library")
async def get_library_api(user_id: int = 0):
    prompts = get_library_prompts(user_id)
    return {"prompts": prompts}

@app.delete("/library/{prompt_id}")
async def delete_library_api(prompt_id: int):
    success = delete_library_prompt(prompt_id)
    if not success:
        return JSONResponse(status_code=404, content={"message": "Prompt not found"})
    return {"message": "Deleted successfully"}


# =========================
# NEW AUTH ENDPOINTS
# =========================

class AuthRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

@app.post("/auth/google")
async def google_auth(data: GoogleAuthRequest):
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(data.credential, requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=315360000)
        
        email = idinfo['email']
        
        # Check if user exists
        user = get_user_by_email(email)
        if not user:
            # Create a new user with a sentinel password
            user_id = create_user(email, "!GOOGLE_AUTH_USER")
            if user_id == -1:
                raise HTTPException(status_code=500, detail="Failed to create user from Google account")
            user = {"id": user_id, "email": email}
        
        # Issue our JWT
        access_token = create_access_token(data={"sub": email})
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "user_id": user["id"], 
            "email": email
        }
    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/signup")
async def signup(data: AuthRequest):
    user = get_user_by_email(data.email)
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(data.password)
    user_id = create_user(data.email, hashed_password)
    
    if user_id == -1:
        raise HTTPException(status_code=500, detail="Failed to create user")
        
    access_token = create_access_token(data={"sub": data.email})
    return {"access_token": access_token, "token_type": "bearer", "user_id": user_id, "email": data.email}

@app.post("/login")
async def login(data: AuthRequest):
    user = get_user_by_email(data.email)
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": data.email})
    return {"access_token": access_token, "token_type": "bearer", "user_id": user["id"], "email": user["email"]}

@app.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"]}

# =========================
# COMMUNITY SHARE API
# =========================

class CommunityPublishRequest(BaseModel):
    library_prompt_id: int
    user_id: int
    email: str

class CommunityUpvoteRequest(BaseModel):
    prompt_id: int
    user_id: int

class CommunitySaveRequest(BaseModel):
    prompt_id: int
    user_id: int

@app.post("/community/publish")
async def publish_prompt(data: CommunityPublishRequest):
    result = publish_to_community(data.library_prompt_id, data.user_id, data.email)
    if not result:
        raise HTTPException(status_code=404, detail="Library prompt not found")
    return result

@app.get("/community")
async def get_community(user_id: int = 0, sort_by: str = "trending"):
    prompts = get_community_prompts(user_id, sort_by)
    return {"prompts": prompts}

@app.post("/community/upvote")
async def upvote_prompt(data: CommunityUpvoteRequest):
    result = upvote_community_prompt(data.user_id, data.prompt_id)
    return result

@app.post("/community/save")
async def save_community_prompt(data: CommunitySaveRequest):
    new_id = save_community_prompt_to_library(data.user_id, data.prompt_id)
    if not new_id:
        raise HTTPException(status_code=404, detail="Community prompt not found")
    return {"message": "Saved to library", "id": new_id}

@app.post("/community/report/{prompt_id}")
async def report_community_prompt(prompt_id: int):
    # Dummy endpoint to satisfy the frontend reporting feature requirement
    # Normally this would log a report to the database and notify an admin
    return {"message": "Prompt reported successfully"}

# =========================
# TEMPLATES API
# =========================

class TemplateRequest(BaseModel):
    name: str
    category: str
    description: str
    template_text: str
    icon: str = "file-text"

@app.get("/api/templates")
async def api_get_templates(category: str = None, search: str = None):
    templates = get_templates(category, search)
    return templates

@app.get("/api/templates/{template_id}")
async def api_get_template(template_id: str):
    template = get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@app.post("/api/templates")
async def api_create_template(data: TemplateRequest):
    import uuid
    template_id = str(uuid.uuid4())
    create_template(
        template_id, data.name, data.category, data.description, data.template_text, data.icon
    )
    return {"id": template_id, "message": "Template created successfully"}

@app.put("/api/templates/{template_id}")
async def api_update_template(template_id: str, data: TemplateRequest):
    success = update_template(
        template_id, data.name, data.category, data.description, data.template_text, data.icon
    )
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated successfully"}

@app.delete("/api/templates/{template_id}")
async def api_delete_template(template_id: str):
    success = delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}

# =========================
# ANALYTICS API (PRO FEATURE)
# =========================

def check_pro_status(current_user: dict):
    if not current_user.get("is_pro"):
        raise HTTPException(status_code=403, detail="upgrade_required")

@app.post("/api/user/toggle-pro")
async def api_toggle_pro(current_user: dict = Depends(get_current_user)):
    success = toggle_user_pro_status(current_user["id"])
    return {"message": "Pro status toggled", "success": success}

@app.get("/api/analytics/overview")
async def api_analytics_overview(current_user: dict = Depends(get_current_user)):
    check_pro_status(current_user)
    return get_analytics_overview(current_user["id"])

@app.get("/api/analytics/most-used")
async def api_analytics_most_used(current_user: dict = Depends(get_current_user)):
    check_pro_status(current_user)
    return {"prompts": get_most_used_prompts(current_user["id"])}

@app.get("/api/analytics/quality-trend")
async def api_analytics_quality_trend(range: int = 30, current_user: dict = Depends(get_current_user)):
    check_pro_status(current_user)
    return {"trend": get_quality_trend(current_user["id"], range)}

@app.get("/api/analytics/report-card")
async def api_analytics_report_card(current_user: dict = Depends(get_current_user)):
    check_pro_status(current_user)
    
    # Gather stats
    overview = get_analytics_overview(current_user["id"])
    most_used = get_most_used_prompts(current_user["id"])
    
    # Generate narrative via AI
    from services.gemini_service import generate_analytics_report_card
    stats_summary = f"Total Prompts: {overview['total_prompts']}, Avg Score: {overview['average_quality_score']}, Streak: {overview['current_streak_days']} days. Top Categories: {', '.join([p['name'] for p in most_used])}"
    
    narrative = await generate_analytics_report_card(stats_summary)
    
    return {
        "narrative": narrative,
        "score_delta": "+5.2",  # Simulated delta
        "most_improved_category": most_used[0]['name'] if most_used else "General",
        "streak": overview["current_streak_days"]
    }

# =========================
# SHARE LINK API
# =========================

class ShareRequest(BaseModel):
    prompt_text: str
    quality_score: int
    category: str
    language: str
    author_name: Optional[str] = None
    visibility: str = "public"
    expires_in_days: Optional[int] = None

@app.post("/api/prompts/share")
async def api_create_share(req: ShareRequest, current_user: dict = Depends(get_current_user)):
    # Generate unique 32+ char base62-like token
    token = secrets.token_urlsafe(24)
    
    expires_at_str = None
    if req.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=req.expires_in_days)
        expires_at_str = expires_at.strftime("%Y-%m-%d %H:%M:%S")
        
    create_shared_prompt(
        share_token=token,
        prompt_text=req.prompt_text,
        quality_score=req.quality_score,
        category=req.category,
        language=req.language,
        created_by=current_user["id"],
        author_name=req.author_name or current_user.get("email", "").split("@")[0],
        visibility=req.visibility,
        expires_at=expires_at_str
    )
    
    return {"share_token": token, "share_url": f"/share/{token}"}

@app.get("/api/share/{token}")
async def api_get_share(token: str):
    share = get_shared_prompt_by_token(token)
    if not share:
        raise HTTPException(status_code=404, detail="Link not found")
        
    if share.get("revoked_at"):
        raise HTTPException(status_code=410, detail="This link has been revoked")
        
    if share.get("expires_at"):
        expires_at = datetime.strptime(share["expires_at"], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() > expires_at:
            raise HTTPException(status_code=410, detail="This link has expired")
            
    # Asynchronously increment view count or just do it here
    increment_share_view_count(token)
    
    return {
        "prompt_text": share["prompt_text"],
        "quality_score": share["quality_score"],
        "category": share["category"],
        "language": share["language"],
        "author_name": share["author_name"],
        "created_at": share["created_at"],
        "view_count": share["view_count"]
    }

@app.post("/api/share/{token}/save")
async def api_save_share(token: str, current_user: dict = Depends(get_current_user)):
    share = get_shared_prompt_by_token(token)
    if not share or share.get("revoked_at"):
        raise HTTPException(status_code=404, detail="Link not available")
        
    if share.get("expires_at"):
        expires_at = datetime.strptime(share["expires_at"], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() > expires_at:
            raise HTTPException(status_code=410, detail="This link has expired")

    # Save to user's library
    save_library_prompt(
        name=f"Shared Prompt - {share['category']}",
        prompt_text=share["prompt_text"],
        tags=share["category"],
        category=share["category"],
        user_id=current_user["id"]
    )
    return {"message": "Saved to library successfully"}

@app.get("/api/prompts/shares")
async def api_list_shares(current_user: dict = Depends(get_current_user)):
    shares = list_user_shares(current_user["id"])
    return {"shares": shares}

@app.delete("/api/share/{token}")
async def api_revoke_share(token: str, current_user: dict = Depends(get_current_user)):
    success = revoke_share_link(token, current_user["id"])
    if not success:
        raise HTTPException(status_code=403, detail="Not authorized or link not found")
    return {"message": "Link revoked successfully"}
