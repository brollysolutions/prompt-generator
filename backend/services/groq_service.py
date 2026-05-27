from groq import Groq
import os
from dotenv import load_dotenv
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import save_prompt_score

load_dotenv()

client = Groq(
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

def generate_questions(user_input):

    prompt = f"""You are an expert AI Requirements Analyst.

A user wants to create an AI prompt for this specific topic/idea:
"{user_input}"

Your task is to generate 5-7 highly specific, context-aware follow-up questions to gather the exact details needed to build a world-class prompt for THIS SPECIFIC TOPIC.

CRITICAL RULES:
1. DO NOT ask generic questions (e.g., "What is the primary goal?", "Who is the target audience?", "What is your experience level?") UNLESS it perfectly aligns with the topic.
2. Tailor every question to the domain. (e.g., If it's a diet plan, ask about allergies, calorie goals, cuisine preferences. If it's code, ask about tech stack, edge cases, deployment).
3. Only use these input types: "text", "textarea", "dropdown", "radio", "checkbox".
4. For "dropdown", "radio", and "checkbox" types, you MUST include a logical "options" array with 3-6 highly relevant choices.

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

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=1500,
        response_format={"type": "json_object"}
    )

    result_content = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(result_content)
        return parsed.get("questions", [])
    except Exception as e:
        print("EXCEPTION generating questions:", e)
        print("RAW CONTENT:", result_content)
        return []

# =========================
# GENERATE FINAL PROMPT
# =========================

def generate_final_prompt(user_input, answers, questions=None, target_ai=""):

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

    # -----------------------------------------------
    # ITERATIVE REFINEMENT LOOP (Self-Reflection)
    # -----------------------------------------------
    
    # Step 1: Draft the initial version
    draft_prompt = _build_smart_prompt_text(user_input, qa_context, target_ai)
    
    # Step 2: Critique the draft
    critique = _critique_prompt(draft_prompt, user_input, qa_context)
    
    # Step 3: Refine and polish based on critique
    final_smart_prompt = _refine_prompt(draft_prompt, critique)

    # Now build the metadata JSON using a simpler call
    meta = _build_metadata(user_input, qa_context, final_smart_prompt)
    
    meta["smart_prompt"] = final_smart_prompt
    
    return meta


def _critique_prompt(draft_prompt: str, user_input: str, qa_context: str) -> str:
    """Critique the draft prompt to find weaknesses, missing details, or areas for improvement."""
    prompt = f"""You are a Senior Prompt Engineer. Critique the following draft prompt against the user's original intent and context.

USER ORIGINAL INTENT:
{user_input}

USER CONTEXT:
{qa_context}

DRAFT PROMPT:
{draft_prompt}

List 3-5 specific, actionable improvements to make this the "best of the best" prompt. Focus on:
- Missing edge cases or negative constraints.
- Enhancing the expert persona.
- Improving the logical flow of instructions.
- Adding specific formatting requirements.

Return only the list of improvements."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1000
    )
    return response.choices[0].message.content.strip()


def _refine_prompt(draft_prompt: str, critique: str) -> str:
    """Rewrite the draft prompt incorporating the critique and expert refinements."""
    prompt = f"""You are a Master Prompt Architect. Rewrite the draft prompt by incorporating the provided critique to create a truly flawless, high-performance master prompt.

DRAFT PROMPT:
{draft_prompt}

CRITIQUE & IMPROVEMENTS:
{critique}

Final Refinement Rules:
1. Maintain the existing headers (# Role & Persona, # Context & Background, etc.).
2. Deepen the detail and sophistication of each section.
3. Ensure every point in the critique is addressed.
4. Keep it professional, structured, and ready to use.

Write the final perfected master prompt now:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=3000
    )
    return response.choices[0].message.content.strip()


def _build_smart_prompt_text(user_input: str, qa_context: str, target_ai: str = "") -> str:
    """Ask the LLM to write the final ready-to-use prompt as plain text using advanced frameworks."""
    
    optimization_instruction = ""
    if target_ai:
        optimization_instruction = f"IMPORTANT: Optimize this prompt specifically for use with {target_ai}. Leverage its specific context window strengths, instruction-following capabilities, and formatting preferences."

    prompt = f"""You are a world-class AI Prompt Engineer and System Prompt Architect.

