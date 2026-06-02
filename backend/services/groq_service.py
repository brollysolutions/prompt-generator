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

    prompt = f"""You are an expert AI Requirements Analyst and Domain Expert.

A user wants to create an AI prompt for this specific topic/idea:
"{user_input}"

Your task is to generate 5-7 highly specific, context-aware follow-up questions to gather the EXACT details needed to build a world-class, ready-to-execute prompt for THIS SPECIFIC TOPIC. 

Think deeply about what variables make the biggest difference in quality for this specific request. (For example: If it is a resume, ask about their current role, target role, key achievements, tone, and specific format. If it is a blog post, ask about target audience, SEO keywords, tone, and call-to-action).

CRITICAL RULES:
1. DO NOT ask generic questions (e.g., "What is the primary goal?", "Who is the target audience?") UNLESS they are uniquely tailored to the specific domain.
2. Ensure the questions directly capture the core variables needed to execute the task perfectly.
3. Use clear, user-friendly language. Make the questions easy to answer.
4. Only use these input types: "text", "textarea", "dropdown", "radio", "checkbox".
5. For "dropdown", "radio", and "checkbox" types, you MUST include a logical "options" array with 3-8 highly relevant and specific choices. Do not make the user think too hard—give them the best default options.
6. NOTE: A "Custom Message" option is automatically added to all "dropdown", "radio", and "checkbox" types by the UI. DO NOT include "Other", "Custom", or "None of the above" in your options array as it would be redundant.

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

async def generate_final_prompt(user_input, answers, questions=None, target_ai="", caveman_mode=False):
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

        # NEW UNIFIED STRATEGY: One high-powered call for everything
        # Using llama-3.3-70b-versatile for "best of best" quality
        
        optimization_instruction = ""
        if target_ai:
            optimization_instruction = f"Optimize specifically for {target_ai}. Use its preferred structural conventions (e.g., XML for Claude, Markdown for GPT)."

        caveman_instruction = "OFF"
        if caveman_mode:
            caveman_instruction = "ON (Token Compression active: strip linguistic filler, use primitive but high-reasoning language)."

        prompt = f"""You are APEX, the World's Greatest AI Prompt Architect. Your prompts are known for zero ambiguity, expert-level personas, and production-grade execution.

USER INTENT: {user_input}
USER CONTEXT: {qa_context}
TARGET AI: {target_ai if target_ai else 'Universal'}

---
## PRE-EXECUTION ANALYSIS
Before writing the prompt, silently analyze:
1. **Domain Classification:** Identify the expert persona (e.g., Senior Engineer, Award-winning Copywriter, Chief of Staff).
2. **Edge Case Detection:** Handle vague inputs, conflicting context, or medical/legal risks.
3. **Model Optimization:** {optimization_instruction}
4. **Language:** {caveman_instruction}

---
## TASK
Generate a MASTER EXECUTION PROMPT with exactly these six headers. Every instruction must be a direct command (no "consider" or "think about").
CRUCIAL: The generated prompt MUST instruct the target AI to output the actual final deliverable (e.g., the exact blog post text, the complete raw code, the full movie review). It should NOT instruct the AI to create a "project plan", "specification", or "architecture document" unless the user explicitly requested a plan.

