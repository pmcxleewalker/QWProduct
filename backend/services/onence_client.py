"""Backend-only 1NCE v1 adapter. No simulated provider or credential persistence."""
import asyncio
import os
import time
from urllib.parse import urlparse

import httpx


NOT_CONFIGURED = "1NCE integration not configured"


class ProviderError(Exception):
    def __init__(self, message, uncertain=False, http_status=None):
        super().__init__(message)
        self.uncertain = uncertain
        self.http_status = http_status


class OneNCEClient:
    def __init__(self):
        self._token = None
        self._expires = 0
        self._token_lock = asyncio.Lock()

    @property
    def configured(self):
        values = [os.environ.get(k, "").strip() for k in (
            "ONENCE_CLIENT_ID", "ONENCE_CLIENT_SECRET", "ONENCE_API_URL")]
        url = urlparse(values[2])
        return bool(all(values) and url.scheme == "https" and url.netloc
                    and not url.username and not url.password and not url.query and not url.fragment)

    @property
    def base_url(self):
        if not self.configured:
            raise ProviderError(NOT_CONFIGURED)
        return os.environ["ONENCE_API_URL"].strip().rstrip("/")

    async def token(self):
        async with self._token_lock:
            if self._token and time.monotonic() < self._expires:
                return self._token
            try:
                async with httpx.AsyncClient(timeout=20) as client:
                    response = await client.post(
                        self.base_url + "/oauth/token",
                        auth=(os.environ["ONENCE_CLIENT_ID"], os.environ["ONENCE_CLIENT_SECRET"]),
                        json={"grant_type": "client_credentials"})
                if response.status_code != 200:
                    raise ProviderError("1NCE authentication failed", http_status=response.status_code)
                body = response.json()
                self._token = body["access_token"]
                self._expires = time.monotonic() + max(0, int(body["expires_in"]) - 60)
                return self._token
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                raise ProviderError("Could not authenticate with 1NCE") from None

    async def request(self, method, path, **kwargs):
        token = await self.token()  # Auth failures never imply an uncertain SMS send.
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.request(method, self.base_url + path, headers={
                    "Authorization": f"Bearer {token}", "Accept": "application/json"}, **kwargs)
        except httpx.HTTPError:
            raise ProviderError("1NCE request outcome could not be confirmed",
                                uncertain=method in {"POST", "PUT"}) from None
        if response.status_code >= 400:
            if response.status_code == 401:
                self._token = None
            raise ProviderError(f"1NCE request failed (HTTP {response.status_code})",
                                uncertain=method in {"POST", "PUT"} and response.status_code >= 500,
                                http_status=response.status_code)
        return response

    @staticmethod
    def json_body(response):
        try:
            return response.json()
        except ValueError:
            raise ProviderError("Unexpected 1NCE response") from None

    async def get_sim(self, iccid):
        body = self.json_body(await self.request("GET", f"/v1/sims/{iccid}"))
        if not isinstance(body, dict) or body.get("status") not in {"Enabled", "Disabled"}:
            raise ProviderError("1NCE returned an unrecognised SIM activation state")
        return {key: body.get(key) for key in ("iccid", "msisdn", "status")}

    async def activate_sim(self, iccid):
        response = await self.request("PUT", f"/v1/sims/{iccid}",
                                      json={"iccid": iccid, "status": "Enabled"})
        return {"http_status": response.status_code}

    async def send_sms(self, iccid, payload):
        response = await self.request("POST", f"/v1/sims/{iccid}/sms", json={
            "source_address": "1234", "payload": payload, "dcs": 0,
            "source_address_type": {"id": 145}})
        location = urlparse(response.headers.get("location", ""))
        parts = location.path.rstrip("/").split("/")
        expected = ["v1", "sims", iccid, "sms"]
        if (response.status_code != 201 or len(parts) < 5 or parts[-5:-1] != expected
                or not parts[-1].isdigit()
                or (location.netloc and location.netloc != urlparse(self.base_url).netloc)):
            raise ProviderError("SMS accepted without a verifiable message ID; reconciliation required",
                                uncertain=True, http_status=response.status_code)
        return {"provider_id": parts[-1], "http_status": response.status_code}

    async def sms_detail(self, iccid, message_id):
        return self.json_body(await self.request("GET", f"/v1/sims/{iccid}/sms/{message_id}"))

    async def sms_list(self, iccid, page):
        body = self.json_body(await self.request("GET", f"/v1/sims/{iccid}/sms",
                                                params={"page": page, "pageSize": 100}))
        if not isinstance(body, list):
            raise ProviderError("Unexpected 1NCE SMS list response")
        return body