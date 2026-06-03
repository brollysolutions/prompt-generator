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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompt_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            source TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS library_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            tags TEXT NOT NULL,
            category TEXT NOT NULL,
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

def save_prompt_version(session_id: str, prompt_text: str, source: str) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO prompt_versions (session_id, prompt_text, source)
        VALUES (?, ?, ?)
    ''', (session_id, prompt_text, source))
    version_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return version_id

def update_prompt_version(version_id: int, prompt_text: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE prompt_versions
        SET prompt_text = ?, source = ?
        WHERE id = ?
    ''', (prompt_text, "edited (history)", version_id))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def delete_prompt_version(version_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM prompt_versions WHERE id = ?', (version_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def delete_version_and_library_entry(version_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Get the prompt text first
    cursor.execute('SELECT prompt_text FROM prompt_versions WHERE id = ?', (version_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    prompt_text = row[0]
    
    # 2. Delete from history
    cursor.execute('DELETE FROM prompt_versions WHERE id = ?', (version_id,))
    
    # 3. Delete from library where text matches
    cursor.execute('DELETE FROM library_prompts WHERE prompt_text = ?', (prompt_text,))
    
    conn.commit()
    conn.close()
    return True

def delete_library_prompt(prompt_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM library_prompts WHERE id = ?', (prompt_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def get_prompt_history():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, session_id, prompt_text, source, created_at
        FROM prompt_versions
        ORDER BY created_at DESC
    ''')
    rows = cursor.fetchall()
    history = [dict(row) for row in rows]
    conn.close()
    return history

def save_library_prompt(name: str, prompt_text: str, tags: list, category: str) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO library_prompts (name, prompt_text, tags, category)
        VALUES (?, ?, ?, ?)
    ''', (name, prompt_text, json.dumps(tags), category))
    prompt_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return prompt_id

def get_library_prompts():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, name, prompt_text, tags, category, created_at
        FROM library_prompts
        ORDER BY created_at DESC
    ''')
    rows = cursor.fetchall()
    prompts = []
    for row in rows:
        d = dict(row)
        try:
            d['tags'] = json.loads(d['tags'])
        except:
            d['tags'] = []
        prompts.append(d)
    conn.close()
    return prompts

init_db()
