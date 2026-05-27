def build_prompt(intent, user_input):

    return f"""
Intent: {intent}

User Request:
{user_input}

Generate a professional AI prompt.
"""