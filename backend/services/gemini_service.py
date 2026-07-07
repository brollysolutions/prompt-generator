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

class GeminiWrapper:
    def __init__(self):
        self.keys = []
        for i in range(1, 15):
            key = os.getenv(f"GEMINI_API_KEY_{i}")
            if key: self.keys.append(key)
        if not self.keys:
            single_key = os.getenv("GEMINI_API_KEY")
            if single_key: self.keys.append(single_key)
        if not self.keys:
            raise ValueError("No GEMINI_API_KEY found in .env")

    class Aio:
        def __init__(self, parent):
            self.parent = parent
            self.models = self.Models(parent)
            
        class Models:
            def __init__(self, parent):
                self.parent = parent
                
            async def generate_content(self, **kwargs):
                import random
                keys = list(self.parent.keys)
                random.shuffle(keys)
                last_err = None
                for key in keys:
                    try:
                        from google import genai
                        client = genai.Client(api_key=key)
                        print(f"\\n[DEBUG] Attempting with Gemini API Key ending in: ...{key[-4:]}")
                        return await client.aio.models.generate_content(**kwargs)
                    except Exception as e:
                        last_err = e
                        print(f"[DEBUG] Key ...{key[-4:]} failed. Retrying next key... Error: {str(e)[:60]}")
                        continue
                print("[ERROR] ALL GEMINI KEYS EXHAUSTED!")
                raise last_err
                
    @property
    def aio(self):
        return self.Aio(self)

def get_client():
    return GeminiWrapper()

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
    language_instruction = """
### LANGUAGE MATCHING PROTOCOL ###
You MUST analyze the user's input and reply in the EXACT SAME language and script.
- If the input is in English, generate all questions and options purely in English.
- If the input is in Teluglish (Telugu words using English letters), generate all questions and options purely in Teluglish. CRITICAL: Use natural, conversational, everyday Telugu that friends use to chat (e.g., "Mee level enti?", "Evaru target audience?"). DO NOT use formal/bookish Telugu. DO NOT robotically repeat the user's prompt. Do NOT use Telugu script.
- If the input is in Hinglish (Hindi words using English letters), generate all questions and options purely in Hinglish. CRITICAL: Use natural, conversational, everyday Hindi (e.g., "Aapka level kya hai?"). DO NOT use formal/bookish Hindi. DO NOT robotically repeat the user's prompt. Do NOT use Devanagari script.
"""
    prompt = f"""You are an expert AI Requirements Analyst and Domain Expert.

{language_instruction}

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
6. For every question, you MUST include a logical "options" array with 3-8 highly relevant and specific choices. CRITICAL: These options MUST be written in the EXACT SAME LANGUAGE and script (e.g., Teluglish, Hinglish) as the question! Do not default to English options if the user input is not English.
7. NOTE: A "Custom Message" option is automatically added to all checkbox questions by the UI. DO NOT include "Other", "Custom", or "None of the above" in your options array as it would be redundant.

Return ONLY a JSON object matching this exact schema:
{{
  "questions": [
    {{
      "question": "A highly specific question related to the user's idea (in the detected language)",
      "type": "checkbox",
      "options": ["Option 1 (in detected language)", "Option 2 (in detected language)", "Option 3 (in detected language)"]
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

async def generate_final_prompt(user_input: str, answers: dict, questions: list = None, target_ai: str = "Universal", tone: str = "Auto", output_format: str = "Auto", length: str = "Auto", role: str = "", caveman_mode: bool = False) -> dict:
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
    
    advanced_instructions = []
    if tone and tone != "Auto": advanced_instructions.append(f"- Tone: {tone}")
    if output_format and output_format != "Auto": advanced_instructions.append(f"- Output Format: {output_format}")
    if length and length != "Auto": advanced_instructions.append(f"- Length: {length}")
    if role and role.strip(): advanced_instructions.append(f"- Persona/Role: {role} (Override the default persona with this)")
    
    advanced_text = ""
    if advanced_instructions:
        advanced_text = "\n# Advanced User Controls (CRITICAL: MUST OBEY):\n" + "\n".join(advanced_instructions) + "\n"

    language_instruction = """
### LANGUAGE MATCHING PROTOCOL ###
You MUST analyze the user's input and Q&A answers, and reply in the EXACT SAME language and script.
- If the input/answers are in English, generate the prompt purely in English.
- If the input/answers are in Teluglish (Telugu words using English letters), generate the entire prompt purely in Teluglish. Do NOT use Telugu script. Do NOT provide English translations. CRITICAL: You must still write a highly structured AI prompt with all the required sections, just write the content in Teluglish. Do not just repeat the user's answers.
- If the input/answers are in Hinglish (Hindi words using English letters), generate the entire prompt purely in Hinglish. Do NOT use Devanagari script. Do NOT provide English translations. CRITICAL: You must still write a highly structured AI prompt with all the required sections, just write the content in Hinglish. Do not just repeat the user's answers.
"""

    prompt = f"""You are a master AI Prompt Engineer. Your task is to synthesize the user's initial idea and their specific Q&A answers into a SINGLE, world-class execution prompt.
# User Request:
Original Idea: {user_input}
# Q&A Context:
{qa_context}
# Target AI:
{target_ai_text}
{advanced_text}
# Language:
{language_instruction}
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
5. CRITICAL: Ensure all newlines inside the `smart_prompt` string are properly escaped as `\\n` so the output is valid JSON.
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
        final_data = json.loads(result_content, strict=False)
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
        language_instruction = """
### LANGUAGE MATCHING PROTOCOL ###
You MUST analyze the language of the prompt and reply in the EXACT SAME language and script.
- If the prompt is in English, respond purely in English.
- If the prompt is in Teluglish (Telugu words using English letters), respond purely in Teluglish. Do NOT use Telugu script.
- If the prompt is in Hinglish (Hindi words using English letters), respond purely in Hinglish. Do NOT use Devanagari script.
"""
        sys_prompt = f"You are the target AI receiving this prompt. Fulfill it as best as possible to demonstrate how it works.\n\n{language_instruction}"
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

async def generate_analytics_report_card(stats_summary: str) -> str:
    prompt = f"""You are a helpful AI analyzing a user's prompt generation statistics.
Based on the following stats, write a 1-2 sentence encouraging narrative summarizing their progress. 
Make it feel like a personalized "report card" reward.
Stats: {stats_summary}"""
    try:
        response = await get_client().aio.models.generate_content(
            model=model_name,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"EXCEPTION in generate_analytics_report_card: {str(e)}")
        return "You're doing great! Keep generating high-quality prompts."

