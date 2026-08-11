"""INSIDE OUT — Iteration 3: multi-Claude-model selection surface.

Covers:
- GET /api/models (public)
- PATCH /api/auth/preferences (auth, validation)
- GET /api/auth/me reflects preference
- POST /api/analyze with explicit / omitted / invalid model
- POST /api/chat with explicit model (SSE)
- Regression: fresh user with no preference -> defaults to claude-sonnet-4-6

Notes:
- Vision is expensive; single fixture reused; only 3 total /api/analyze calls.
- Persistent user test@insideout.app is reset to claude-sonnet-4-6 at teardown.
"""
import json
import time
import uuid
import pytest
import requests


VALID_MODELS = {
    "claude-sonnet-5",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-7",
}
DEFAULT_MODEL = "claude-sonnet-4-6"


# ---------------- /api/models (public) ----------------
class TestModelsEndpoint:
    def test_models_public_no_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/models")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("default") == DEFAULT_MODEL
        assert isinstance(j.get("models"), list)
        assert len(j["models"]) == 4
        returned_ids = {m["id"] for m in j["models"]}
        assert returned_ids == VALID_MODELS, f"got={returned_ids}"
        # verify required fields on each entry
        for m in j["models"]:
            assert set(m.keys()) >= {"id", "label", "tier", "desc"}, f"missing fields in {m}"
            assert isinstance(m["label"], str) and m["label"]
            assert isinstance(m["tier"], str) and m["tier"]
            assert isinstance(m["desc"], str) and m["desc"]

    def test_models_endpoint_ignores_auth_header(self, api_client, base_url):
        # even with a bogus bearer, should still return 200 (public)
        r = api_client.get(
            f"{base_url}/api/models",
            headers={"Authorization": "Bearer bogus.value"},
        )
        assert r.status_code == 200


# ---------------- Persistent test@insideout.app login ----------------
class TestSeededUserLogin:
    def test_login_seeded_user(self, api_client, base_url):
        email = "test@insideout.app"
        # register attempt (idempotent — may 400 if already exists)
        api_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "Docs Test", "email": email, "password": "testpass123",
                  "experience_level": "Beginner"},
        )
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "testpass123"},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        pytest.seed_token = j["token"]
        pytest.seed_user = j["user"]


