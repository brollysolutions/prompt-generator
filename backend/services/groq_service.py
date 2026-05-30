from groq import AsyncGroq
import os
from dotenv import load_dotenv
import json
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import save_prompt_score

load_dotenv()

client = AsyncGroq(
    api_key=os.getenv("GROQ_API_KEY")
)

# Helper to strip markdown JSON blocks and conversational text
def clean_json_content(content: str) -> str:
    content = content.strip()
    
    # Try to find JSON within code blocks first
    if "```json" in content:
        parts = content.split("```json")
        if len(parts) > 1:
            return parts[1].split("```")[0].strip()
    elif "```" in content:
        parts = content.split("```")
        if len(parts) > 1:
            return parts[1].split("```")[0].strip()
            
    # Fallback: Find outermost JSON bounds
    first_brace = content.find('{')
    first_bracket = content.find('[')
    
    start_idx = -1
    end_idx = -1
    
    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        start_idx = first_brace
        end_idx = content.rfind('}')
    elif first_bracket != -1:
        start_idx = first_bracket
        end_idx = content.rfind(']')
        
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        return content[start_idx:end_idx+1].strip()
        
    return content

# =========================
# GENERATE QUESTIONS
# =========================

async def generate_questions(user_input):

    prompt = f"""You are an expert AI Requirements Analyst.

A user wants to create an AI prompt for this specific topic/idea:
"{user_input}"

Your task is to generate 5-7 highly specific, context-aware follow-up questions to gather the exact details needed to build a world-class prompt for THIS SPECIFIC TOPIC.

CRITICAL RULES:
1. DO NOT ask generic questions (e.g., "What is the primary goal?", "Who is the target audience?", "What is your experience level?") UNLESS it perfectly aligns with the topic.
2. Tailor every question to the domain. (e.g., If it's a diet plan, ask about allergies, calorie goals, cuisine preferences. If it's code, ask about tech stack, edge cases, deployment).
3. Only use these input types: "text", "textarea", "dropdown", "radio", "checkbox".
4. For "dropdown", "radio", and "checkbox" types, you MUST include a logical "options" array with 3-6 highly relevant choices.
5. NOTE: A "Custom Message" option is automatically added to all "dropdown", "radio", and "checkbox" types by the UI. DO NOT include "Other", "Custom", or "None of the above" in your options array as it would be redundant.

Return ONLY a JSON object matching this exact schema:
{{
  "questions": [
    {{
      "question": "A highly specific question related to the user's idea",
      "type": "radio",
      "options": ["Specific Option 1", "Specific Option 2", "Specific Option 3"]
    }},
    {{
      "question": "Another specific detail needed",
      "type": "textarea"
    }}
  ]
}}"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )

        result_content = response.choices[0].message.content.strip()
        parsed = json.loads(result_content)
        return parsed.get("questions", [])
    except Exception as e:
        print(f"EXCEPTION generating questions: {str(e)}")
        # Return fallback questions so the UI doesn't break
        return [
            {"question": "What is the primary goal you want to achieve with this prompt?", "type": "textarea"},
            {"question": "Who is the target audience for the AI's response?", "type": "text"},
            {"question": "Are there any specific constraints or things the AI should avoid?", "type": "textarea"}
        ]

# =========================
# GENERATE FINAL PROMPT
# =========================

async def generate_final_prompt(user_input, answers, questions=None, target_ai=""):
    try:
        # Build detailed Q&A context using question text if available
        qa_lines = []
        for key, value in answers.items():
            if value and str(value).strip():
                idx = int(key) if str(key).isdigit() else key
                if questions and isinstance(idx, int) and idx < len(questions):
                    q_text = questions[idx].get("question", f"Question {idx + 1}")
                else:
                    q_text = f"Question {idx}"
                qa_lines.append(f"Q: {q_text}\nA: {value}")

        qa_context = "\n\n".join(qa_lines) if qa_lines else "(No answers provided)"

        # Step 1: Draft the initial version
        draft_prompt = await _build_smart_prompt_text(user_input, qa_context, target_ai)
        
        # Step 2: Parallel execution of Metadata and Self-Correction
        # This eliminates sequential waiting for metadata
        final_prompt_task = _self_correct_prompt(draft_prompt, user_input, qa_context)
        metadata_task = _build_metadata(user_input, qa_context, draft_prompt)
        
        final_smart_prompt, meta = await asyncio.gather(final_prompt_task, metadata_task)
        
        # Automatically score the generated prompt
        score_data = await process_prompt_scoring(final_smart_prompt)
        meta["score"] = score_data.get("score", 0)
        
        meta["smart_prompt"] = final_smart_prompt
        
        return meta
    except Exception as e:
        print(f"EXCEPTION in generate_final_prompt: {str(e)}")
        # Return a usable fallback structure if everything fails
        return {
            "title": "Generated Prompt (Fallback)",
            "summary": "A basic prompt generated after a system error occurred.",
            "role": "You are an expert assistant.",
            "context": f"User Idea: {user_input}",
            "task": "Complete the task requested by the user.",
            "constraints": "Follow instructions carefully.",
            "output_format": "Professional text.",
            "tone": "Professional",
            "smart_prompt": f"I was unable to fully optimize your prompt due to an AI service error, but here is your context:\n\nOriginal Idea: {user_input}\n\nAdditional Details:\n{qa_context if 'qa_context' in locals() else 'None'}"
        }


async def _self_correct_prompt(draft_prompt: str, user_input: str, qa_context: str) -> str:
    """Combines critique and refinement into a single efficient step."""
    prompt = f"""You are a Master Prompt Architect. Analyze this draft prompt against the original intent and provide a perfected version.

