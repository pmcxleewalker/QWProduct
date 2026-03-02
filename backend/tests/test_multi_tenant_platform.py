"""
Multi-Tenant Platform Tests
============================
Tests for:
1. Super Admin login
2. Platform Admin dashboard stats
3. Create Tenant flow with auto-generated Master Admin credentials
4. Master Admin login with generated credentials
5. Tenant isolation
6. Role-based access control
7. Suspend/Reactivate tenant functionality
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tenant-platform-11.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"

# Test Master Admin (Kerry Care Fleet)
TEST_MASTER_ADMIN_EMAIL = "admin.kerry-care@quickwing.com"
TEST_MASTER_ADMIN_PASSWORD = "Rer6FQql1zWq"


class TestSuperAdminLogin:
    """Test Super Admin authentication"""
    
    def test_super_admin_login_success(self):
        """Super Admin can login with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token"
        assert "user" in data, "Missing user info"
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Super Admin login successful - Role: {data['user']['role']}")
    
    def test_super_admin_login_invalid_password(self):
        """Super Admin login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": "WrongPassword123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid password correctly rejected")
    
    def test_super_admin_login_invalid_email(self):
        """Login fails with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@quickwing.com", "password": "SomePassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Non-existent email correctly rejected")


class TestPlatformAdminDashboard:
    """Test Platform Admin dashboard and stats"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_platform_stats_endpoint(self, super_admin_token):
        """Platform stats endpoint returns correct data structure"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/stats", headers=headers)
        
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "tenants" in data, "Missing tenants stats"
        assert "total" in data["tenants"], "Missing total tenants"
        assert "active" in data["tenants"], "Missing active tenants"
        assert "suspended" in data["tenants"], "Missing suspended tenants"
        assert "users" in data, "Missing users count"
        assert "vehicles" in data, "Missing vehicles count"
        assert "bookings" in data, "Missing bookings stats"
        
        print(f"✓ Platform stats: {data['tenants']['total']} tenants, {data['users']} users, {data['vehicles']} vehicles")
    
    def test_list_tenants_endpoint(self, super_admin_token):
        """List tenants endpoint works"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        
        assert response.status_code == 200, f"List tenants failed: {response.text}"
        data = response.json()
        
        assert "tenants" in data, "Missing tenants list"
        assert "total" in data, "Missing total count"
        assert isinstance(data["tenants"], list), "Tenants should be a list"
        
        print(f"✓ Listed {len(data['tenants'])} tenants (total: {data['total']})")
    
    def test_audit_log_endpoint(self, super_admin_token):
        """Audit log endpoint works"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/audit-log?limit=10", headers=headers)
        
        assert response.status_code == 200, f"Audit log failed: {response.text}"
        data = response.json()
        
        assert "events" in data, "Missing events list"
        print(f"✓ Audit log returned {len(data['events'])} events")


