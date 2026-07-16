from fastapi import FastAPI, Request, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Literal
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import httpx
from fastapi.security import OAuth2PasswordBearer
import logging
import os
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
import jwt
import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from services.groq_service import (
    generate_questions,
    process_prompt_scoring,
    enhance_prompt_text,
    test_generated_prompt as groq_test_generated_prompt,
    auto_categorize_prompt,
    generate_final_prompt as groq_generate_final_prompt
)
from services.gemini_service import (
    generate_final_prompt as gemini_generate_final_prompt,
    test_generated_prompt as gemini_test_generated_prompt
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

app = FastAPI(root_path="/prompt_generator/api")

# =========================
# Rate limiting (slowapi)
# =========================
# Keyed by client IP (X-Forwarded-For aware via ProxyHeadersMiddleware). Protects
# auth and the paid-LLM endpoints from abuse/cost-drain. Limits are generous enough
# not to affect normal interactive use. Override the default via RATE_LIMIT_DEFAULT.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[os.getenv("RATE_LIMIT_DEFAULT", "120/minute")],
    enabled=os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true",
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again shortly."},
    )


app.add_middleware(SlowAPIMiddleware)

# Add ProxyHeadersMiddleware to trust X-Forwarded-Proto headers from proxy
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
    if request.url.scheme == "https" or os.getenv("FORCE_HSTS", "false").lower() == "true":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# =========================
# Auth Configuration
# =========================
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
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
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

async def get_optional_current_user(token: str = Depends(oauth2_scheme_optional)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email:
            return get_user_by_email(email)
    except Exception:
        pass
    return None

# =========================
# CORS - Robust Configuration
# =========================

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    frontend_url,
    "http://localhost:3000",
    "http://localhost:3006",
    "https://prompt-generator.local"
]
# Ensure uniqueness
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Global Exception Handler to prevent CORS issues on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# =========================
# REQUEST MODELS
# =========================

class UserInput(BaseModel):
    user_input: str = Field(min_length=1, max_length=4000)


class PromptScoreRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)

class EnhancePromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    instruction: str = Field(min_length=1, max_length=4000)

class TestPromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)

class VersionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    prompt_text: str = Field(min_length=1, max_length=20000)
    source: str = Field(min_length=1, max_length=64)
    user_id: int = 0

class UpdateVersionRequest(BaseModel):
    prompt_text: str = Field(min_length=1, max_length=20000)
    user_id: int = 0

class FinalPromptRequest(BaseModel):
    user_input: str = Field(min_length=1, max_length=4000)
    answers: dict = Field(default_factory=dict)
    questions: list = Field(default_factory=list)
    target_ai: str = Field(default="", max_length=128)
    tone: str = Field(default="Auto", max_length=64)
    output_format: str = Field(default="Auto", max_length=64)
    length: str = Field(default="Auto", max_length=64)
    role: str = Field(default="", max_length=256)
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

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "message": "Smart Prompt Generator API is healthy"
    }


# =========================
# GENERATE QUESTIONS API
# =========================

@app.post("/generate-questions")
@limiter.limit(os.getenv("RATE_LIMIT_LLM", "20/minute"))
async def generate_questions_api(request: Request, data: UserInput):

    # Step 1: Generate questions based on user input
    questions = await generate_questions(data.user_input)

    return {
    "questions": questions,
    }


