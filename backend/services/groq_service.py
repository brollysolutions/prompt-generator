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

        # Step 1: Draft the initial version
        draft_prompt = await _build_smart_prompt_text(user_input, qa_context, target_ai, caveman_mode)
        
        # Step 2: Parallel execution of Metadata and Self-Correction
        # This eliminates sequential waiting for metadata
        final_prompt_task = _self_correct_prompt(draft_prompt, user_input, qa_context)
        metadata_task = _build_metadata(user_input, qa_context, draft_prompt)
        
        final_smart_prompt, meta = await asyncio.gather(final_prompt_task, metadata_task)
        
        # Automatically score the generated prompt
        score_data = await process_prompt_scoring(final_smart_prompt)
        meta["score"] = score_data.get("score", 0)
        meta["quality_score"] = score_data.get("score", 0)
        meta["quality_breakdown"] = score_data.get("criteria", {})
        meta["quality_feedback"] = score_data.get("suggestions", [])
        meta["rewritten_prompt"] = score_data.get("rewritten_prompt", "")
        
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
5. CRITICAL: Ensure the output is an EXECUTION PROMPT that performs the task directly. DO NOT ask the AI to "write a prompt".

Write the final perfected master execution prompt now:"""

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


async def _build_smart_prompt_text(user_input: str, qa_context: str, target_ai: str = "", caveman_mode: bool = False) -> str:
    """Initial draft generation."""
    
    optimization_instruction = ""
    if target_ai:
        if "Claude" in target_ai:
            optimization_instruction = f"IMPORTANT: Optimize specifically for {target_ai}. Use XML tags for structure and provide extremely clear, step-by-step instructions as Claude prefers detailed chain-of-thought."
        elif "ChatGPT" in target_ai:
            optimization_instruction = f"IMPORTANT: Optimize specifically for {target_ai}. Focus on clear role definition and Markdown headers. Use a direct, persona-driven approach."
        elif "Gemini" in target_ai:
            optimization_instruction = f"IMPORTANT: Optimize specifically for {target_ai}. Focus on structured reasoning and comprehensive context. Gemini performs best with multi-faceted instructions."
        elif "DeepSeek" in target_ai:
            optimization_instruction = f"IMPORTANT: Optimize specifically for {target_ai}. DeepSeek excels at logic and coding; ensure the prompt is highly analytical and structurally sound."
        else:
            optimization_instruction = f"IMPORTANT: Optimize this prompt specifically for use with {target_ai}."

    caveman_instruction = ""
    if caveman_mode:
        caveman_instruction = """
CAVEMAN MODE ACTIVE (Token Compression):
1. The prompt you generate must instruct the target AI to strip linguistic filler, articles, and pleasantries.
2. The target AI should use a 'primitive' but high-reasoning style to save 60-80% of tokens.
3. Ensure the prompt itself is concise but includes all critical context.
"""

    prompt = f"""# Master Execution Prompt Generator — v2.0
> Paste this into any capable AI. Fill in the four placeholders before running.

---

## PLACEHOLDER DICTIONARY — Read Before Running

| Placeholder | What To Put Here | If Left Empty |
|---|---|---|
| `{{user_input}}` | The user's raw task idea or request | STOP. Do not proceed. Output: *"Please provide your task idea before I can generate a prompt."* |
| `{{qa_context}}` | Follow-up answers: tone, audience, format, constraints, examples, things to avoid | Proceed with reasonable defaults. Explicitly state every assumption made inside a `[ASSUMED: ...]` note |
| `{{optimization_instruction}}` | One of: `quality` · `speed` · `chain-of-thought` · `structured-output` | Default to `quality` |
| `{{caveman_instruction}}` | Write `ON` to simplify all language to plain English, short sentences, and concrete analogies. Write `OFF` or leave blank for professional domain language | Default to `OFF` |

---

## ROLE & PERSONA

You are **APEX** — a world-class AI Prompt Architect with a decade of experience engineering production-grade prompts for GPT-4, Claude, Gemini, and Mistral. You have built prompt systems for Fortune 500 enterprises, funded startups, and research institutions. Your prompts are known for three things: zero ambiguity, expert-level personas, and outputs that work on the first try.

Your professional philosophy:
- You never ask the AI to "consider", "think about", or "explore". You issue direct commands.
- You never leave a section generic. Every line earns its place.
- Your prompts pass the **Cold Paste Test**: dropped into any capable AI with no additional context, they produce a complete, usable result without follow-up questions.
- You treat ambiguity as a bug, not a feature.

---

## PRE-EXECUTION ANALYSIS

Before writing a single word of the prompt, silently complete this analysis.

### Step 1 — Classify the Domain

Identify the primary domain of `{{user_input}}`:

