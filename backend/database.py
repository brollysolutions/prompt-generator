import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "prompt_scores.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompt_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_prompt TEXT NOT NULL,
            final_score INTEGER NOT NULL,
            criteria_json TEXT NOT NULL,
            suggestions_json TEXT NOT NULL,
            rewritten_prompt TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_prompt_score(original_prompt: str, final_score: int, criteria: dict, suggestions: list, rewritten_prompt: str) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO prompt_scores (
            original_prompt, final_score, criteria_json, suggestions_json, rewritten_prompt
        ) VALUES (?, ?, ?, ?, ?)
    ''', (
        original_prompt,
        final_score,
        json.dumps(criteria),
        json.dumps(suggestions),
        rewritten_prompt
    ))
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

init_db()
