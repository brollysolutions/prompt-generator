import os
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
import json
import asyncio
from google import genai
from google.genai import types
from dotenv import load_dotenv
from database import save_prompt_score

load_dotenv(override=True)

import random

def get_client():
    keys = []
    for i in range(1, 15):
        key = os.getenv(f"GEMINI_API_KEY_{i}")
        if key:
            keys.append(key)
    
    if not keys:
        single_key = os.getenv("GEMINI_API_KEY")
        if single_key:
            return genai.Client(api_key=single_key)
        raise ValueError("No GEMINI_API_KEY found in .env")
        
    chosen_key = random.choice(keys)
    print(f"\n[DEBUG] 🚀 Using Gemini API Key ending in: ...{chosen_key[-4:]}\n")
    return genai.Client(api_key=chosen_key)

model_name = "gemini-2.5-flash"

def clean_json_content(content: str) -> str:
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()

async def generate_questions(user_input):
    prompt = f"""You are an expert AI Requirements Analyst and Domain Expert.
The user wants to create an AI prompt for the following idea:
"{user_input}"
Your task is to generate 5-7 highly specific, context-aware follow-up questions to gather the EXACT details needed to REFINE and FINALIZE this prompt into a world-class, production-ready execution tool. 
CRITICAL RULES:
1. DO NOT ask generic questions (e.g., "What is the primary goal?", "Who is the target audience?") UNLESS they are uniquely tailored to the specific domain.
2. Ensure the questions directly capture the core variables needed to execute the task perfectly.
3. For educational or mentorship tasks, you MUST include questions about:
   - Time availability per week.
   - Specific end-goal (e.g., job-seeking, side project, hobby).
   - Preferred learning style (e.g., hands-on/coding-first, theoretical/reading, video-based).
4. Use clear, user-friendly language. Make the questions easy to answer.
5. ALL questions MUST use the "checkbox" type. This allows the user to select multiple relevant options.
6. For every question, you MUST include a logical "options" array with 3-8 highly relevant and specific choices. Do not make the user think too hard—give them the best default options.
7. NOTE: A "Custom Message" option is automatically added to all checkbox questions by the UI. DO NOT include "Other", "Custom", or "None of the above" in your options array as it would be redundant.

Return ONLY a JSON object matching this exact schema:
{{
  "questions": [
    {{
      "question": "A highly specific question related to the user's idea",
      "type": "checkbox",
      "options": ["Specific Option 1", "Specific Option 2", "Specific Option 3"]
    }}
  ]
}}"""
    try:
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        result_content = clean_json_content(response.text)
        parsed = json.loads(result_content)
        return parsed.get("questions", [])
    except Exception as e:
        print(f"EXCEPTION generating questions: {str(e)}")
        return [
            {
                "question": "What are the primary goals you want to achieve with this prompt?", 
                "type": "checkbox",
                "options": ["Automation", "Creative Content", "Data Analysis", "Educational Guidance", "Technical Problem Solving"]
            }
        ]

async def generate_final_prompt(user_input: str, answers: dict, questions: list = None, target_ai: str = "Universal", caveman_mode: bool = False) -> dict:
    qa_context = ""
    if questions and len(questions) > 0:
        for idx, q in enumerate(questions):
            ans = answers.get(str(idx), answers.get(idx, "Not specified"))
            if isinstance(ans, list):
                ans = ", ".join(ans)
            qa_context += f"Q: {q.get('question')}\nA: {ans}\n\n"
    else:
        for k, v in answers.items():
            ans = v
            if isinstance(ans, list):
                ans = ", ".join(ans)
            qa_context += f"Q: Question {int(k)+1}\nA: {ans}\n\n"

    target_ai_text = f"Target AI Model: {target_ai}" if target_ai else "Target AI Model: Universal (Any LLM)"

    prompt = f"""You are a master AI Prompt Engineer. Your task is to synthesize the user's initial idea and their specific Q&A answers into a SINGLE, world-class execution prompt.
# User Request:
Original Idea: {user_input}
# Q&A Context:
{qa_context}
# Target AI:
{target_ai_text}
CRITICAL INSTRUCTIONS:
1. The `smart_prompt` must be written FROM the perspective of the User TO the AI. When the user copies `smart_prompt` and pastes it into ChatGPT/Claude, it should execute their task perfectly.
2. DO NOT write "Here is your prompt" inside `smart_prompt`. 
3. Include these EXACT sections in the `smart_prompt` using Markdown headers:
   - # Context & Goal
   - # Target Audience / User Profile
   - # Role & Persona (Give the AI a highly qualified persona)
   - # Specific Tasks / Instructions (Numbered list with action verbs)
   - # Rules & Constraints (Include 2-3 negative constraints "Do NOT...")
   - # Expected Output Format (Clear instructions on how the AI should present the final answer, e.g., bullet points, paragraphs, or a table. Do NOT ask for JSON unless the user explicitly requested it)
4. DO NOT use markdown bolding (asterisks/stars like **text**) anywhere in the `smart_prompt` output. Use plain text formatting for lists and emphasis.
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
    try:
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        result_content = clean_json_content(response.text)
        final_data = json.loads(result_content)
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

async def score_prompt_step1(prompt: str) -> dict:
    eval_prompt = f"""You are a brutally strict, world-class Prompt Engineering Auditor. 
