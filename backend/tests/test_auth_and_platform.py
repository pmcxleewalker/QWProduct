"""
Test Suite for Quick Wing Multi-Tenant Platform
Tests: Authentication, Super Admin login, Platform Admin features, Tenant-specific login
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"
MASTER_ADMIN_EMAIL = "admin.kerry-fleet@quickwing.com"
MASTER_ADMIN_PASSWORD = "Admin123"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_root_accessible(self):
        """Test that API root is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root accessible: {data['message']}")


class TestSuperAdminLogin:
    """Test Super Admin authentication and role verification"""
    
    def test_super_admin_login_success(self):
        """Test Super Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got {data['user']['role']}"
        print(f"✓ Super Admin login successful, role: {data['user']['role']}")
        return data["access_token"]
    
    def test_super_admin_login_returns_correct_role(self):
        """Verify /api/auth/login returns correct user.role for super_admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify role is super_admin
        assert data["user"]["role"] == "super_admin"
        print(f"✓ API returns correct role: super_admin")
    
    def test_super_admin_invalid_password(self):
        """Test Super Admin login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": "WrongPassword123"
        })
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")


class TestMasterAdminLogin:
    """Test Master Admin (tenant owner) authentication"""
    
    def test_master_admin_login_success(self):
        """Test Master Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == MASTER_ADMIN_EMAIL
        # Master admin should have master_admin role
        assert data["user"]["role"] in ["master_admin", "admin"], f"Unexpected role: {data['user']['role']}"
        print(f"✓ Master Admin login successful, role: {data['user']['role']}")
        
        # Should have tenant memberships
        assert "tenants" in data
        print(f"✓ Master Admin has {len(data['tenants'])} tenant membership(s)")
        return data["access_token"]


class TestPlatformAdminEndpoints:
    """Test Platform Admin (Super/Master Admin) endpoints"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super Admin login failed")
        return response.json()["access_token"]
    
    def test_platform_tenants_requires_auth(self):
        """Test /api/platform/tenants requires authentication"""
        response = requests.get(f"{BASE_URL}/api/platform/tenants")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Platform tenants endpoint requires authentication")
    
    def test_platform_tenants_list(self, super_admin_token):
        """Test Super Admin can list all tenants"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "tenants" in data
        assert "total" in data
        assert isinstance(data["tenants"], list)
        print(f"✓ Listed {data['total']} tenants")
        
        # Verify tenant structure
        if data["tenants"]:
            tenant = data["tenants"][0]
            assert "id" in tenant
            assert "name" in tenant
            assert "slug" in tenant
            assert "status" in tenant
            print(f"✓ Tenant structure verified: {tenant['name']}")
    
    def test_platform_stats(self, super_admin_token):
        """Test Super Admin can get platform stats"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/stats", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "tenants" in data
        assert "users" in data
        assert "vehicles" in data
        assert "bookings" in data
        print(f"✓ Platform stats: {data['tenants']['total']} tenants, {data['users']} users")
    
    def test_platform_audit_log(self, super_admin_token):
        """Test Super Admin can access audit log"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/audit-log", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        print(f"✓ Audit log accessible, {len(data['events'])} events")


class TestTenantLookup:
    """Test public tenant lookup by slug"""
    
    def test_tenant_by_slug_kerry_fleet(self):
        """Test looking up Kerry Fleet Services by slug"""
        response = requests.get(f"{BASE_URL}/api/tenants/by-slug/kerry-fleet-services")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "slug" in data
        assert data["slug"] == "kerry-fleet-services"
        print(f"✓ Found tenant: {data['name']}")
    
    def test_tenant_by_slug_not_found(self):
        """Test 404 for non-existent tenant slug"""
        response = requests.get(f"{BASE_URL}/api/tenants/by-slug/non-existent-tenant")
        assert response.status_code == 404
        print("✓ Non-existent tenant returns 404")


class TestReportsAndBilling:
    """Test Reports & Billing tab functionality"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super Admin login failed")
        return response.json()["access_token"]
    
    def test_executive_summary_report(self, super_admin_token):
        """Test Executive Summary report endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/reports/executive-summary", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "tenants" in data["summary"]
        assert "users" in data["summary"]
        assert "revenue" in data["summary"]
        print(f"✓ Executive summary: {data['summary']['tenants']['total']} tenants")
    
    def test_executive_summary_pdf_export(self, super_admin_token):
        """Test PDF export for Executive Summary"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/reports/executive-summary/pdf", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        
        # Verify PDF magic bytes
        content = response.content
        assert content[:4] == b'%PDF', "Response is not a valid PDF"
        print(f"✓ Executive Summary PDF exported ({len(content)} bytes)")
    
    def test_franchises_report(self, super_admin_token):
        """Test Franchises report endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/reports/franchises", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "franchises" in data
        assert "total" in data
        print(f"✓ Franchises report: {data['total']} franchises")
    
    def test_franchises_report_pdf_export(self, super_admin_token):
        """Test PDF export for Franchises report"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/reports/franchises/pdf", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        print("✓ Franchises Report PDF exported")
    
    def test_invoices_list(self, super_admin_token):
        """Test Invoices list endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/invoices", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "invoices" in data
        assert "total" in data
        assert "summary" in data
        print(f"✓ Invoices list: {data['total']} invoices")


class TestTenantCreation:
    """Test tenant creation functionality"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super Admin login failed")
        return response.json()["access_token"]
    
    def test_create_tenant_success(self, super_admin_token):
        """Test creating a new tenant"""
        import uuid
        unique_slug = f"test-tenant-{uuid.uuid4().hex[:8]}"
        
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(f"{BASE_URL}/api/platform/tenants", headers=headers, json={
            "name": f"Test Tenant {unique_slug}",
            "slug": unique_slug,
            "plan": "starter"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "tenant" in data
        assert "master_admin" in data
        assert "login_url" in data
        assert data["tenant"]["slug"] == unique_slug
        print(f"✓ Created tenant: {data['tenant']['name']}")
        print(f"✓ Master Admin email: {data['master_admin']['email']}")
        print(f"✓ Login URL: {data['login_url']}")
        
        # Cleanup - delete the test tenant
        tenant_id = data["tenant"]["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}",
            headers=headers,
            json={"password": SUPER_ADMIN_PASSWORD, "confirm": True}
        )
        if delete_response.status_code == 200:
            print(f"✓ Test tenant cleaned up")


class TestAuthMe:
    """Test /api/auth/me endpoint"""
    
    def test_auth_me_super_admin(self):
        """Test /api/auth/me returns correct info for Super Admin"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get current user info
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert "current_context" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        assert data["current_context"]["role"] == "super_admin"
        print(f"✓ /api/auth/me returns correct Super Admin info")
    
    def test_auth_me_master_admin(self):
        """Test /api/auth/me returns correct info for Master Admin"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get current user info
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert "memberships" in data
        assert data["user"]["email"] == MASTER_ADMIN_EMAIL
        print(f"✓ /api/auth/me returns correct Master Admin info with {len(data['memberships'])} memberships")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
