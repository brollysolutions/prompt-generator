from groq import AsyncGroq
import os
import re
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

The user wants to create an AI prompt for the following idea:
"{user_input}"

Your task is to generate 5-7 highly specific, context-aware follow-up questions to gather the EXACT details needed to REFINE and FINALIZE this prompt into a world-class, production-ready execution tool. 

Think deeply about what variables make the biggest difference in quality for this specific request. 

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
    }},
    {{
      "question": "Another specific detail needed",
      "type": "checkbox",
      "options": ["Option A", "Option B", "Option C"]
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
            {
                "question": "What are the primary goals you want to achieve with this prompt?", 
                "type": "checkbox",
                "options": ["Automation", "Creative Content", "Data Analysis", "Educational Guidance", "Technical Problem Solving"]
            },
            {
                "question": "Who is the target audience for the AI's response?", 
                "type": "checkbox",
                "options": ["Technical Experts", "General Public", "Small Business Owners", "Students/Learners", "Decision Makers"]
            },
            {
                "question": "Which specific constraints should the AI adhere to?", 
                "type": "checkbox",
                "options": ["Strictly Professional Tone", "Concise Outputs", "Detailed Step-by-Step Guides", "No Technical Jargon", "Avoid Controversial Topics"]
            }
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

        prompt = f"""You are the World's Greatest Expert AI Prompt Engineer. Your mission is to take a raw user idea and their specific responses to clarifying questions to craft a master execution prompt that is highly relevant, clear, and context-aware.

USER INTENT: {user_input}
USER CONTEXT: {qa_context}
TARGET AI: {target_ai if target_ai else 'Universal'}

---
## PRE-EXECUTION ANALYSIS
Before writing the prompt, perform a deep-dive analysis of the input idea and responses:
1. **Strategic Audit:** Identify key aspects, objectives, and specific use cases.
2. **Challenge Detection:** Pinpoint potential challenges, constraints, and "invisible variables" that could lead to ambiguity.
3. **Model Optimization:** {optimization_instruction}
4. **Language:** {caveman_instruction}

---
## TASK
Based on your analysis, generate a FINAL OPTIMIZED PROMPT that can consistently produce accurate, comprehensive, and contextually high-quality output suitable for downstream AI processing. 

The prompt MUST cover these six sections, avoiding all ambiguity, repetition, and irrelevant content:

### # Role & Persona
(Frame the persona as a specialized, world-class AI system. Include a "Boundary Statement" explicitly stating what the AI will NOT do. For educational tasks, include an adaptive fallback protocol.)

### # Context & Background
(Full situation including objectives and use cases. Include the detailed User/Learner Profile: time availability, specific goals, and preferred learning style. Include one concrete example of a successful output.)

### # Core Objective
(One sentence starting with an action verb. Clearly state the primary goal.)

### # Instructions & Step-by-Step Task
(Numbered list using explicit action verbs. For each step, include estimated duration and a specific milestone outcome.)

### # Rules & Constraints
(Bulleted list of hard limits. Replace vague tone rules with behavioral rules. Include 2-3 explicit "Do NOT" rules and a "Hallucination Safeguard".)

### # Expected Output Format
(Explicit structure for the final deliverable. Prioritize depth over brevity and specify exact schemas if necessary.)

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
1. Persona & Role (0-20): Replace vague personas ("You are an AI") with credentialed ones. MUST include a Boundary Statement (what it won't do) and adaptive fallback for educational tasks.
2. Task Clarity & Logic (0-20): Break tasks into numbered steps with explicit action verbs. MUST include estimated durations and milestone outcomes for each step.
3. Context & Knowledge (0-20): Provide background data, include a detailed User/Learner Profile (time, goals, style), and at least one concrete example of success. For technical tasks, ensure a specific DBMS like PostgreSQL is named.
4. Guardrails & Safety (0-20): Include 2–3 explicit "Do NOT" rules, behavioral rules instead of tone rules (including 3 MCQs per section and analogy-first fallback), and hallucination safeguards (version context + explicit hedging if unsure of syntax).
5. Structure & Formatting (0-20): Use clear headers. Educational prompts must specify "3 MCQs with explanations and 1 mini coding challenge with expected output" per section, learning objectives per section, and prioritize depth. End with an exact output schema.

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
1. Replace vague personas ("You are an AI") with credentialed ones. Add a Boundary Statement (what the AI will NOT do) and adaptive fallback protocol for educational tasks.
2. Break the task into numbered steps with explicit action verbs. Add estimated durations and milestone outcomes to each step.
3. Add a detailed User/Learner Profile (time, goals, style) and at least one concrete example in the Context/Background section. For technical tasks, name PostgreSQL as the specific DBMS.
4. Replace vague tone rules with behavioral rules: "Define new concepts in one plain-English sentence before use", "Include 3 MCQs per section with answer explanations", "If a concept needs re-explaining, use a real-world analogy first". Write 2–3 explicit "Do NOT" rules and a "Hallucination Safeguard" (version context + explicit hedging if unsure of syntax).
5. Educational prompts must specify "3 MCQs with explanations and 1 mini coding challenge with expected output" per section, learning objectives per section, and prioritize depth over brevity. End with an exact output schema.

CRITICAL:
1. Ensure the output is an EXECUTION PROMPT that immediately completes the user's task when pasted into an LLM.
2. DO NOT ask the AI to "write a prompt".
3. Return ONLY the text of the new master execution prompt."""
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
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

TEST_PROMPT_SYSTEM_INSTRUCTION = """
Act as an expert AI prompt engineer and consultant. Your task is to take the provided generated final prompt as input and give a response that is highly relevant, professional, and visually structured.

The response MUST be presented in a high-end, consultative format. Where possible, use:
1. "Phase-by-Phase Details" headers.
2. Comprehensive Markdown tables for comparisons, feature lists, or cost breakdowns.
3. Clean lists with checkboxes for feature verification or checklists.

The content should cover key aspects, objectives, challenges, and use cases while avoiding ambiguity. Ensure the output is suitable for a professional report or high-level strategic document.

Furthermore, engage in deep thinking and reasoning. Simulate the advanced reasoning capabilities and response styles of top-tier AI models. Provide a highly structured, comprehensive, and nuanced output that looks polished and expert-level.
"""

async def test_generated_prompt(prompt: str) -> str:
    """Sends the generated prompt to the LLM and returns its response."""
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": TEST_PROMPT_SYSTEM_INSTRUCTION},
                {"role": "user", "content": f"Execute the following prompt:\n\n{prompt}"}
            ],
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
            model="llama-3.3-70b-versatile",
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