USER ORIGINAL INTENT:
{user_input}

USER CONTEXT:
{qa_context}

DRAFT PROMPT:
{draft_prompt}

TASK:
1. Identify any missing constraints or clarity issues.
2. Rewrite the prompt to be more surgical, precise, and effective.
3. Address specific model requirements if mentioned.
4. DO NOT add unnecessary bloat; keep it focused on the user's objective.

Write the final perfected master prompt now:"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=3000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"EXCEPTION in _self_correct_prompt: {str(e)}")
        return draft_prompt


async def _build_smart_prompt_text(user_input: str, qa_context: str, target_ai: str = "") -> str:
    """Initial draft generation."""
    
    optimization_instruction = ""
    if target_ai:
        optimization_instruction = f"IMPORTANT: Optimize this prompt specifically for use with {target_ai}."

    prompt = f"""You are a world-class AI Prompt Engineer.

USER INITIAL IDEA:
{user_input}

USER ANSWERS & CONTEXT:
{qa_context}

Write a COMPLETE, highly detailed, ready-to-use master prompt with these headers:
# Role & Persona
# Context & Background
# Core Objective
# Instructions & Step-by-Step Task
# Rules & Constraints
# Expected Output Format

{optimization_instruction}

Write the master prompt content now:"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=2500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"EXCEPTION in _build_smart_prompt_text: {str(e)}")
        return f"Role: Expert Assistant\nContext: {user_input}\nTask: Generate a solution for {user_input}"


async def _build_metadata(user_input: str, qa_context: str, smart_prompt_text: str) -> dict:
    """Ask the LLM for compact metadata fields as JSON."""
    prompt = f"""Based on this user idea and their answers, return a small JSON object with these fields ONLY.

USER IDEA: {user_input}

USER ANSWERS:
{qa_context}

Return ONLY this JSON (no markdown, no explanation):
{{
  "title": "4-6 word title for this prompt",
  "summary": "One sentence about what this prompt accomplishes"
}}"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500
        )

        content = response.choices[0].message.content.strip()
        cleaned = clean_json_content(content)
        if cleaned.startswith('{') and not cleaned.endswith('}'):
            cleaned += '\n}'

        return json.loads(cleaned)
    except Exception as e:
        print("EXCEPTION parsing metadata:", e)
        return {
            "title": "Your Smart Prompt",
            "summary": "A detailed AI prompt based on your inputs."
        }


# =========================
# PROMPT SCORING FEATURE
# =========================