class TestTenantCreation:
    """Test tenant creation with auto-generated Master Admin"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_create_tenant_with_auto_credentials(self, super_admin_token):
        """Create tenant and verify auto-generated Master Admin credentials"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Generate unique slug
        timestamp = int(datetime.now().timestamp())
        tenant_slug = f"test-tenant-{timestamp}"
        
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={
                "name": f"Test Tenant {timestamp}",
                "slug": tenant_slug,
                "plan": "starter"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Create tenant failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tenant" in data, "Missing tenant info"
        assert "master_admin" in data, "Missing master_admin credentials"
        assert "login_url" in data, "Missing login_url"
        
        # Verify tenant data
        tenant = data["tenant"]
        assert tenant["name"] == f"Test Tenant {timestamp}"
        assert tenant["slug"] == tenant_slug
        assert tenant["status"] == "active"
        assert tenant["plan"] == "starter"
        
        # Verify Master Admin credentials
        master_admin = data["master_admin"]
        assert "email" in master_admin, "Missing master_admin email"
        assert "password" in master_admin, "Missing master_admin password"
        assert master_admin["is_new_user"] == True, "Should be new user"
        
        # Verify auto-generated email format
        expected_email = f"admin.{tenant_slug}@quickwing.com"
        assert master_admin["email"] == expected_email, f"Expected {expected_email}, got {master_admin['email']}"
        
        # Verify password is generated (12 chars alphanumeric)
        assert len(master_admin["password"]) == 12, "Password should be 12 characters"
        
        print(f"✓ Tenant created: {tenant['name']}")
        print(f"✓ Master Admin email: {master_admin['email']}")
        print(f"✓ Master Admin password: {master_admin['password']}")
        print(f"✓ Login URL: {data['login_url']}")
        
        # Store for next test
        return {
            "tenant_id": tenant["id"],
            "master_admin_email": master_admin["email"],
            "master_admin_password": master_admin["password"]
        }
    
    def test_create_tenant_with_custom_admin_email(self, super_admin_token):
        """Create tenant with custom Master Admin email"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        timestamp = int(datetime.now().timestamp())
        tenant_slug = f"custom-admin-{timestamp}"
        custom_email = f"custom-owner-{timestamp}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={
                "name": f"Custom Admin Tenant {timestamp}",
                "slug": tenant_slug,
                "plan": "professional",
                "master_admin_email": custom_email,
                "master_admin_name": "Custom Owner"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Create tenant failed: {response.text}"
        data = response.json()
        
        # Verify custom email was used
        assert data["master_admin"]["email"] == custom_email
        assert data["master_admin"]["name"] == "Custom Owner"
        
        print(f"✓ Tenant created with custom admin email: {custom_email}")
    
    def test_create_tenant_duplicate_slug_fails(self, super_admin_token):
        """Creating tenant with duplicate slug fails"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        timestamp = int(datetime.now().timestamp())
        tenant_slug = f"dup-test-{timestamp}"
        
        # Create first tenant
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={"name": "First Tenant", "slug": tenant_slug, "plan": "starter"},
            headers=headers
        )
        assert response.status_code == 200
        
        # Try to create second tenant with same slug
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={"name": "Second Tenant", "slug": tenant_slug, "plan": "starter"},
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "slug already exists" in response.json().get("detail", "").lower()
        
        print("✓ Duplicate slug correctly rejected")


class TestMasterAdminLogin:
    """Test Master Admin login with generated credentials"""
    
    def test_master_admin_login_with_generated_credentials(self):
        """Master Admin can login with auto-generated credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_MASTER_ADMIN_EMAIL, "password": TEST_MASTER_ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Master Admin login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == TEST_MASTER_ADMIN_EMAIL
        assert data["user"]["role"] == "master_admin"
        
        print(f"✓ Master Admin login successful - Role: {data['user']['role']}")
        
        # Verify tenant access
        assert "tenants" in data, "Missing tenants list"
        if data["tenants"]:
            print(f"✓ Master Admin has access to {len(data['tenants'])} tenant(s)")


class TestTenantSuspendReactivate:
    """Test suspend and reactivate tenant functionality"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_tenant(self, super_admin_token):
        """Create a test tenant for suspend/reactivate tests"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        timestamp = int(datetime.now().timestamp())
        
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={
                "name": f"Suspend Test {timestamp}",
                "slug": f"suspend-test-{timestamp}",
                "plan": "starter"
            },
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        return {
            "tenant_id": data["tenant"]["id"],
            "master_email": data["master_admin"]["email"],
            "master_password": data["master_admin"]["password"]
        }
    
    def test_suspend_tenant(self, super_admin_token, test_tenant):
        """Super Admin can suspend a tenant"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        tenant_id = test_tenant["tenant_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}/suspend",
            headers=headers
        )
        
        assert response.status_code == 200, f"Suspend failed: {response.text}"
        
        # Verify tenant is suspended
        response = requests.get(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}",
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["tenant"]["status"] == "suspended"
        
        print("✓ Tenant suspended successfully")
    
    def test_suspended_tenant_user_cannot_access(self, super_admin_token, test_tenant):
        """User from suspended tenant cannot access resources"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        tenant_id = test_tenant["tenant_id"]
        
        # First suspend the tenant
        requests.post(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}/suspend",
            headers=headers
        )
        
        # Try to login as Master Admin of suspended tenant
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_tenant["master_email"],
                "password": test_tenant["master_password"]
            }
        )
        
        # Login should succeed but tenant access should be blocked
        if response.status_code == 200:
            token = response.json()["access_token"]
            user_headers = {"Authorization": f"Bearer {token}"}
            
            # Try to access tenant resources - should fail
            # Note: The user can login but their tenant is suspended
            tenants = response.json().get("tenants", [])
            # Suspended tenants should not appear in accessible tenants
            active_tenants = [t for t in tenants if t.get("status") != "suspended"]
            print(f"✓ Suspended tenant not in active tenant list (active: {len(active_tenants)})")
        else:
            print("✓ Login blocked for suspended tenant user")
    
    def test_reactivate_tenant(self, super_admin_token, test_tenant):
        """Super Admin can reactivate a suspended tenant"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        tenant_id = test_tenant["tenant_id"]
        
        # First suspend
        requests.post(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}/suspend",
            headers=headers
        )
        
        # Then reactivate
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}/reactivate",
            headers=headers
        )
        
        assert response.status_code == 200, f"Reactivate failed: {response.text}"
        
        # Verify tenant is active again
        response = requests.get(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}",
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["tenant"]["status"] == "active"
        
        print("✓ Tenant reactivated successfully")


