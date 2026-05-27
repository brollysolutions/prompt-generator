# Smart Prompt Generator

An AI-powered application that transforms high-level ideas into comprehensive, structured "Master Prompts" optimized for LLMs like ChatGPT, Claude, and Gemini.

## Project Overview

The project consists of a decoupled architecture with a modern Next.js frontend and a FastAPI backend powered by Groq's Llama models.

### Architecture
- **Frontend (`/frontend`):** Built with Next.js (React 19), TypeScript, and Tailwind CSS. It features a responsive, glassmorphic UI for interacting with the AI.
- **Backend (`/backend`):** A FastAPI server that orchestrates LLM calls via the Groq SDK. It uses `llama-3.1-8b-instant` for fast question generation and metadata extraction, and `llama-3.3-70b-versatile` for high-quality prompt engineering.

### Core Workflow
1. **Initial Idea:** User describes what they want to achieve.
2. **Requirements Analysis:** The backend generates 6-8 smart follow-up questions to clarify intent.
3. **User Input:** User answers the questions via dynamic form fields.
4. **Prompt Generation:** The system synthesizes the idea and answers into a detailed "Master Prompt" with specific sections (Persona, Context, Objective, Instructions, etc.).

## Building and Running

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Create a `.env` file in the `backend/` directory.
   - Add your Groq API key: `GROQ_API_KEY=your_api_key_here`.
5. Start the server:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://127.0.0.1:8000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

## Development Conventions

### Backend (Python/FastAPI)
- **Services:** Core logic is modularized in `backend/services/`.
    - `groq_service.py`: Handles LLM interactions and JSON cleaning.
    - `intent_detector.py`: (Experimental) Basic keyword-based intent detection.
- **API Models:** Use Pydantic classes in `main.py` for request validation.
- **LLM Outputs:** Always use `clean_json_content` in `groq_service.py` to ensure valid JSON parsing from LLM responses.

### Frontend (Next.js/React)
- **Styling:** The project uses a mix of Tailwind CSS and inline styles for precise component design.
- **State Management:** Uses React `useState` for managing the multi-step generation flow.
- **API Interaction:** Communicates with the backend via `fetch` at the default `http://127.0.0.1:8000` address.

### Testing
- Backend test scripts are located in the `backend/` root (e.g., `test_prompt.py`, `test_regex.py`). Run them using `python <filename>.py`.