Your task is to write a COMPLETE, highly detailed, ready-to-use master prompt based on a user's initial idea and their responses to clarifying questions.

{optimization_instruction}

USER INITIAL IDEA:
{user_input}

USER ANSWERS & CONTEXT:
{qa_context}

Framework Instructions for the Master Prompt:
1. **Delimiters**: Use clear delimiters (like XML-style tags or Markdown headers) to separate sections.
2. **Role & Expertise**: Establish a deeply expert persona with a specific tone and knowledge base.
3. **Chain of Thought**: Explicitly instruct the AI to "think step-by-step" or "reason through the problem" before providing the final answer.
4. **Few-Shot Prompting**: If applicable, include a placeholder or a brief example of the expected interaction.
5. **Negative Constraints**: List things the AI should NEVER do to ensure safety and alignment.
6. **Dynamic Variables**: If the prompt needs inputs later, use [BRACKETS] to indicate where variables should go.

You MUST output the final prompt using EXACTLY the markdown structure and headers below. Do NOT write paragraphs without headers. Every header must be present:

# Role & Persona
[Define a strong, specific expert persona. Write in second-person, e.g. "You are..."]

# Context & Background
[Explain the background of this task, incorporating ALL user answers and constraints. Be highly specific.]

# Core Objective
[State the main goal clearly and concisely.]

# Instructions & Step-by-Step Task
[Detail a comprehensive, logical workflow. Explicitly tell the AI to use internal reasoning/Chain-of-Thought.]

# Rules & Constraints
[Enforce specific constraints. Include a "What NOT to do" section.]

# Expected Output Format
[Describe exactly what the final output should look like. Provide a structural template.]

Additional Rules:
1. Do NOT write conversational intros or outros. Start immediately with the "# Role & Persona" header.
2. Must be highly detailed, professional, and at least 400-600 words.
3. Write the prompt content in the second person ("You are...", "Your task is...").
4. Incorporate every single detail provided in the USER ANSWERS to customize the prompt to their exact needs.

Write the master prompt content now:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4, # Lower temperature to make it follow rules strictly
        max_tokens=2500
    )
    return response.choices[0].message.content.strip()


def _build_metadata(user_input: str, qa_context: str, smart_prompt_text: str) -> dict:
    """Ask the LLM for compact metadata fields as JSON."""
    prompt = f"""Based on this user idea and their answers, return a small JSON object with these fields ONLY.

USER IDEA: {user_input}

USER ANSWERS:
{qa_context}

Return ONLY this JSON (no markdown, no explanation):
{{
  "title": "4-6 word title for this prompt",
  "summary": "One sentence about what this prompt accomplishes",
  "role": "The AI persona (one sentence starting with You are...)",
  "context": "Brief background context (1-2 sentences)",
  "task": "The main task in 1-2 sentences",
  "constraints": "Key rules or limitations in 1-2 sentences",
  "output_format": "How the output should be formatted (1 sentence)",
  "tone": "Tone and style in 2-3 words (e.g. Professional and technical)"
}}"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1000
    )

    content = response.choices[0].message.content.strip()
    print("=== METADATA RESPONSE ===")
    print(content)
    print("========================")

    cleaned = clean_json_content(content)
    # If the JSON response is cut off and lacks a closing brace, try to append it
    if cleaned.startswith('{') and not cleaned.endswith('}'):
        cleaned += '\n}'

    try:
        return json.loads(cleaned)
    except Exception as e:
        print("EXCEPTION parsing metadata:", e)
        # Attempt manual parsing of key fields as a fallback
        fallback = {
            "title": "Your Smart Prompt",
            "summary": "A detailed AI prompt based on your inputs.",
            "role": "",
            "context": "",
            "task": "",
            "constraints": "",
            "output_format": "",
            "tone": ""
        }
        for key in fallback.keys():
            import re
            match = re.search(rf'"{key}"\s*:\s*"([^"]*?)"\s*(?:,|\n|}})', content, re.DOTALL)
            if match:
                fallback[key] = match.group(1).strip()
            else:
                match_simple = re.search(rf'"{key}"\s*:\s*"([^"]*)"', content)
                if match_simple:
                    fallback[key] = match_simple.group(1).strip()
        return fallback


# =========================
# PROMPT SCORING FEATURE
# =========================

def score_prompt_step1(prompt: str) -> dict:
    eval_prompt = f"""You are a world-class Prompt Engineering Auditor. Your task is to provide a RIGOROUS and UNBIASED evaluation of the provided prompt.

