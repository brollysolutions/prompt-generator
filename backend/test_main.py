import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import os
import json
from fastapi.testclient import TestClient

# Set testing environment variables before importing app
os.environ["JWT_SECRET"] = "testsecretkeyforjwttokengeneration123456"
os.environ["DB_PATH"] = "test_scores.db"
os.environ["ALLOW_TEMPLATE_MUTATIONS"] = "true"
os.environ["ALLOW_PRO_TOGGLE"] = "true"
# Disable rate limiting so repeated auth/LLM calls across tests don't hit 429.
os.environ["RATE_LIMIT_ENABLED"] = "false"

# Mock the API keys so wrappers don't raise ValueError during import/init
os.environ["GROQ_API_KEY"] = "mock-groq-key-1234567890"
os.environ["GEMINI_API_KEY"] = "mock-gemini-key-1234567890"

from main import app
from database import init_db, get_db

class TestBackendApp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize test database file
        init_db()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Clean up files
        import os
        if os.path.exists("test_scores.db"):
            try:
                os.remove("test_scores.db")
            except Exception as e:
                print(f"Failed to delete test db: {e}")
        if os.path.exists("test_scores.db-wal"):
            try:
                os.remove("test_scores.db-wal")
            except:
                pass
        if os.path.exists("test_scores.db-shm"):
            try:
                os.remove("test_scores.db-shm")
            except:
                pass

    def setUp(self):
        # Clean up tables between tests to keep state isolated
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users")
            cursor.execute("DELETE FROM prompt_versions")
            cursor.execute("DELETE FROM library_prompts")
            cursor.execute("DELETE FROM community_prompts")
            cursor.execute("DELETE FROM community_upvotes")
            cursor.execute("DELETE FROM prompt_usage_events")
            cursor.execute("DELETE FROM shared_prompts")
            conn.commit()

    def test_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Smart Prompt Generator API Running", response.json()["message"])

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_signup_and_login(self):
        # 1. Signup
        signup_data = {"email": "test@example.com", "password": "securepassword123"}
        response = self.client.post("/signup", json=signup_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["email"], "test@example.com")
        
        # 2. Duplicate Signup should fail
        response = self.client.post("/signup", json=signup_data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Email already registered", response.json()["detail"])

        # 3. Login with correct password
        login_data = {"email": "test@example.com", "password": "securepassword123"}
        response = self.client.post("/login", json=login_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)

        # 4. Login with incorrect password should fail
        login_data["password"] = "wrongpassword"
        response = self.client.post("/login", json=login_data)
        self.assertEqual(response.status_code, 401)

    def test_me_endpoint(self):
        # Signup to create user
        signup_data = {"email": "me@example.com", "password": "securepassword123"}
        res = self.client.post("/signup", json=signup_data)
        token = res.json()["access_token"]

        # Access /me with token
        headers = {"Authorization": f"Bearer {token}"}
        response = self.client.get("/me", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "me@example.com")

        # Access /me without token should fail
        response = self.client.get("/me")
        self.assertEqual(response.status_code, 401)

    @patch("services.groq_service.get_client")
    def test_generate_questions(self, mock_get_groq):
        # Mock Groq client and response (main.py's generate_questions endpoint routes to groq_service)
        mock_choice = MagicMock()
        mock_choice.message.content = '{"questions": [{"question": "What is the tech stack?", "type": "checkbox", "options": ["React", "Vue"]}]}'
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_groq.return_value = mock_client

        response = self.client.post("/generate-questions", json={"user_input": "I want to build a website"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["questions"]), 1)
        self.assertEqual(data["questions"][0]["question"], "What is the tech stack?")

    @patch("services.gemini_service.get_client")
    @patch("services.groq_service.get_client")
    def test_generate_final_prompt_english(self, mock_get_groq, mock_get_gemini):
        # Mock Gemini response (English routes to Gemini)
        mock_gemini_res = MagicMock()
        mock_gemini_res.text = json.dumps({
            "title": "My Great Prompt",
            "summary": "This is a summary",
            "smart_prompt": "# Context & Goal\nDo something.",
            "quality_score": 85,
            "quality_breakdown": {
                "Persona & Role": 17,
                "Task Clarity & Logic": 17,
                "Context & Knowledge": 17,
                "Guardrails & Safety": 17,
                "Structure & Formatting": 17
            },
            "quality_feedback": ["Good job"]
        })
        mock_client_gemini = MagicMock()
        mock_client_gemini.aio.models.generate_content = AsyncMock(return_value=mock_gemini_res)
        mock_get_gemini.return_value = mock_client_gemini
        
        # Mock Groq auto categorization response (auto_categorize_prompt uses Groq)
        mock_groq_res = MagicMock()
        mock_groq_choice = MagicMock()
        mock_groq_choice.message.content = json.dumps({
            "name": "Test Category",
            "category": "Development",
            "tags": ["code"]
        })
        mock_groq_res.choices = [mock_groq_choice]
        mock_client_groq = MagicMock()
        mock_client_groq.chat.completions.create = AsyncMock(return_value=mock_groq_res)
        mock_get_groq.return_value = mock_client_groq

        req_payload = {
            "user_input": "Develop a React App",
            "answers": {"0": "React"},
            "questions": [{"question": "What framework?"}],
            "target_ai": "Claude"
        }
        
        response = self.client.post("/generate-final-prompt", json=req_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["title"], "My Great Prompt")
        self.assertEqual(data["score"], 85)

    @patch("services.groq_service.get_client")
    def test_generate_final_prompt_regional(self, mock_get_groq):
        # Mock Groq response (Hinglish routes to Groq)
        mock_choice_prompt = MagicMock()
        mock_choice_prompt.message.content = json.dumps({
            "title": "Hinglish Prompt",
            "summary": "Hinglish summary",
            "smart_prompt": "# Context & Goal\nYeh prompt hai.",
            "quality_score": 75,
            "quality_breakdown": {
                "Persona & Role": 15,
                "Task Clarity & Logic": 15,
                "Context & Knowledge": 15,
                "Guardrails & Safety": 15,
                "Structure & Formatting": 15
            },
            "quality_feedback": ["Regional support OK"]
        })
        # Auto categorize is also called and uses Groq
        mock_choice_cat = MagicMock()
        mock_choice_cat.message.content = json.dumps({
            "name": "Hinglish Test",
            "category": "General",
            "tags": []
        })
        mock_response = MagicMock()
        mock_response.choices = [mock_choice_prompt]
        
        mock_client_groq = MagicMock()
        # Side effect to handle multiple calls in order: 1. groq_generate_final_prompt, 2. auto_categorize_prompt
        res_prompt = MagicMock()
        res_prompt.choices = [mock_choice_prompt]
        res_cat = MagicMock()
        res_cat.choices = [mock_choice_cat]
        mock_client_groq.chat.completions.create = AsyncMock(side_effect=[res_prompt, res_cat])
        mock_get_groq.return_value = mock_client_groq

        req_payload = {
            "user_input": "mujhe ek website banana hai", # Hinglish triggers regional
            "answers": {"0": "Hinglish"},
            "questions": [{"question": "Language?"}],
            "target_ai": "Llama"
        }
        
        response = self.client.post("/generate-final-prompt", json=req_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["title"], "Hinglish Prompt")
        self.assertEqual(data["score"], 75)

    @patch("services.groq_service.get_client")
    def test_score_prompt(self, mock_get_groq):
        # Mock Groq client and response
        # process_prompt_scoring does: 1. score_prompt_step1, 2. rewrite_prompt_step2
        mock_choice_score = MagicMock()
        mock_choice_score.message.content = json.dumps({
            "criteria": {
                "Persona & Role": 15,
                "Task Clarity & Logic": 14,
                "Context & Knowledge": 16,
                "Guardrails & Safety": 15,
                "Structure & Formatting": 15
            },
            "suggestions": ["Add more rules"]
        })
        mock_choice_rewrite = MagicMock()
        mock_choice_rewrite.message.content = "This is the rewritten prompt."
        
        res_score = MagicMock()
        res_score.choices = [mock_choice_score]
        res_rewrite = MagicMock()
        res_rewrite.choices = [mock_choice_rewrite]
        
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=[res_score, res_rewrite])
        mock_get_groq.return_value = mock_client

        response = self.client.post("/score-prompt", json={"prompt": "Write a story."})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["score"], 75)
        self.assertEqual(data["rewritten_prompt"], "This is the rewritten prompt.")

    @patch("services.groq_service.get_client")
    def test_enhance_prompt(self, mock_get_groq):
        mock_choice = MagicMock()
        mock_choice.message.content = "Enhanced prompt contents."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_groq.return_value = mock_client

        response = self.client.post("/enhance-prompt", json={"prompt": "Write a story.", "instruction": "Make it funny"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["enhanced_prompt"], "Enhanced prompt contents.")

    @patch("services.gemini_service.get_client")
    def test_test_prompt_english_routes_to_gemini(self, mock_get_gemini):
        # English prompts route to Gemini for the test-prompt demonstration.
        mock_res = MagicMock()
        mock_res.text = "AI outputs demonstration."
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_res)
        mock_get_gemini.return_value = mock_client

        response = self.client.post("/test-prompt", json={"prompt": "Write a story."})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["response"], "AI outputs demonstration.")

    @patch("services.groq_service.get_client")
    def test_test_prompt_regional_routes_to_groq(self, mock_get_groq):
        # Regional (Hinglish/Teluglish) prompts route to Groq.
        mock_choice = MagicMock()
        mock_choice.message.content = "Groq demonstration output."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_groq.return_value = mock_client

        response = self.client.post("/test-prompt", json={"prompt": "Mujhe ek kahani likhkar do."})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["response"], "Groq demonstration output.")

    def test_history_crud(self):
        # 1. Auth Setup
        res = self.client.post("/signup", json={"email": "history@example.com", "password": "password123"})
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create version
        payload = {
            "session_id": "session_xyz",
            "prompt_text": "First prompt version",
            "source": "generator",
            "user_id": 0
        }
        res_create = self.client.post("/history", json=payload, headers=headers)
        self.assertEqual(res_create.status_code, 200)
        version_id = res_create.json()["id"]

        # 3. Read history
        res_read = self.client.get(f"/history?session_id=session_xyz", headers=headers)
        self.assertEqual(res_read.status_code, 200)
        history = res_read.json()["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["prompt_text"], "First prompt version")

        # 4. Update history (requires auto_categorize_prompt mock)
        update_payload = {
            "prompt_text": "Updated prompt version text",
            "user_id": 0
        }
        with patch("services.groq_service.get_client") as mock_get_groq:
            mock_choice = MagicMock()
            mock_choice.message.content = '{"name": "Updated", "category": "General", "tags": []}'
            mock_res = MagicMock()
            mock_res.choices = [mock_choice]
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_res)
            mock_get_groq.return_value = mock_client
            
            res_update = self.client.put(f"/history/{version_id}", json=update_payload, headers=headers)
            self.assertEqual(res_update.status_code, 200)

        # 5. Delete version
        res_delete = self.client.delete(f"/history/{version_id}", headers=headers)
        self.assertEqual(res_delete.status_code, 200)

        # 6. Read after delete
        res_read_after = self.client.get(f"/history?session_id=session_xyz", headers=headers)
        self.assertEqual(len(res_read_after.json()["history"]), 0)

    def test_library_endpoints(self):
        res_auth = self.client.post("/signup", json={"email": "lib@example.com", "password": "password123"})
        token = res_auth.json()["access_token"]
        user_id = res_auth.json()["user_id"]
        headers = {"Authorization": f"Bearer {token}"}

        # Seed custom library item manually via db module to test GET/DELETE
        from database import save_library_prompt
        prompt_id = save_library_prompt("Test Lib Prompt", "Text content here", ["test", "tag"], "Custom", user_id)

        # List library prompts
        res_list = self.client.get("/library", headers=headers)
        self.assertEqual(res_list.status_code, 200)
        prompts = res_list.json()["prompts"]
        self.assertEqual(len(prompts), 1)
        self.assertEqual(prompts[0]["name"], "Test Lib Prompt")

        # Delete prompt
        res_del = self.client.delete(f"/library/{prompt_id}", headers=headers)
        self.assertEqual(res_del.status_code, 200)

    def test_templates_endpoints(self):
        # 1. Get templates (public read)
        response = self.client.get("/api/templates")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json()) > 0) # seeded templates should load

        template_data = {
            "name": "New Test Template",
            "category": "Coding",
            "description": "Scaffold something",
            "template_text": "Write a {model} scaffold.",
            "icon": "code"
        }

        # 2. Mutations require authentication -> 401 without a token
        res_unauth = self.client.post("/api/templates", json=template_data)
        self.assertEqual(res_unauth.status_code, 401)

        # Authenticate for the mutation calls
        res_auth = self.client.post("/signup", json={"email": "tmpl@example.com", "password": "password123"})
        token = res_auth.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create template (authenticated)
        res_create = self.client.post("/api/templates", json=template_data, headers=headers)
        self.assertEqual(res_create.status_code, 200)
        template_id = res_create.json()["id"]

        # 4. Get single template (public read)
        res_single = self.client.get(f"/api/templates/{template_id}")
        self.assertEqual(res_single.status_code, 200)
        self.assertEqual(res_single.json()["name"], "New Test Template")

        # 5. Update template (authenticated)
        template_data["name"] = "Updated Test Template"
        res_update = self.client.put(f"/api/templates/{template_id}", json=template_data, headers=headers)
        self.assertEqual(res_update.status_code, 200)

        # 6. Delete template (authenticated)
        res_delete = self.client.delete(f"/api/templates/{template_id}", headers=headers)
        self.assertEqual(res_delete.status_code, 200)

    def test_analytics_and_pro_toggle(self):
        res_auth = self.client.post("/signup", json={"email": "pro@example.com", "password": "password123"})
        token = res_auth.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Toggle PRO status
        res_toggle = self.client.post("/api/user/toggle-pro", headers=headers)
        self.assertEqual(res_toggle.status_code, 200)

        # 2. Access analytics overview (now user is pro)
        res_overview = self.client.get("/api/analytics/overview", headers=headers)
        self.assertEqual(res_overview.status_code, 200)
        self.assertIn("total_prompts", res_overview.json())

    def test_sharing_endpoints(self):
        res_auth = self.client.post("/signup", json={"email": "share@example.com", "password": "password123"})
        token = res_auth.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Share prompt
        share_payload = {
            "prompt_text": "This prompt is shared.",
            "quality_score": 90,
            "category": "Education",
            "language": "English",
            "visibility": "public"
        }
        res_share = self.client.post("/api/prompts/share", json=share_payload, headers=headers)
        self.assertEqual(res_share.status_code, 200)
        share_token = res_share.json()["share_token"]

        # 2. Get shared prompt
        res_get_share = self.client.get(f"/api/share/{share_token}")
        self.assertEqual(res_get_share.status_code, 200)
        self.assertEqual(res_get_share.json()["prompt_text"], "This prompt is shared.")

        # 3. Save shared prompt to library
        res_save = self.client.post(f"/api/share/{share_token}/save", headers=headers)
        self.assertEqual(res_save.status_code, 200)

        # 4. List user shares
        res_shares_list = self.client.get("/api/prompts/shares", headers=headers)
        self.assertEqual(res_shares_list.status_code, 200)
        self.assertEqual(len(res_shares_list.json()["shares"]), 1)

        # 5. Revoke share
        res_revoke = self.client.delete(f"/api/share/{share_token}", headers=headers)
        self.assertEqual(res_revoke.status_code, 200)

    def test_community_report_requires_auth(self):
        # Unauthenticated report is rejected
        res_unauth = self.client.post("/community/report/1")
        self.assertEqual(res_unauth.status_code, 401)

        # Authenticated report succeeds
        res_auth = self.client.post("/signup", json={"email": "reporter@example.com", "password": "password123"})
        token = res_auth.json()["access_token"]
        res_ok = self.client.post("/community/report/1", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_ok.status_code, 200)

    def test_library_dedup(self):
        from database import save_library_prompt, get_library_prompts
        uid = 4242
        id1 = save_library_prompt("Name A", "IDENTICAL PROMPT", ["t"], "Cat", uid)
        id2 = save_library_prompt("Name B", "IDENTICAL PROMPT", ["t"], "Cat", uid)
        id3 = save_library_prompt("Name C", "DIFFERENT PROMPT", ["t"], "Cat", uid)
        # Same text -> same row returned (no duplicate); different text -> new row
        self.assertEqual(id1, id2)
        self.assertNotEqual(id1, id3)
        self.assertEqual(len(get_library_prompts(uid)), 2)

if __name__ == "__main__":
    unittest.main()