async def score_prompt_step1(prompt: str) -> dict:
    eval_prompt = f"""You are a harsh, world-class Prompt Engineering Auditor. 
Evaluate the provided prompt out of 100 based on the following rigorous criteria. 
Be critical: most average prompts should score between 40-60. Only truly exceptional, production-ready prompts should score above 85.

CRITERIA:
1. Persona & Role (0-20): Does it define a specific, expert persona with clear perspective?
2. Task Clarity & Logic (0-20): Are the instructions unambiguous? Is the logic sound?
3. Context & Knowledge (0-20): Does it provide sufficient background and reference data?
4. Guardrails & Safety (0-20): Does it include negative constraints (what NOT to do) and edge-case handling?
5. Structure & Formatting (0-20): Does it use clear headers, delimiters, and specify a precise output schema?

Prompt to evaluate: 
{prompt}

Return ONLY a JSON object. Do not include any explanations outside the JSON.
{{
  "criteria": {{
    "Persona & Role": <score_0_to_20>,
    "Task Clarity & Logic": <score_0_to_20>,
    "Context & Knowledge": <score_0_to_20>,
    "Guardrails & Safety": <score_0_to_20>,
    "Structure & Formatting": <score_0_to_20>
  }},
  "suggestions": [
    "Specific, actionable improvement 1",
    "Specific, actionable improvement 2"
  ]
}}"""
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": eval_prompt}],
            temperature=0.1,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"EXCEPTION in score_prompt_step1: {str(e)}")
        return {
            "criteria": {"Persona & Role": 0, "Task Clarity & Logic": 0, "Context & Knowledge": 0, "Guardrails & Safety": 0, "Structure & Formatting": 0},
            "suggestions": ["System temporarily unable to score prompt."]
        }

async def rewrite_prompt_step2(prompt: str, evaluation_json: dict) -> str:
    rewrite_prompt = f"""You are an expert AI Prompt Engineer.
Feedback: {json.dumps(evaluation_json)}
Original: {prompt}
Rewrite it to be better. Return ONLY the text."""
    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": rewrite_prompt}],
            temperature=0.4,
            max_tokens=2000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"EXCEPTION in rewrite_prompt_step2: {str(e)}")
        return prompt

async def process_prompt_scoring(prompt: str) -> dict:
    try:
        eval_json = await score_prompt_step1(prompt)
        criteria = eval_json.get("criteria", {})
        suggestions = eval_json.get("suggestions", [])
        final_score = sum(criteria.values()) if isinstance(criteria, dict) else 0
        rewritten_prompt = await rewrite_prompt_step2(prompt, eval_json)
        
        try:
            save_prompt_score(prompt, final_score, criteria, suggestions, rewritten_prompt)
        except: pass
            
        return {
            "score": final_score,
            "criteria": criteria,
            "suggestions": suggestions,
            "rewritten_prompt": rewritten_prompt
        }
    except Exception as e:
        print(f"EXCEPTION in process_prompt_scoring: {str(e)}")
        return {"score": 0, "criteria": {}, "suggestions": ["Error scoring prompt."], "rewritten_prompt": prompt}

# =========================
# TEST PROMPT FEATURE
# =========================

async def test_generated_prompt(prompt: str) -> str:
    """Sends the generated prompt to the LLM and returns its response."""
    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=2500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("EXCEPTION testing prompt:", e)
        return f"Error: Failed to test prompt. {str(e)}"

# =========================
# AUTO CATEGORIZATION
# =========================

async def auto_categorize_prompt(prompt_text: str) -> dict:
    """Uses LLM to automatically generate metadata (name, tags, category) for a prompt."""
    prompt = f"""Analyze the following AI prompt and provide organizational metadata.

PROMPT:
{prompt_text}

TASK:
Generate a catchy title (name), a broad category, and 3-5 relevant tags.

Return ONLY a JSON object matching this schema:
{{
  "name": "Title of the prompt",
  "category": "Broad category",
  "tags": ["tag1", "tag2", "tag3"]
}}"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        result_content = response.choices[0].message.content.strip()
        return json.loads(result_content)
    except Exception as e:
        print(f"EXCEPTION in auto_categorize_prompt: {str(e)}")
        return {
            "name": "General Prompt",
            "category": "Uncategorized",
            "tags": ["general"]
        }