Evaluate the prompt out of 100 based on these strict industry-standard dimensions:
1. Persona & Role (0-20): Is the persona deeply expert, specific, and well-defined?
2. Task Clarity & Logic (0-20): Are the instructions crystal clear and logically sequenced?
3. Context & Knowledge (0-20): Does it provide sufficient background and data?
4. Guardrails & Safety (0-20): Are there explicit negative constraints and quality checks?
5. Structure & Formatting (0-20): Does it use advanced techniques like XML or Chain-of-Thought headers?

User Prompt to evaluate:
{prompt}

Return ONLY a JSON object with this structure:
{{
  "criteria": {{
    "Persona & Role": 18,
    "Task Clarity & Logic": 16,
    "Context & Knowledge": 14,
    "Guardrails & Safety": 12,
    "Structure & Formatting": 20
  }},
  "suggestions": [
    "Specific suggestion 1",
    "Specific suggestion 2"
  ]
}}
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": eval_prompt}],
        temperature=0.1,
        max_tokens=1000,
        response_format={"type": "json_object"}
    )
    content = response.choices[0].message.content
    try:
        return json.loads(content)
    except Exception as e:
        print("EXCEPTION parsing score:", e)
        return {
            "criteria": {"Persona & Role": 0, "Task Clarity & Logic": 0, "Context & Knowledge": 0, "Guardrails & Safety": 0, "Structure & Formatting": 0},
            "suggestions": ["Failed to evaluate prompt."]
        }

def rewrite_prompt_step2(prompt: str, evaluation_json: dict) -> str:
    rewrite_prompt = f"""You are an expert AI Prompt Engineer.
The user provided a prompt that was evaluated and received the following feedback:
{json.dumps(evaluation_json, indent=2)}

Original Prompt:
{prompt}

Rewrite the prompt to improve its score across all criteria while keeping the original intent. The rewritten prompt should be highly effective, clear, and structured.
Return ONLY the rewritten prompt text. Do not include markdown blocks like ``` or explanations.
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": rewrite_prompt}],
        temperature=0.4,
        max_tokens=2000
    )
    return response.choices[0].message.content.strip()

def process_prompt_scoring(prompt: str) -> dict:
    eval_json = score_prompt_step1(prompt)
    
    criteria = eval_json.get("criteria", {})
    suggestions = eval_json.get("suggestions", [])
    
    # Calculate final score
    final_score = sum(criteria.values()) if isinstance(criteria, dict) else 0
    
    rewritten_prompt = rewrite_prompt_step2(prompt, eval_json)
    
    # Save to database
    try:
        save_prompt_score(prompt, final_score, criteria, suggestions, rewritten_prompt)
    except Exception as e:
        print("EXCEPTION saving to DB:", e)
        
    return {
        "score": final_score,
        "criteria": criteria,
        "suggestions": suggestions,
        "rewritten_prompt": rewritten_prompt
    }