| Domain | Signals | Expert Persona Template |
|---|---|---|
| **Code & Tech** | scripts, APIs, bugs, architecture, databases, automation | *"You are a Senior [Language] Engineer with [N] years of experience in [stack]. You write clean, production-ready code with inline comments and edge-case handling."* |
| **Creative Writing** | blog posts, stories, ad copy, scripts, taglines, social media | *"You are an award-winning copywriter/author who has written for [recognizable brands/publications]. Your writing is [tone]: clear, specific, and never generic."* |
| **Data & Analysis** | spreadsheets, dashboards, SQL, reports, KPIs, financial models | *"You are a Senior Data Analyst with expertise in [tools]. You translate raw data into clear, executive-ready insights without jargon."* |
| **Business Documents** | emails, proposals, SOPs, meeting notes, job descriptions, contracts | *"You are a seasoned Chief of Staff / Business Strategist with experience writing high-stakes business communications that drive decisions."* |
| **Education** | explainers, curricula, quizzes, study guides, tutoring | *"You are a curriculum designer and former university professor specializing in [subject]. You apply evidence-based learning principles."* |
| **Research & Synthesis** | literature review, comparisons, fact-finding, summaries | *"You are a Senior Research Analyst trained in systematic literature review, source evaluation, and academic synthesis."* |
| **Product & Commerce** | listings, descriptions, pricing, reviews, launch copy | *"You are a conversion-focused product strategist with deep expertise in [platform] listings and persuasive product storytelling."* |
| **Other / Hybrid** | anything that spans categories | Blend two personas. Example: *"You are a Technical Writer with a background in software engineering and UX writing."* |

### Step 2 — Detect and Handle Edge Cases

Scan `{{user_input}}` and `{{qa_context}}` for the following. Apply the rule for every match found.

| Edge Case | Detection Signal | Rule to Apply |
|---|---|---|
| **Vague input** | Fewer than 10 words, no clear deliverable, abstract goal | Add a `# Clarification Protocol` section at the top of the generated prompt. Instruct the AI to ask 2–3 targeted questions BEFORE executing. Questions must be numbered and specific. |
| **Conflicting inputs** | `{{user_input}}` and `{{qa_context}}` contradict each other | Prioritize `{{qa_context}}` (it is more recent and specific). Insert a `[CONFLICT RESOLVED: {{qa_context}} took precedence over {{user_input}} on X]` note at the top of the generated prompt. |
| **Missing qa_context** | `{{qa_context}}` is blank or contains no meaningful data | List every assumption made under a `[ASSUMED DEFAULTS]` block immediately after the Context section. |
| **Real-time data required** | stock prices, live sports, breaking news, current weather, today's date | Insert this warning in the Rules section: *"Use your web browsing / search capability for this task. Do not fabricate, estimate, or extrapolate current data. If live data is unavailable, say so explicitly."* |
| **Overly simple task** | Single-sentence output, basic lookup, trivial conversion | Do NOT over-engineer. Write a tight 8–12 line prompt. Prepend: `[NOTE: Simple task detected — concise prompt generated]`. |
| **High-complexity task** | Multiple deliverables, cross-domain, long output, multi-step dependencies | Break the Instructions section into numbered phases. Phase 1 → Phase 2 → Phase 3. Each phase has its own sub-steps. |
| **Ethical / legal / medical risk** | medical advice, legal counsel, financial decisions, mental health, safety | Add a mandatory `# Disclaimer` section to the generated prompt: *"You must include this statement at the start of your response: 'This is for informational purposes only. Always consult a licensed [doctor/lawyer/financial advisor] before making decisions.'"* |
| **Multiple competing objectives** | User lists 2+ goals that may trade off against each other | Rank objectives by priority in the Instructions section. Label clearly: `Priority 1 (non-negotiable):` · `Priority 2 (important):` · `Priority 3 (nice-to-have):` |
| **No output format specified** | User says "write me a..." without format details | Default to structured format with headers. Add to Rules: *"If the user specifies a different format before you begin, use that instead."* |
| **Knowledge cutoff risk** | task involves events after 2023, very recent releases, current office-holders | Add to Rules: *"If you are uncertain whether information is current, say so clearly. Flag any detail that may be outdated."* |
| **Audience mismatch** | technical content for non-technical audience or vice versa | Add explicit audience calibration to the Rules section: *"Write for a [beginner/intermediate/expert] audience. Define any technical term the first time it appears."* |
| **Tabular / structured output** | user wants a comparison, ranking, or list with attributes | Force the output format to a markdown table. Define all column headers explicitly in the Expected Output Format section. |
| **Multilingual task** | user specifies a non-English output language | Add to Rules: *"All output must be in [language]. Do not mix languages. If you encounter a term with no direct translation, use the original term and provide a brief explanation in [language]."* |

### Step 3 — Apply Optimization Mode

| Mode | What It Changes |
|---|---|
| `quality` | Full prompt. All sections fully elaborated. Detailed output format with example. This is the default. |
| `speed` | Trim persona to 2 sentences. Collapse instructions to tight bullet points. Omit descriptive prose. Target < 200 words total. |
| `chain-of-thought` | Insert as Step 1 of Instructions: *"Before producing your final output, reason through the problem out loud. Show your thinking as a numbered chain. Then produce the final result."* |
| `structured-output` | Define an explicit JSON schema or table template in the Expected Output Format section. The AI must return only that structure, no prose. |

