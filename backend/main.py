from fastapi import FastAPI, Request, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import httpx
from fastapi.security import OAuth2PasswordBearer
import logging
import os
import jwt
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
    delete_library_prompt,
    create_user,
    get_user_by_email
)

app = FastAPI(root_path="/prompt_generator/api")

# Add ProxyHeadersMiddleware to trust X-Forwarded-Proto headers from proxy
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# =========================
# Auth Configuration
# =========================
JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret_for_dev_only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

# Use pbkdf2_sha256 for better compatibility
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

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
    "https://brollysolutions.in",
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

class UpdateVersionRequest(BaseModel):
    prompt_text: str

class FinalPromptRequest(BaseModel):
    user_input: str
    answers: dict
    questions: list = []
    target_ai: str = ""
    caveman_mode: bool = False

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

    # Generate the dynamic prompt using the imported Groq service function
    result = await generate_final_prompt(
        user_input, 
        answers, 
        questions, 
        target_ai, 
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
async def get_history_api(session_id: str = None):
    history = get_prompt_history(session_id)
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


# =========================
# NEW AUTH ENDPOINTS
# =========================

class AuthRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

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
async def google_auth(data: GoogleAuthRequest):
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(data.credential, requests.Request(), GOOGLE_CLIENT_ID)
        
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
