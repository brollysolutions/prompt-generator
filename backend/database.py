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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS community_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            tags TEXT NOT NULL,
            category TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            author_email TEXT NOT NULL,
            upvotes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS community_upvotes (
            user_id INTEGER NOT NULL,
            prompt_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, prompt_id)
        )
    ''')
    
    # Migration: Add user_id to library_prompts if it doesn't exist
    try:
        cursor.execute("ALTER TABLE library_prompts ADD COLUMN user_id INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass # Column already exists
        
    conn.commit()
    conn.close()

def create_user(email: str, hashed_password: str) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO users (email, hashed_password)
            VALUES (?, ?)
        ''', (email, hashed_password))
        user_id = cursor.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        user_id = -1
    finally:
        conn.close()
    return user_id

def get_user_by_email(email: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    user = dict(row) if row else None
    conn.close()
    return user

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
    
    # 1. Get the prompt text and source first
    cursor.execute('SELECT prompt_text, source FROM prompt_versions WHERE id = ?', (version_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    prompt_text, source = row[0], row[1]
    
    # 2. Delete from history
    cursor.execute('DELETE FROM prompt_versions WHERE id = ?', (version_id,))
    
    # 3. Delete from library where text matches, but only if it's not a restored version
    if source != 'restored':
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

def get_prompt_history(session_id: str = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if session_id:
        cursor.execute('''
            SELECT id, session_id, prompt_text, source, created_at
            FROM prompt_versions
            WHERE session_id = ?
            ORDER BY created_at DESC
        ''', (session_id,))
    else:
        cursor.execute('''
            SELECT id, session_id, prompt_text, source, created_at
            FROM prompt_versions
            ORDER BY created_at DESC
        ''')
    rows = cursor.fetchall()
    history = [dict(row) for row in rows]
    conn.close()
    return history

def save_library_prompt(name: str, prompt_text: str, tags: list, category: str, user_id: int = 0) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO library_prompts (name, prompt_text, tags, category, user_id)
        VALUES (?, ?, ?, ?, ?)
    ''', (name, prompt_text, json.dumps(tags), category, user_id))
    prompt_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return prompt_id

def get_library_prompts(user_id: int = 0):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('''
        SELECT l.id, l.name, l.prompt_text, l.tags, l.category, l.created_at, l.user_id,
               EXISTS(SELECT 1 FROM community_prompts c WHERE c.author_id = l.user_id AND c.prompt_text = l.prompt_text) as is_published
        FROM library_prompts l
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
    ''', (user_id,))
    rows = cursor.fetchall()
    prompts = []
    for row in rows:
        d = dict(row)
        try:
            d['tags'] = json.loads(d['tags'])
        except:
            d['tags'] = []
        d['is_published'] = bool(d.get('is_published', 0))
        prompts.append(d)
    conn.close()
    return prompts

def publish_to_community(library_prompt_id: int, author_id: int, author_email: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if prompt exists in library
    cursor.execute('SELECT name, prompt_text, tags, category FROM library_prompts WHERE id = ?', (library_prompt_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
        
    name, prompt_text, tags, category = row
    
    # Check if this user already published this exact prompt text to the community
    cursor.execute('SELECT id FROM community_prompts WHERE author_id = ? AND prompt_text = ?', (author_id, prompt_text))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return {"id": existing[0], "already_published": True}
        
    cursor.execute('''
        INSERT INTO community_prompts (name, prompt_text, tags, category, author_id, author_email, upvotes)
        VALUES (?, ?, ?, ?, ?, ?, 0)
    ''', (name, prompt_text, tags, category, author_id, author_email))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, "already_published": False}

def get_community_prompts(user_id: int = 0, sort_by: str = "trending"):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    order_by_clause = "c.upvotes DESC, c.created_at DESC" if sort_by == "trending" else "c.created_at DESC"
    
    cursor.execute(f'''
        SELECT c.id, c.name, c.prompt_text, c.tags, c.category, c.author_email, c.upvotes, c.created_at,
               (SELECT 1 FROM community_upvotes u WHERE u.prompt_id = c.id AND u.user_id = ?) as has_upvoted
        FROM community_prompts c
        ORDER BY {order_by_clause}
    ''', (user_id,))
    
    rows = cursor.fetchall()
    prompts = []
    for row in rows:
        d = dict(row)
        try:
            d['tags'] = json.loads(d['tags'])
        except:
            d['tags'] = []
        d['has_upvoted'] = bool(d['has_upvoted'])
        prompts.append(d)
    conn.close()
    return prompts

def upvote_community_prompt(user_id: int, prompt_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if already upvoted
    cursor.execute('SELECT 1 FROM community_upvotes WHERE user_id = ? AND prompt_id = ?', (user_id, prompt_id))
    has_upvoted = cursor.fetchone()
    
    if has_upvoted:
        # Remove upvote
        cursor.execute('DELETE FROM community_upvotes WHERE user_id = ? AND prompt_id = ?', (user_id, prompt_id))
        cursor.execute('UPDATE community_prompts SET upvotes = MAX(0, upvotes - 1) WHERE id = ?', (prompt_id,))
        upvoted = False
    else:
        # Add upvote
        cursor.execute('INSERT INTO community_upvotes (user_id, prompt_id) VALUES (?, ?)', (user_id, prompt_id))
        cursor.execute('UPDATE community_prompts SET upvotes = upvotes + 1 WHERE id = ?', (prompt_id,))
        upvoted = True
        
    # Get updated upvotes count
    cursor.execute('SELECT upvotes FROM community_prompts WHERE id = ?', (prompt_id,))
    row = cursor.fetchone()
    new_upvotes = row[0] if row else 0
    
    conn.commit()
    conn.close()
    return {"upvoted": upvoted, "upvotes": new_upvotes}

def save_community_prompt_to_library(user_id: int, community_prompt_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT name, prompt_text, tags, category FROM community_prompts WHERE id = ?', (community_prompt_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
        
    name, prompt_text, tags, category = row
    
    # Save it to user's library using existing JSON tags string
    cursor.execute('''
        INSERT INTO library_prompts (name, prompt_text, tags, category, user_id)
        VALUES (?, ?, ?, ?, ?)
    ''', (name + " (Remix)", prompt_text, tags, category, user_id))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

init_db()