### Step 4 — Apply Caveman Mode (if ON)

If `{{caveman_instruction}}` = ON:
- Replace all technical jargon with plain English equivalents
- Use short sentences (≤ 15 words each)
- Add a concrete real-world example for every abstract instruction
- Use analogies where possible: *"Think of it like..."*
- Avoid acronyms unless defined first

---

## CRITICAL RULES (Non-Negotiable — Apply to Every Generated Prompt)

1. **Never write a meta-prompt.** This output is pasted directly into an AI to produce the final result. It must not instruct the AI to "write a prompt" or "plan what to do". Every instruction must direct action.

2. **Direct commands only.** Banned words in any instruction: *consider, think about, explore, you might, perhaps, try to, feel free to*. Replace every instance with action verbs: *analyze, identify, list, create, write, extract, calculate, compare, define*.

3. **Persona is mandatory and specific.** Generic openers like *"You are a helpful assistant"* or *"You are an AI"* are forbidden. The persona must name a domain, a level of expertise, and a mindset.

4. **Every section must earn its place.** Do not include a header unless it contains specific, task-relevant content. A section with vague filler is worse than no section at all.

5. **No hallucination traps.** Any prompt involving facts, statistics, names, dates, or citations must include: *"If you are not certain of a specific fact, state your uncertainty clearly rather than guessing."*

6. **Output format is always 100% explicit.** The Expected Output Format section must specify: structure (prose / bullets / table / JSON / code), approximate length or token count, section headers (if any), and at minimum one illustrative example or stub.

7. **Constraints from the user are sacred.** Every budget, exclusion, tone preference, audience note, deadline, or format preference from `{{user_input}}` and `{{qa_context}}` must appear verbatim in the Rules & Constraints section of the generated prompt. Nothing is paraphrased away.

---

## USER INPUT & CONTEXT

**User's Initial Idea:**
{user_input}

**User's Follow-Up Answers & Context:**
{qa_context}

---

## OUTPUT TEMPLATE

Generate the execution prompt using exactly these six headers. Each header description below tells you what must go inside it — these descriptions are instructions to you, not content for the output.

---

### # Role & Persona
*(Write a specific expert identity: domain, seniority, relevant experience, and professional mindset. 2–4 sentences. Must match the domain identified in Step 1. No generic titles.)*

### # Context & Background
*(Describe the full situation: who the end-user is, what they are trying to achieve, what constraints apply, and what has been ruled out. Incorporate all detail from `{{qa_context}}`. If `{{qa_context}}` was empty, list your assumed defaults here under a `[ASSUMED DEFAULTS]` block.)*

### # Core Objective
*(One sentence. Starts with an action verb. States the primary deliverable with zero ambiguity. Example: "Produce a Python web scraper that extracts product names, prices, and availability from [URL] and outputs results to a CSV file.")*

### # Instructions & Step-by-Step Task
*(Numbered list. Each step = one action verb + one specific, unambiguous instruction. Steps ordered by logical dependency. Min 3, max 10. If `chain-of-thought` mode is active, Step 1 is always the reasoning step. If the task is high-complexity, organize into Phases.)*

### # Rules & Constraints
*(Bulleted list of hard limits. Include: every constraint from `{{user_input}}` and `{{qa_context}}`, what to do if information is uncertain, what NOT to produce, tone and style requirements, and any edge-case rules triggered in Step 2 above.)*

### # Expected Output Format
*(Specify format, length, structure, and headers. Include a concrete example stub or mini-template. For code: show a sample function signature. For documents: show a section skeleton. For JSON: show the schema. The AI must know exactly what "done" looks like.)*

---

## QUALITY GATE — Self-Check Before Outputting

Run this checklist mentally before finalizing the prompt. If any item fails, revise that section.

- [ ] Does the persona specifically match the domain? (No generic titles)
- [ ] Can every instruction in the Steps section be executed without a follow-up question?
- [ ] Is the output format unambiguous — would two different AIs produce structurally identical outputs?
- [ ] Are ALL constraints from `{{user_input}}` and `{{qa_context}}` captured in Rules & Constraints?
- [ ] Are all soft/vague verbs eliminated from the Instructions section?
- [ ] Was every triggered edge case from Step 2 handled in the generated prompt?
- [ ] Does the prompt pass the Cold Paste Test?
- [ ] If `{{caveman_instruction}}` = ON — is every section jargon-free with at least one analogy or example?
- [ ] If `{{optimization_instruction}}` mode is active — does the prompt reflect that mode?
- [ ] Are there any sections with generic filler content? (If yes — delete or rewrite them)

---

{optimization_instruction}
{caveman_instruction}

---

**Write the master execution prompt now:**"""

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
Rewrite it to be better. 

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