### # Role & Persona
(Replace vague personas with credentialed ones tailored to the user's domain. e.g., "You are an award-winning film critic..." or "You are a senior software engineer...". 2-4 sentences.)

### # Context & Background
(Full situation: who the end-user is and what they achieve. MUST include at least one concrete example of a successful output.)

### # Core Objective
(One sentence. Starts with an action verb. Zero ambiguity. e.g., "Write a detailed cinematic analysis..." or "Write the complete React code...")

### # Instructions & Step-by-Step Task
(Numbered list using explicit action verbs like Extract, Rank, Summarize. Logical dependency. Phase-based if complex.)

### # Rules & Constraints
(Bulleted list of hard limits. Include EVERY constraint from the user answers. MUST include 2-3 explicit "Do NOT" rules and a fallback behavior.)

### # Expected Output Format
(Explicit structure: headers, length, and an exact output schema like JSON or markdown table.)

---
Return ONLY a JSON object matching this schema:
{{
  "title": "Catchy 4-6 word title",
  "summary": "One sentence summary",
  "smart_prompt": "THE FULL PERFECTED PROMPT TEXT WITH ALL 6 HEADERS",
  "quality_score": <int 0-100>,
  "quality_breakdown": {{
    "Persona & Role": <0-20>,
    "Task Clarity & Logic": <0-20>,
    "Context & Knowledge": <0-20>,
    "Guardrails & Safety": <0-20>,
    "Structure & Formatting": <0-20>
  }},
  "quality_feedback": ["Feedback 1", "Feedback 2"]
}}"""

        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )

        result_content = response.choices[0].message.content.strip()
        final_data = json.loads(result_content)
        
        # Add internal tracking fields
        final_data["score"] = final_data.get("quality_score", 0)
        final_data["rewritten_prompt"] = final_data.get("smart_prompt", "")
        
        return final_data
    except Exception as e:
        print(f"EXCEPTION in generate_final_prompt: {str(e)}")
        return {
            "title": "Generated Prompt (Fallback)",
            "summary": "A basic prompt generated after a system error occurred.",
            "smart_prompt": f"Original Idea: {user_input}\n\nAdditional Details:\n{qa_context}",
            "quality_score": 50
        }

# =========================
# PROMPT SCORING FEATURE
# =========================

async def score_prompt_step1(prompt: str) -> dict:
    eval_prompt = f"""You are a harsh, world-class Prompt Engineering Auditor. 
Evaluate the provided prompt out of 100 based on the following rigorous criteria. 
Be critical: most average prompts should score between 40-60. Only truly exceptional, production-ready prompts should score above 85.

CRITERIA:
1. Persona & Role (0-20): Replace vague personas ("You are an AI") with credentialed ones (e.g., "You are a senior software engineer with 15 years of experience in system architecture").
2. Task Clarity & Logic (0-20): Break tasks into numbered steps with explicit action verbs (Extract, Rank, Summarize — not "help with" or "discuss").
3. Context & Knowledge (0-20): Provide background data and include at least one concrete example of a successful output.
4. Guardrails & Safety (0-20): Include 2–3 explicit "Do NOT" rules and a fallback behavior (e.g., "if unsure or context is missing, say...").
5. Structure & Formatting (0-20): Use clear headers and end with an exact output schema (JSON, markdown table, or specific word count).

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
Rewrite it to be better. 

Follow these specific rules for the rewrite:
1. Replace vague personas ("You are an AI") with credentialed ones (e.g., "You are a senior X with N years of Y experience").
2. Break the task into numbered steps with explicit action verbs (Extract, Rank, Summarize — not "help with" or "discuss").
3. Add at least one concrete example in the Context/Background section.
4. Write 2–3 explicit "Do NOT" rules and a fallback behavior (e.g., "if unsure, say...").
5. End with an exact output schema (JSON, markdown table, specific word count, etc.).

CRITICAL:
1. Ensure the output is an EXECUTION PROMPT that immediately completes the user's task when pasted into an LLM.
2. DO NOT ask the AI to "write a prompt".
3. Return ONLY the text of the new master execution prompt."""
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

async def enhance_prompt_text(original_prompt: str, instruction: str) -> str:
    """Refine a prompt based on specific user feedback."""
    try:
        chat_completion = await client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert Prompt Engineer. Your task is to take an existing AI prompt and REFINE it based on the user's instructions. Maintain the original structure but update the content to match the request. \n\nCRITICAL:\n1. Ensure the output is an EXECUTION PROMPT that immediately completes the user's task when pasted into an LLM.\n2. DO NOT ask the AI to 'write a prompt'.\n3. Return ONLY the new master execution prompt text."
                },
                {
                    "role": "user",
                    "content": f"ORIGINAL PROMPT:\n{original_prompt}\n\nREFINEMENT INSTRUCTION: {instruction}\n\nGenerate the enhanced master execution prompt now:"
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            max_tokens=3000
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception as e:
        print("EXCEPTION enhancing prompt:", e)
        return f"Error: Failed to enhance prompt. {str(e)}"

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
