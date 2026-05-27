def detect_intent(user_input: str):

    text = user_input.lower()

    coding_words = ["code", "python", "java", "api", "backend", "frontend"]
    writing_words = ["blog", "article", "write", "story"]
    design_words = ["ui", "design", "poster", "figma"]
    analysis_words = ["analyse", "analyze", "report", "research"]

    if any(word in text for word in coding_words):
        return "code"

    elif any(word in text for word in writing_words):
        return "write"

    elif any(word in text for word in design_words):
        return "design"

    elif any(word in text for word in analysis_words):
        return "analyse"

    return "general"