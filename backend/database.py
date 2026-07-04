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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            template_text TEXT NOT NULL,
            icon TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

def seed_templates():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM templates')
    count = cursor.fetchone()[0]
    
    if count == 0:
        import uuid
        templates = [
            # Email Category
            (str(uuid.uuid4()), "Cold Outreach Email", "Email", "Draft a personalized cold email", "I need to write a professional cold outreach email to my team about an upcoming product launch. The tone should be {tone}. Target audience is {audience}.", "mail"),
            (str(uuid.uuid4()), "Newsletter Welcome", "Email", "Create an engaging welcome email", "Write a warm and welcoming email for new subscribers to our weekly newsletter about {topic}. The goal is to make them feel part of the community and set expectations.", "mail"),
            (str(uuid.uuid4()), "Apology Email to Customer", "Email", "Draft a professional apology", "Write a sincere apology email to a customer who experienced {issue}. Offer a solution or compensation in the form of {compensation}. Maintain a professional and empathetic tone.", "mail"),
            
            
            # Blog Category
            (str(uuid.uuid4()), "SEO Article Outline", "Blog", "Create a structured SEO-friendly outline", "I want to write an engaging SEO-optimized blog post about {topic}. Ensure keywords {keywords} are used naturally. Include an introduction, 3 main sections, and a conclusion.", "file-text"),
            (str(uuid.uuid4()), "Listicle Generator", "Blog", "Generate a numbered listicle post", "Write a casual and highly shareable listicle titled 'Top {number} ways to improve {skill}'. Include a short, punchy paragraph for each point.", "file-text"),
            (str(uuid.uuid4()), "Product Review Post", "Blog", "Draft an in-depth product review", "Write a comprehensive blog post reviewing {product_name}. Discuss its pros and cons, target audience, pricing, and give a final verdict. Tone should be honest and informative.", "file-text"),
            
            # Coding Category
            (str(uuid.uuid4()), "Basic REST API", "Coding", "Scaffold a basic REST API using FastAPI", "I need a Python script using FastAPI that sets up a basic REST API with JWT authentication. Include models for {models}.", "code"),
            (str(uuid.uuid4()), "React Component with Tailwind", "Coding", "Create a reusable UI component", "Write a React functional component using TypeScript and Tailwind CSS for a {component_type}. It should accept props for {props} and be fully responsive.", "code"),
            (str(uuid.uuid4()), "SQL Query Optimization", "Coding", "Optimize a slow SQL query", "Review the following SQL query for performance bottlenecks and rewrite it to be more efficient. The database is PostgreSQL. Query: {query}", "code"),

            # SEO Category
            (str(uuid.uuid4()), "Keyword Research Plan", "SEO", "Plan keyword strategy for an e-commerce store", "I need an SEO strategy and keyword research plan for a new e-commerce store selling {product_type}. Focus on the {region} market.", "search"),
            (str(uuid.uuid4()), "Meta Descriptions Builder", "SEO", "Generate catchy meta descriptions", "Write 5 unique, click-worthy meta descriptions (under 160 characters) for a webpage about {page_topic}. Include the primary keyword: {keyword}.", "search"),

            # Image Generation Category
            (str(uuid.uuid4()), "Midjourney Cyberpunk", "Image Generation", "Generate a hyper-realistic cyberpunk city", "I need a Midjourney prompt to generate a hyper-realistic image of a futuristic cyberpunk city at night with neon lights. Focus on {elements}.", "image"),
            (str(uuid.uuid4()), "Anime Style Character", "Image Generation", "Prompt for an anime character portrait", "Create a detailed prompt for generating an anime-style portrait of a character with {hair_color} hair, wearing {clothing_style}, in a {setting} background. Style of Studio Ghibli.", "image"),
            
            # Data Analysis Category
            (str(uuid.uuid4()), "Pandas Data Cleaning", "Data Analysis", "Clean missing values and parse dates", "I need a Python pandas script to clean a dataset containing missing values, parse dates, and generate a summary report. Input columns: {columns}.", "bar-chart"),
            (str(uuid.uuid4()), "Data Visualization with Matplotlib", "Data Analysis", "Generate charts and graphs", "Write a Python script using matplotlib and seaborn to visualize {data_description}. Create a bar chart comparing {x_axis} and {y_axis}, and include a customized title and legend.", "bar-chart")
        ]
        cursor.executemany('''
            INSERT INTO templates (id, name, category, description, template_text, icon)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', templates)
        conn.commit()
    conn.close()

def get_templates(category: str = None, search: str = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = 'SELECT * FROM templates WHERE 1=1'
    params = []
    
    if category:
        query += ' AND category = ?'
        params.append(category)
        
    if search:
        query += ' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)'
        params.extend([f'%{search.lower()}%', f'%{search.lower()}%'])
        
    query += ' ORDER BY created_at DESC'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    templates = [dict(row) for row in rows]
    conn.close()
    return templates

def get_template_by_id(template_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM templates WHERE id = ?', (template_id,))
    row = cursor.fetchone()
    template = dict(row) if row else None
    conn.close()
    return template

def create_template(template_id: str, name: str, category: str, description: str, template_text: str, icon: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO templates (id, name, category, description, template_text, icon)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (template_id, name, category, description, template_text, icon))
    conn.commit()
    conn.close()
    return template_id

def update_template(template_id: str, name: str, category: str, description: str, template_text: str, icon: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE templates SET name=?, category=?, description=?, template_text=?, icon=?
        WHERE id=?
    ''', (name, category, description, template_text, icon, template_id))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def delete_template(template_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM templates WHERE id=?', (template_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

init_db()
seed_templates()