# ---------------- PATCH /api/auth/preferences ----------------
class TestPreferences:
    def _auth(self):
        return {"Authorization": f"Bearer {pytest.seed_token}"}

    def test_patch_requires_auth(self, api_client, base_url):
        r = api_client.patch(
            f"{base_url}/api/auth/preferences",
            json={"preferred_model": "claude-haiku-4-5-20251001"},
        )
        assert r.status_code == 401

    def test_patch_invalid_model_400(self, api_client, base_url):
        r = api_client.patch(
            f"{base_url}/api/auth/preferences",
            json={"preferred_model": "gpt-4"},
            headers=self._auth(),
        )
        assert r.status_code == 400, r.text

    def test_patch_valid_model_persists(self, api_client, base_url):
        target = "claude-haiku-4-5-20251001"
        r = api_client.patch(
            f"{base_url}/api/auth/preferences",
            json={"preferred_model": target},
            headers=self._auth(),
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["preferred_model"] == target

        # confirm via /api/auth/me
        r2 = api_client.get(f"{base_url}/api/auth/me", headers=self._auth())
        assert r2.status_code == 200
        me = r2.json()["user"]
        assert me["preferred_model"] == target


# ---------------- POST /api/analyze with model selection ----------------
class TestAnalyzeModel:
    """Uses the seeded user (now with preferred_model = Haiku 4.5)."""

    def _auth(self):
        return {"Authorization": f"Bearer {pytest.seed_token}"}

    def _assert_valid_analysis(self, j):
        assert "project_id" in j and "analysis" in j
        a = j["analysis"]
        assert "object" in a and "name" in a["object"]
        assert isinstance(a.get("components"), list)
        layers = a.get("layers", {})
        for k in ["1_surface", "2_components", "3_connections", "4_physics",
                  "5_electronics", "6_software", "7_system", "8_build"]:
            assert k in layers, f"missing layer {k}"
        assert isinstance(a.get("bom"), list)
        assert "rebuild_challenge" in a

    def _get_project_model_used(self, api_client, base_url, project_id):
        r = api_client.get(f"{base_url}/api/projects/{project_id}", headers=self._auth())
        assert r.status_code == 200, r.text
        return r.json()["project"].get("model_used")

    def test_analyze_explicit_haiku(self, api_client, base_url, test_image_b64):
        payload = {
            "image_base64": test_image_b64,
            "experience_level": "Beginner",
            "model": "claude-haiku-4-5-20251001",
        }
        r = api_client.post(f"{base_url}/api/analyze", json=payload,
                            headers=self._auth(), timeout=180)
        assert r.status_code == 200, r.text[:500]
        j = r.json()
        self._assert_valid_analysis(j)
        pytest.explicit_project_id = j["project_id"]
        used = self._get_project_model_used(api_client, base_url, j["project_id"])
        assert used == "claude-haiku-4-5-20251001", f"model_used={used}"

    def test_analyze_omitted_falls_back_to_preferred(self, api_client, base_url, test_image_b64):
        # user's preferred_model is claude-haiku-4-5-20251001 (set in TestPreferences)
        payload = {"image_base64": test_image_b64, "experience_level": "Beginner"}
        r = api_client.post(f"{base_url}/api/analyze", json=payload,
                            headers=self._auth(), timeout=180)
        assert r.status_code == 200, r.text[:500]
        j = r.json()
        self._assert_valid_analysis(j)
        pytest.omitted_project_id = j["project_id"]
        used = self._get_project_model_used(api_client, base_url, j["project_id"])
        assert used == "claude-haiku-4-5-20251001", f"expected preferred haiku, got {used}"

    def test_analyze_invalid_model_soft_falls_back(self, api_client, base_url, test_image_b64):
        payload = {
            "image_base64": test_image_b64,
            "experience_level": "Beginner",
            "model": "foo",
        }
        r = api_client.post(f"{base_url}/api/analyze", json=payload,
                            headers=self._auth(), timeout=180)
        assert r.status_code == 200, r.text[:500]
        j = r.json()
        self._assert_valid_analysis(j)
        pytest.invalid_project_id = j["project_id"]
        used = self._get_project_model_used(api_client, base_url, j["project_id"])
        assert used != "foo", "invalid model should not be persisted verbatim"
        assert used == "claude-haiku-4-5-20251001", (
            f"expected fallback to preferred (haiku), got {used}"
        )


# ---------------- POST /api/chat with explicit model ----------------
class TestChatModel:
    def _auth(self):
        return {"Authorization": f"Bearer {pytest.seed_token}"}

    def test_chat_stream_with_opus(self, api_client, base_url):
        project_id = pytest.explicit_project_id
        payload = {
            "project_id": project_id,
            "message": "In one short sentence: what is this device?",
            "model": "claude-opus-4-7",
        }
        r = requests.post(
            f"{base_url}/api/chat",
            json=payload,
            headers={**self._auth(), "Content-Type": "application/json"},
            stream=True,
            timeout=180,
        )
        assert r.status_code == 200, r.text[:500]

        got_delta = False
        got_done = False
        deadline = time.time() + 120
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
        assert got_delta or got_done, "no SSE deltas / done event"

        # persistence check
        time.sleep(2)
        r2 = api_client.get(f"{base_url}/api/chat/{project_id}", headers=self._auth())
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles, f"roles={roles}"


# ---------------- Regression: new user, no preferred_model -> default ----------------
class TestFreshUserDefault:
    def test_new_user_no_pref_defaults_to_sonnet_4_6(self, api_client, base_url, test_image_b64):
        email = f"test_iter3_{uuid.uuid4().hex[:8]}@insideout.app"
        rr = api_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "Iter3 Fresh", "email": email, "password": "testpass123",
                  "experience_level": "Beginner"},
        )
        assert rr.status_code == 200, rr.text
        tok = rr.json()["token"]
        # user record should not have preferred_model set
        # (the _user_public serializer defaults to sonnet-4-6, but Mongo doc lacks the field)

        payload = {"image_base64": test_image_b64, "experience_level": "Beginner"}
        r = api_client.post(
            f"{base_url}/api/analyze",
            json=payload,
            headers={"Authorization": f"Bearer {tok}"},
            timeout=180,
        )
        assert r.status_code == 200, r.text[:500]
        pid = r.json()["project_id"]

        # fetch project and confirm model_used
        r2 = api_client.get(
            f"{base_url}/api/projects/{pid}",
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r2.status_code == 200
        used = r2.json()["project"].get("model_used")
        assert used == DEFAULT_MODEL, f"expected default sonnet-4-6, got {used}"


# ---------------- Teardown: reset seeded user's preferred_model ----------------
class TestZZZTeardown:
    """Runs last (alphabetical) — resets seeded user to sonnet-4-6 and cleans projects."""

    def _auth(self):
        return {"Authorization": f"Bearer {pytest.seed_token}"}

    def test_cleanup_reset_pref_and_delete_test_projects(self, api_client, base_url):
        # reset preference
        r = api_client.patch(
            f"{base_url}/api/auth/preferences",
            json={"preferred_model": DEFAULT_MODEL},
            headers=self._auth(),
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["preferred_model"] == DEFAULT_MODEL

        # delete projects created during this run to keep DB tidy
        for pid_attr in ("explicit_project_id", "omitted_project_id", "invalid_project_id"):
            pid = getattr(pytest, pid_attr, None)
            if pid:
                api_client.delete(
                    f"{base_url}/api/projects/{pid}",
                    headers=self._auth(),
                )