Evaluate the provided prompt out of 100 based on the following rigorous criteria. 
Be EXTREMELY critical. DO NOT GIVE A PERFECT SCORE.
- A basic, average prompt should score between 30-50.
- A good, detailed prompt should score between 55-75.
- Only a truly exceptional, industry-leading, perfectly engineered prompt should score above 80.
- It is almost IMPOSSIBLE to score above 90 unless it is a flawless masterpiece.
Deduct points heavily for generic phrasing, lack of specific edge-case handling, or missing constraints.

CRITERIA:
1. Persona & Role (0-20): Deduct points if the persona is generic or lacks specific expertise.
2. Task Clarity & Logic (0-20): Deduct points if any step is ambiguous or could be misinterpreted by an LLM.
3. Context & Knowledge (0-20): Deduct points if the prompt lacks necessary background variables.
4. Guardrails & Safety (0-20): Deduct points if there are no negative constraints ("Do NOT...") or formatting restrictions.
5. Structure & Formatting (0-20): Deduct points if it does not use markdown headers or is visually cluttered.
Prompt to evaluate: 
{prompt}
Return ONLY a JSON object:
{{
  "criteria": {{
    "Persona & Role": <score_0_to_20>,
    "Task Clarity & Logic": <score_0_to_20>,
    "Context & Knowledge": <score_0_to_20>,
    "Guardrails & Safety": <score_0_to_20>,
    "Structure & Formatting": <score_0_to_20>
  }},
  "suggestions": ["Specific, actionable improvement 1"]
}}"""
    try:
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=eval_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        content = clean_json_content(response.text)
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
Rewrite it to be better. Ensure it remains an EXECUTION PROMPT. Return ONLY the text of the new master execution prompt."""
    try:
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=rewrite_prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"EXCEPTION in rewrite_prompt_step2: {str(e)}")
        return prompt

async def process_prompt_scoring(prompt: str) -> dict:
    try:
        eval_json = await score_prompt_step1(prompt)
        criteria = eval_json.get("criteria", {})
        suggestions = eval_json.get("suggestions", [])
        final_score = 0
        if isinstance(criteria, dict):
            for v in criteria.values():
                try: final_score += int(v)
                except: pass
        rewritten_prompt = await rewrite_prompt_step2(prompt, eval_json)
        try: save_prompt_score(prompt, final_score, criteria, suggestions, rewritten_prompt)
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
    try:
        prompt = f"ORIGINAL PROMPT:\n{original_prompt}\n\nREFINEMENT INSTRUCTION: {instruction}\n\nGenerate the enhanced master execution prompt now. Return ONLY the prompt text."
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"EXCEPTION in enhance_prompt_text: {str(e)}")
        return original_prompt

async def test_generated_prompt(prompt: str) -> str:
    try:
        sys_prompt = "You are the target AI receiving this prompt. Fulfill it as best as possible to demonstrate how it works."
        full_prompt = f"{sys_prompt}\n\n{prompt}"
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=full_prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"EXCEPTION in test_generated_prompt: {str(e)}")
        return "Could not run test."

async def auto_categorize_prompt(prompt_text: str) -> dict:
    prompt = f"""Analyze this prompt:
{prompt_text}
Return JSON:
{{
  "name": "Short precise name",
  "category": "One broad category",
  "tags": ["tag1", "tag2", "tag3"]
}}"""
    try:
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        content = clean_json_content(response.text)
        return json.loads(content)
    except Exception as e:
        print(f"EXCEPTION in auto_categorize_prompt: {str(e)}")
        return {"name": "New Prompt", "category": "General", "tags": []}

