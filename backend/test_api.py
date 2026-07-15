import asyncio
import os
from dotenv import load_dotenv

# Load env variables from backend directory
load_dotenv(dotenv_path="c:/Users/tejak/Downloads/prompt-generator-main (1)/prompt-generator-main/backend/.env", override=True)

import sys
sys.path.append("c:/Users/tejak/Downloads/prompt-generator-main (1)/prompt-generator-main/backend")

from services.gemini_service import generate_final_prompt as gemini_gen

async def main():
    user_input = "Write a sincere apology email to a customer who experienced Transcation issue."
    answers = {
        0: "Creative Content",
        1: "Small Business Owners",
        2: "Concise Outputs"
    }
    print("Testing Gemini generate_final_prompt...")
    result = await gemini_gen(
        user_input=user_input,
        answers=answers,
        questions=[]
    )
    
    if "Generated Prompt (Fallback)" in result.get("title", ""):
        print("FAILED: Triggered fallback!")
    else:
        print("SUCCESS!")
        print(result.keys())

if __name__ == "__main__":
    asyncio.run(main())