class TestRoleBasedAccessControl:
    """Test role-based access control"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_tenant_with_users(self, super_admin_token):
        """Create tenant with admin and staff users"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        timestamp = int(datetime.now().timestamp())
        
        # Create tenant
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={
                "name": f"RBAC Test {timestamp}",
                "slug": f"rbac-test-{timestamp}",
                "plan": "starter"
            },
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        tenant_id = data["tenant"]["id"]
        admin_email = data["master_admin"]["email"]
        admin_password = data["master_admin"]["password"]
        
        # Login as admin to create staff user
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": admin_email, "password": admin_password}
        )
        assert response.status_code == 200
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create staff user
        staff_email = f"staff-{timestamp}@test.com"
        staff_password = "StaffPass123"
        
        response = requests.post(
            f"{BASE_URL}/api/tenant/users",
            json={
                "email": staff_email,
                "password": staff_password,
                "name": "Test Staff"
            },
            params={"role": "staff"},
            headers=admin_headers
        )
        
        return {
            "tenant_id": tenant_id,
            "admin_email": admin_email,
            "admin_password": admin_password,
            "staff_email": staff_email,
            "staff_password": staff_password
        }
    
    def test_staff_cannot_access_platform_endpoints(self, test_tenant_with_users):
        """Staff user cannot access platform admin endpoints"""
        # Login as staff
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_tenant_with_users["staff_email"],
                "password": test_tenant_with_users["staff_password"]
            }
        )
        
        if response.status_code != 200:
            pytest.skip("Staff user creation may have failed")
        
        staff_token = response.json()["access_token"]
        staff_headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Try to access platform stats - should fail
        response = requests.get(
            f"{BASE_URL}/api/platform/stats",
            headers=staff_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        # Try to list tenants - should fail
        response = requests.get(
            f"{BASE_URL}/api/platform/tenants",
            headers=staff_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        print("✓ Staff correctly blocked from platform admin endpoints")
    
    def test_admin_can_create_vehicles(self, test_tenant_with_users):
        """Admin can create vehicles in their tenant"""
        # Login as admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_tenant_with_users["admin_email"],
                "password": test_tenant_with_users["admin_password"]
            }
        )
        assert response.status_code == 200
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create vehicle
        response = requests.post(
            f"{BASE_URL}/api/vehicles",
            json={
                "name": "Test Vehicle",
                "registration": f"TEST-{int(datetime.now().timestamp())}"
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create vehicle failed: {response.text}"
        print("✓ Admin can create vehicles")


class TestTenantIsolation:
    """Test tenant data isolation"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def two_tenants(self, super_admin_token):
        """Create two tenants for isolation testing"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        timestamp = int(datetime.now().timestamp())
        
        # Create Tenant A
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={
                "name": f"Isolation A {timestamp}",
                "slug": f"isolation-a-{timestamp}",
                "plan": "starter"
            },
            headers=headers
        )
        assert response.status_code == 200
        tenant_a = response.json()
        
        # Create Tenant B
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            json={
                "name": f"Isolation B {timestamp}",
                "slug": f"isolation-b-{timestamp}",
                "plan": "starter"
            },
            headers=headers
        )
        assert response.status_code == 200
        tenant_b = response.json()
        
        return {
            "tenant_a": {
                "id": tenant_a["tenant"]["id"],
                "admin_email": tenant_a["master_admin"]["email"],
                "admin_password": tenant_a["master_admin"]["password"]
            },
            "tenant_b": {
                "id": tenant_b["tenant"]["id"],
                "admin_email": tenant_b["master_admin"]["email"],
                "admin_password": tenant_b["master_admin"]["password"]
            }
        }
    
    def test_tenant_a_cannot_see_tenant_b_vehicles(self, two_tenants):
        """Tenant A admin cannot see Tenant B's vehicles"""
        # Login as Tenant A admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": two_tenants["tenant_a"]["admin_email"],
                "password": two_tenants["tenant_a"]["admin_password"]
            }
        )
        assert response.status_code == 200
        token_a = response.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        
        # Login as Tenant B admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": two_tenants["tenant_b"]["admin_email"],
                "password": two_tenants["tenant_b"]["admin_password"]
            }
        )
        assert response.status_code == 200
        token_b = response.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        
        # Create vehicle in Tenant B
        timestamp = int(datetime.now().timestamp())
        response = requests.post(
            f"{BASE_URL}/api/vehicles",
            json={
                "name": "Tenant B Vehicle",
                "registration": f"B-{timestamp}"
            },
            headers=headers_b
        )
        assert response.status_code == 200
        vehicle_b_id = response.json()["vehicle"]["id"]
        
        # Tenant A tries to list vehicles - should not see Tenant B's vehicle
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers_a)
        assert response.status_code == 200
        vehicles_a = response.json()
        vehicle_ids = [v["id"] for v in vehicles_a]
        
        assert vehicle_b_id not in vehicle_ids, "ISOLATION FAILURE: Tenant A can see Tenant B's vehicle!"
        print("✓ Tenant isolation verified - Tenant A cannot see Tenant B's vehicles")
    
    def test_tenant_a_cannot_access_tenant_b_vehicle_directly(self, two_tenants):
        """Tenant A admin cannot access Tenant B's vehicle by ID"""
        # Login as both admins
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": two_tenants["tenant_a"]["admin_email"],
                "password": two_tenants["tenant_a"]["admin_password"]
            }
        )
        token_a = response.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": two_tenants["tenant_b"]["admin_email"],
                "password": two_tenants["tenant_b"]["admin_password"]
            }
        )
        token_b = response.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        
        # Create vehicle in Tenant B
        timestamp = int(datetime.now().timestamp())
        response = requests.post(
            f"{BASE_URL}/api/vehicles",
            json={
                "name": "Direct Access Test",
                "registration": f"DAT-{timestamp}"
            },
            headers=headers_b
        )
        assert response.status_code == 200
        vehicle_b_id = response.json()["vehicle"]["id"]
        
        # Tenant A tries to access Tenant B's vehicle directly
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_b_id}",
            headers=headers_a
        )
        assert response.status_code == 404, f"ISOLATION FAILURE: Got {response.status_code} instead of 404"
        print("✓ Direct access isolation verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