@app.post("/generate-final-prompt")
@limiter.limit(os.getenv("RATE_LIMIT_LLM", "20/minute"))
async def generate_final_prompt_api(request: Request, data: FinalPromptRequest, current_user: dict = Depends(get_optional_current_user)):

    user_input = data.user_input
    answers = data.answers
    questions = data.questions  # pass questions for proper Q&A context labeling
    target_ai = data.target_ai
    user_id = current_user["id"] if current_user else 0

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
                user_id=user_id
            )
            if user_id > 0:
                record_prompt_usage(
                    user_id=user_id,
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
@limiter.limit(os.getenv("RATE_LIMIT_LLM", "20/minute"))
async def score_prompt_api(request: Request, data: PromptScoreRequest):
    result = await process_prompt_scoring(data.prompt)
    return result

# =========================
# ENHANCE PROMPT API
# =========================

@app.post("/enhance-prompt")
@limiter.limit(os.getenv("RATE_LIMIT_LLM", "20/minute"))
async def enhance_prompt_api(request: Request, data: EnhancePromptRequest):
    enhanced_text = await enhance_prompt_text(data.prompt, data.instruction)
    return {"enhanced_prompt": enhanced_text}

# =========================
# TEST PROMPT API
# =========================

@app.post("/test-prompt")
@limiter.limit(os.getenv("RATE_LIMIT_LLM", "20/minute"))
async def test_prompt_api(request: Request, data: TestPromptRequest):
    # Route to the same provider the prompt was authored for: regional languages
    # (Hinglish/Teluglish) -> Groq Llama; English -> Gemini (higher fidelity).
    if is_regional_language(data.prompt):
        response_text = await groq_test_generated_prompt(data.prompt)
    else:
        response_text = await gemini_test_generated_prompt(data.prompt)
    return {
        "response": response_text
    }

# =========================
# HISTORY API
# =========================

@app.post("/history")
async def save_history_api(data: VersionRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    version_id = save_prompt_version(data.session_id, data.prompt_text, data.source, user_id)

    # Automatically save to library if it's explicitly edited in history
    if data.source == "edited (history)":
        try:
            cat_data = await auto_categorize_prompt(data.prompt_text)
            save_library_prompt(
                name=cat_data.get("name", "Edited Prompt"),
                prompt_text=data.prompt_text,
                tags=cat_data.get("tags", []),
                category=cat_data.get("category", "General"),
                user_id=user_id
            )
        except Exception as e:
            logger.error(f"Failed to save edited history to library: {e}")

    return {"id": version_id}

@app.put("/history/{version_id}")
async def update_history_api(version_id: int, data: UpdateVersionRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    success = update_prompt_version(version_id, data.prompt_text, user_id)
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
            user_id=user_id
        )
    except Exception as e:
        logger.error(f"Failed to save edited version to library: {e}")
        
    return {"message": "Updated successfully"}

@app.delete("/history/{version_id}")
async def delete_history_api(version_id: int, current_user: dict = Depends(get_current_user)):
    success = delete_version_and_library_entry(version_id, current_user["id"])
    if not success:
        return JSONResponse(status_code=404, content={"message": "Version not found"})
    return {"message": "Deleted successfully"}

@app.get("/history")
async def get_history_api(session_id: str = None, current_user: dict = Depends(get_current_user)):
    history = get_prompt_history(session_id, current_user["id"])
    return {"history": history}

# =========================
# LIBRARY API
# =========================

@app.get("/library")
async def get_library_api(current_user: dict = Depends(get_current_user)):
    prompts = get_library_prompts(current_user["id"])
    return {"prompts": prompts}

@app.delete("/library/{prompt_id}")
async def delete_library_api(prompt_id: int, current_user: dict = Depends(get_current_user)):
    success = delete_library_prompt(prompt_id, current_user["id"])
    if not success:
        return JSONResponse(status_code=404, content={"message": "Prompt not found"})
    return {"message": "Deleted successfully"}


# =========================
# NEW AUTH ENDPOINTS
# =========================

class AuthRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=8192)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/prompt_generator/api/auth/google")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

@app.get("/auth/google")
async def google_auth_get(action: str = None, code: str = None, state: str = "redirect"):
    """
    Overloaded endpoint for Google Auth:
    - ?action=config: Returns Google Client ID.
    - ?action=login: Redirects to Google Consent screen.
    - ?code=...: Handles the callback from Google.
    """
    # 1. Config Action
    if action == "config":
        return {"client_id": GOOGLE_CLIENT_ID}

    # 2. Login Action (Redirect to Google)
    if action == "login":
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google Client ID not configured")
        
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={GOOGLE_CLIENT_ID}"
            f"&redirect_uri={GOOGLE_REDIRECT_URI}"
            f"&response_type=code"
            f"&scope=openid%20email%20profile"
            f"&state={state}"
        )
        return RedirectResponse(url=auth_url)

    # 3. Callback (Handle code from Google)
    if code:
        if not GOOGLE_CLIENT_SECRET:
            logger.error("GOOGLE_CLIENT_SECRET is not set")
            raise HTTPException(status_code=500, detail="Server configuration error")

        # Exchange code for token
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data)
            if response.status_code != 200:
                logger.error(f"Failed to exchange code for token: {response.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange code for token")
            
            token_data = response.json()
            id_token_str = token_data.get("id_token")

        try:
            # Verify the Google token
            idinfo = id_token.verify_oauth2_token(id_token_str, requests.Request(), GOOGLE_CLIENT_ID)
            email = idinfo['email']

            # Check if user exists
            user = get_user_by_email(email)
            if not user:
                # Create a new user
                user_id = create_user(email, "!GOOGLE_AUTH_USER")
                if user_id == -1:
                    raise HTTPException(status_code=500, detail="Failed to create user")
                user = {"id": user_id, "email": email}

            # Issue our JWT
            access_token = create_access_token(data={"sub": email})

            # Handle response based on state
            if state == "json":
                return {
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user_id": user["id"],
                    "email": email
                }
            else:
                # Default to redirecting back to frontend
                return RedirectResponse(url=f"{FRONTEND_URL}/login?token={access_token}")

        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        except Exception as e:
            logger.error(f"Google auth callback error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=400, detail="Invalid request")

@app.post("/auth/google")
@limiter.limit(os.getenv("RATE_LIMIT_AUTH", "10/minute"))
async def google_auth(request: Request, data: GoogleAuthRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(data.credential, requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=10)
        
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
@limiter.limit(os.getenv("RATE_LIMIT_AUTH", "10/minute"))
async def signup(request: Request, data: AuthRequest):
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
@limiter.limit(os.getenv("RATE_LIMIT_AUTH", "10/minute"))
async def login(request: Request, data: AuthRequest):
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

class CommunitySaveRequest(BaseModel):
    prompt_id: int

@app.post("/community/publish")
async def publish_prompt(data: CommunityPublishRequest, current_user: dict = Depends(get_current_user)):
    result = publish_to_community(data.library_prompt_id, current_user["id"], current_user["email"])
    if not result:
        raise HTTPException(status_code=404, detail="Library prompt not found")
    return result

@app.get("/community")
async def get_community(sort_by: str = "trending", current_user: dict = Depends(get_optional_current_user)):
    user_id = current_user["id"] if current_user else 0
    prompts = get_community_prompts(user_id, sort_by)
    return {"prompts": prompts}

@app.post("/community/upvote")
async def upvote_prompt(data: CommunityUpvoteRequest, current_user: dict = Depends(get_current_user)):
    result = upvote_community_prompt(current_user["id"], data.prompt_id)
    return result

@app.post("/community/save")
async def save_community_prompt(data: CommunitySaveRequest, current_user: dict = Depends(get_current_user)):
    new_id = save_community_prompt_to_library(current_user["id"], data.prompt_id)
    if not new_id:
        raise HTTPException(status_code=404, detail="Community prompt not found")
    return {"message": "Saved to library", "id": new_id}

@app.post("/community/report/{prompt_id}")
async def report_community_prompt(prompt_id: int, current_user: dict = Depends(get_current_user)):
    # Requires authentication so reports are attributable and not spoofable.
    # Normally this would log a report to the database and notify an admin.
    logger.info(f"Community prompt {prompt_id} reported by user {current_user['id']}")
    return {"message": "Prompt reported successfully"}

# =========================
# TEMPLATES API
# =========================

class TemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=240)
    template_text: str = Field(min_length=1, max_length=12000)
    icon: str = Field(default="file-text", max_length=64)

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
async def api_create_template(data: TemplateRequest, current_user: dict = Depends(get_current_user)):
    if not allow_template_mutations():
        raise HTTPException(status_code=403, detail="Template mutations are disabled in production")
    import uuid
    template_id = str(uuid.uuid4())
    create_template(
        template_id, data.name, data.category, data.description, data.template_text, data.icon
    )
    return {"id": template_id, "message": "Template created successfully"}

@app.put("/api/templates/{template_id}")
async def api_update_template(template_id: str, data: TemplateRequest, current_user: dict = Depends(get_current_user)):
    if not allow_template_mutations():
        raise HTTPException(status_code=403, detail="Template mutations are disabled in production")
    success = update_template(
        template_id, data.name, data.category, data.description, data.template_text, data.icon
    )
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated successfully"}

@app.delete("/api/templates/{template_id}")
async def api_delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    if not allow_template_mutations():
        raise HTTPException(status_code=403, detail="Template mutations are disabled in production")
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


def allow_template_mutations() -> bool:
    return os.getenv("ALLOW_TEMPLATE_MUTATIONS", "false").lower() == "true"


def allow_pro_toggle() -> bool:
    return os.getenv("ALLOW_PRO_TOGGLE", "false").lower() == "true"

@app.post("/api/user/toggle-pro")
async def api_toggle_pro(current_user: dict = Depends(get_current_user)):
    if not allow_pro_toggle():
        raise HTTPException(status_code=403, detail="This endpoint is disabled in production")
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
    prompt_text: str = Field(min_length=1, max_length=20000)
    quality_score: int = Field(ge=0, le=100)
    category: str = Field(min_length=1, max_length=80)
    language: str = Field(min_length=1, max_length=40)
    author_name: Optional[str] = Field(default=None, max_length=120)
    visibility: Literal["public", "unlisted"] = "public"
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)

@app.post("/api/prompts/share")
async def api_create_share(req: ShareRequest, current_user: dict = Depends(get_current_user)):
    # Generate unique 32+ char base62-like token
    token = secrets.token_urlsafe(24)
    
    expires_at_str = None
    if req.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=req.expires_in_days)
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
        expires_at = datetime.strptime(share["expires_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
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
        expires_at = datetime.strptime(share["expires_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
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
