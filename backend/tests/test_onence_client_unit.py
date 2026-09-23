"""Unit tests for 1NCE client adapter with mocked httpx transport."""
import os
import sys
from pathlib import Path

import pytest
import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.onence_client import OneNCEClient, ProviderError


class FakeResponse:
    def __init__(self, status_code=200, json_body=None, headers=None):
        self.status_code = status_code
        self._json = json_body if json_body is not None else {}
        self.headers = headers or {}

    def json(self):
        return self._json


class FakeAsyncClient:
    def __init__(self, scripted):
        self.scripted = scripted

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, **kwargs):
        return self.scripted["post"](url, **kwargs)

    async def request(self, method, url, **kwargs):
        return self.scripted["request"](method, url, **kwargs)


@pytest.fixture(autouse=True)
def onence_env(monkeypatch):
    monkeypatch.setenv("ONENCE_CLIENT_ID", "client-id")
    monkeypatch.setenv("ONENCE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("ONENCE_API_URL", "https://api.1nce.com/management-api")


@pytest.mark.asyncio
async def test_not_configured_blocks_without_env(monkeypatch):
    monkeypatch.setenv("ONENCE_CLIENT_ID", "")
    client = OneNCEClient()
    assert client.configured is False
    with pytest.raises(ProviderError):
        _ = client.base_url


@pytest.mark.asyncio
async def test_token_uses_basic_auth_and_client_credentials(monkeypatch):
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["auth"] = kwargs.get("auth")
        captured["json"] = kwargs.get("json")
        return FakeResponse(200, {"access_token": "tok-1", "expires_in": 3600})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": lambda method, url, **kwargs: FakeResponse(200, {}),
    }))

    client = OneNCEClient()
    token = await client.token()
    assert token == "tok-1"
    assert captured["url"].endswith("/management-api/oauth/token")
    assert captured["auth"] == ("client-id", "client-secret")
    assert captured["json"] == {"grant_type": "client_credentials"}


@pytest.mark.asyncio
async def test_activate_sim_put_payload_exact(monkeypatch):
    captured = {"calls": []}

    def fake_post(url, **kwargs):
        return FakeResponse(200, {"access_token": "tok-2", "expires_in": 3600})

    def fake_request(method, url, **kwargs):
        captured["calls"].append((method, url, kwargs.get("json")))
        return FakeResponse(200, {})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request,
    }))

    client = OneNCEClient()
    result = await client.activate_sim("123456789012345678")
    assert result["http_status"] == 200
    method, url, body = captured["calls"][-1]
    assert method == "PUT"
    assert url.endswith("/management-api/v1/sims/123456789012345678")
    assert body == {"iccid": "123456789012345678", "status": "Enabled"}


@pytest.mark.asyncio
async def test_send_sms_requires_201_and_valid_location(monkeypatch):
    sent = {}

    def fake_post(url, **kwargs):
        return FakeResponse(200, {"access_token": "tok-3", "expires_in": 3600})

    def fake_request(method, url, **kwargs):
        if method == "POST":
            sent["json"] = kwargs.get("json")
            return FakeResponse(201, {}, headers={"location": "https://api.1nce.com/management-api/v1/sims/123456789012345678/sms/987"})
        return FakeResponse(200, {})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request,
    }))

    client = OneNCEClient()
    result = await client.send_sms("123456789012345678", "8030000 sensor.net")
    assert result["provider_id"] == "987"
    assert sent["json"] == {
        "source_address": "1234",
        "payload": "8030000 sensor.net",
        "dcs": 0,
        "source_address_type": {"id": 145},
    }


@pytest.mark.asyncio
async def test_send_sms_missing_location_marks_uncertain(monkeypatch):
    def fake_post(url, **kwargs):
        return FakeResponse(200, {"access_token": "tok-4", "expires_in": 3600})

    def fake_request(method, url, **kwargs):
        if method == "POST":
            return FakeResponse(201, {}, headers={})
        return FakeResponse(200, {})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request,
    }))

    client = OneNCEClient()
    with pytest.raises(ProviderError) as exc:
        await client.send_sms("123456789012345678", "8030000 sensor.net")
    assert exc.value.uncertain is True


@pytest.mark.asyncio
async def test_get_sim_uses_admin_path_and_accepts_enabled_disabled(monkeypatch):
    captured = {"paths": []}

    def fake_post(url, **kwargs):
        return FakeResponse(200, {"access_token": "tok-5", "expires_in": 3600})

    def fake_request(method, url, **kwargs):
        captured["paths"].append(url)
        return FakeResponse(200, {"iccid": "123", "msisdn": "3538", "status": "Enabled"})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request,
    }))
    client = OneNCEClient()
    first = await client.get_sim("123")
    assert first["status"] == "Enabled"
    assert captured["paths"][-1].endswith("/management-api/v1/sims/123")

    def fake_request_disabled(method, url, **kwargs):
        captured["paths"].append(url)
        return FakeResponse(200, {"iccid": "123", "msisdn": "3538", "status": "Disabled"})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request_disabled,
    }))
    second = await client.get_sim("123")
    assert second["status"] == "Disabled"


@pytest.mark.asyncio
async def test_request_5xx_and_timeout_uncertain_only_for_post_put(monkeypatch):
    def fake_post(url, **kwargs):
        return FakeResponse(200, {"access_token": "tok-6", "expires_in": 3600})

    def fake_request_500(method, url, **kwargs):
        return FakeResponse(500, {})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request_500,
    }))
    client = OneNCEClient()
    with pytest.raises(ProviderError) as post_err:
        await client.request("POST", "/v1/sims/x/sms", json={})
    assert post_err.value.uncertain is True

    with pytest.raises(ProviderError) as get_err:
        await client.request("GET", "/v1/sims/x")
    assert get_err.value.uncertain is False

    class TimeoutClient(FakeAsyncClient):
        async def request(self, method, url, **kwargs):
            raise httpx.ReadTimeout("timeout")

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: TimeoutClient({
        "post": fake_post,
        "request": fake_request_500,
    }))
    with pytest.raises(ProviderError) as put_timeout:
        await client.request("PUT", "/v1/sims/x", json={})
    assert put_timeout.value.uncertain is True


@pytest.mark.asyncio
async def test_request_4xx_is_definitive_not_uncertain(monkeypatch):
    def fake_post(url, **kwargs):
        return FakeResponse(200, {"access_token": "tok-7", "expires_in": 3600})

    def fake_request_404(method, url, **kwargs):
        return FakeResponse(404, {})

    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: FakeAsyncClient({
        "post": fake_post,
        "request": fake_request_404,
    }))
    client = OneNCEClient()
    with pytest.raises(ProviderError) as err:
        await client.request("POST", "/v1/sims/x/sms", json={})
    assert err.value.http_status == 404
    assert err.value.uncertain is False


@pytest.mark.asyncio
async def test_missing_credentials_makes_no_http_calls(monkeypatch):
    calls = {"post": 0, "request": 0}

    class GuardClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            calls["post"] += 1
            raise AssertionError("HTTP should not be called when not configured")

        async def request(self, *args, **kwargs):
            calls["request"] += 1
            raise AssertionError("HTTP should not be called when not configured")

    monkeypatch.setenv("ONENCE_CLIENT_ID", "")
    monkeypatch.setattr("services.onence_client.httpx.AsyncClient", lambda timeout=20: GuardClient())
    client = OneNCEClient()
    with pytest.raises(ProviderError):
        await client.get_sim("123")
    assert calls["post"] == 0
    assert calls["request"] == 0
