"""INSIDE OUT — Backend API smoke + integration tests.
Covers: auth (register/login/me), analyze (Claude vision), projects CRUD, chat (SSE + history), auth isolation.
"""
import json
import time
import uuid
import pytest
import requests


# ---------------- Auth ----------------
class TestAuth:
    """Register, login, /me and negative auth tests."""

    def test_health(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_register_and_duplicate(self, api_client, base_url):
        email = f"test_{uuid.uuid4().hex[:8]}@insideout.app"
        payload = {"name": "TEST User", "email": email, "password": "testpass123",
                   "experience_level": "Beginner"}
        r = api_client.post(f"{base_url}/api/auth/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email
        assert data["user"]["experience_level"] == "Beginner"
        pytest.shared_email = email
        pytest.shared_token = data["token"]
        pytest.shared_user_id = data["user"]["id"]

        # duplicate
        r2 = api_client.post(f"{base_url}/api/auth/register", json=payload)
        assert r2.status_code == 400
        assert "already" in r2.text.lower() or "registered" in r2.text.lower()

    def test_login_valid_and_invalid(self, api_client, base_url):
        # valid
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": pytest.shared_email, "password": "testpass123"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and j["user"]["email"] == pytest.shared_email
        # invalid password
        r2 = api_client.post(f"{base_url}/api/auth/login",
                             json={"email": pytest.shared_email, "password": "WRONG"})
        assert r2.status_code == 401
        # unknown email
        r3 = api_client.post(f"{base_url}/api/auth/login",
                             json={"email": "nobody_zzz@nowhere.io", "password": "x"})
        assert r3.status_code == 401

    def test_me_valid_and_missing_token(self, api_client, base_url):
        # missing
        r0 = api_client.get(f"{base_url}/api/auth/me")
        assert r0.status_code == 401
        # invalid token
        r1 = api_client.get(f"{base_url}/api/auth/me",
                            headers={"Authorization": "Bearer bogus.token.value"})
        assert r1.status_code == 401
        # valid
        r2 = api_client.get(f"{base_url}/api/auth/me",
                            headers={"Authorization": f"Bearer {pytest.shared_token}"})
        assert r2.status_code == 200
        assert r2.json()["user"]["email"] == pytest.shared_email

    def test_credentials_file_user(self, api_client, base_url):
        """test@insideout.app / testpass123 — create if missing, then login."""
        email = "test@insideout.app"
        payload = {"name": "Docs Test", "email": email, "password": "testpass123",
                   "experience_level": "Beginner"}
        api_client.post(f"{base_url}/api/auth/register", json=payload)  # may 400 if exists
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": email, "password": "testpass123"})
        assert r.status_code == 200, r.text


# ---------------- Analyze (Claude vision) ----------------
class TestAnalyze:
    """Vision analysis + persistence."""

    def _auth(self):
        return {"Authorization": f"Bearer {pytest.shared_token}"}

    def test_analyze_creates_project(self, api_client, base_url, test_image_b64):
        payload = {"image_base64": test_image_b64, "experience_level": "Beginner"}
        r = api_client.post(f"{base_url}/api/analyze", json=payload,
                            headers=self._auth(), timeout=120)
        assert r.status_code == 200, r.text[:500]
        j = r.json()
        assert "project_id" in j and "analysis" in j
        analysis = j["analysis"]
        # schema checks
        assert "object" in analysis and "name" in analysis["object"]
        assert "components" in analysis and isinstance(analysis["components"], list)
        layers = analysis.get("layers", {})
        for k in ["1_surface", "2_components", "3_connections", "4_physics",
                  "5_electronics", "6_software", "7_system", "8_build"]:
            assert k in layers, f"Missing layer {k}"
        assert "bom" in analysis and isinstance(analysis["bom"], list)
        assert "rebuild_challenge" in analysis
        assert "cannot_confirm" in analysis
        # confidence labels
        allowed = {"VERIFIED", "INFERRED", "ESTIMATED", "UNKNOWN"}
        assert analysis["object"].get("status") in allowed
        for c in analysis["components"][:5]:
            if "status" in c:
                assert c["status"] in allowed
        pytest.shared_project_id = j["project_id"]

    def test_analyze_requires_auth(self, api_client, base_url, test_image_b64):
        r = api_client.post(f"{base_url}/api/analyze",
                            json={"image_base64": test_image_b64})
        assert r.status_code == 401


# ---------------- Projects ----------------
class TestProjects:
    def _auth(self):
        return {"Authorization": f"Bearer {pytest.shared_token}"}

    def test_list_projects(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/projects", headers=self._auth())
        assert r.status_code == 200
        j = r.json()
        assert "projects" in j and any(p["id"] == pytest.shared_project_id for p in j["projects"])

    def test_get_project_full(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/projects/{pytest.shared_project_id}",
                           headers=self._auth())
        assert r.status_code == 200
        proj = r.json()["project"]
        assert proj["id"] == pytest.shared_project_id
        assert "analysis" in proj
        assert "image_base64" in proj and len(proj["image_base64"]) > 100

    def test_get_project_not_found(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/projects/nonexistent-xyz", headers=self._auth())
        assert r.status_code == 404


# ---------------- Chat (SSE) ----------------
class TestChat:
    def _auth(self):
        return {"Authorization": f"Bearer {pytest.shared_token}"}

    def test_chat_stream_and_persist(self, api_client, base_url):
        payload = {"project_id": pytest.shared_project_id,
                   "message": "In one sentence, what is the main component here?"}
        r = requests.post(f"{base_url}/api/chat", json=payload,
                          headers={**self._auth(), "Content-Type": "application/json"},
                          stream=True, timeout=120)
        assert r.status_code == 200, r.text[:500]
        got_delta = False
        got_done = False
        deadline = time.time() + 90
        for raw in r.iter_lines(decode_unicode=True):
            if time.time() > deadline:
                break
            if not raw or not raw.startswith("data:"):
                continue
            try:
                obj = json.loads(raw[5:].strip())
            except Exception:
                continue
            if "delta" in obj:
                got_delta = True
            if obj.get("done"):
                got_done = True
                break
        r.close()
        assert got_delta or got_done, "No SSE deltas or done event received"

        # wait a tick for DB write
        time.sleep(2)
        r2 = api_client.get(f"{base_url}/api/chat/{pytest.shared_project_id}",
                            headers=self._auth())
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles, f"roles={roles}"


# ---------------- Auth isolation ----------------
class TestAuthIsolation:
    def test_user_b_cannot_access_user_a_project(self, api_client, base_url):
        email = f"userb_{uuid.uuid4().hex[:8]}@insideout.app"
        rr = api_client.post(f"{base_url}/api/auth/register",
                             json={"name": "User B", "email": email, "password": "pw12345678"})
        assert rr.status_code == 200
        tok_b = rr.json()["token"]
        r = api_client.get(f"{base_url}/api/projects/{pytest.shared_project_id}",
                           headers={"Authorization": f"Bearer {tok_b}"})
        assert r.status_code == 404
        rd = api_client.delete(f"{base_url}/api/projects/{pytest.shared_project_id}",
                               headers={"Authorization": f"Bearer {tok_b}"})
        assert rd.status_code == 404


# ---------------- Delete (last) ----------------
class TestDelete:
    def _auth(self):
        return {"Authorization": f"Bearer {pytest.shared_token}"}

    def test_delete_project_cascades_chats(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/projects/{pytest.shared_project_id}",
                              headers=self._auth())
        assert r.status_code == 200 and r.json().get("ok") is True
        # verify gone
        r2 = api_client.get(f"{base_url}/api/projects/{pytest.shared_project_id}",
                            headers=self._auth())
        assert r2.status_code == 404
        # verify chats gone
        r3 = api_client.get(f"{base_url}/api/chat/{pytest.shared_project_id}",
                            headers=self._auth())
        assert r3.status_code == 200
        assert r3.json()["messages"] == []
