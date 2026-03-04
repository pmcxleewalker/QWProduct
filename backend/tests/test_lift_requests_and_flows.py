"""
Test Suite for Quick Wing Multi-Tenant SaaS Platform
Tests: Super Admin, Master Admin, Staff flows, Lift Requests, and all cartrack-19 features
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"


class TestSuperAdminFlow:
    """Test Super Admin login and platform management"""
    
    def test_super_admin_login(self):
        """Super Admin login returns correct role and redirects to /platform"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        
        # Store token for later tests
        TestSuperAdminFlow.super_admin_token = data["access_token"]
        print(f"✓ Super Admin login successful, role: {data['user']['role']}")
    
    def test_platform_tenants_list(self):
        """Super Admin can list all tenants"""
        headers = {"Authorization": f"Bearer {TestSuperAdminFlow.super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        
        assert response.status_code == 200, f"Failed to list tenants: {response.text}"
        data = response.json()
        assert "tenants" in data
        assert "total" in data
        print(f"✓ Platform tenants list: {data['total']} tenants found")
    
    def test_create_franchise_with_master_admin(self):
        """Super Admin can create new franchise with auto-generated Master Admin"""
        headers = {"Authorization": f"Bearer {TestSuperAdminFlow.super_admin_token}"}
        
        # Generate unique slug for test
        test_slug = f"test-franchise-{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/platform/tenants", headers=headers, json={
            "name": "Test Franchise",
            "slug": test_slug,
            "plan": "starter"
        })
        
        assert response.status_code == 200, f"Failed to create tenant: {response.text}"
        data = response.json()
        
        assert "tenant" in data
        assert "master_admin" in data
        assert data["tenant"]["slug"] == test_slug
        assert data["master_admin"]["email"] is not None
        assert data["master_admin"]["password"] is not None  # Auto-generated password
        
        # Store for cleanup and further tests
        TestSuperAdminFlow.test_tenant_id = data["tenant"]["id"]
        TestSuperAdminFlow.test_tenant_slug = test_slug
        TestSuperAdminFlow.master_admin_email = data["master_admin"]["email"]
        TestSuperAdminFlow.master_admin_password = data["master_admin"]["password"]
        
        print(f"✓ Franchise created: {test_slug}")
        print(f"  Master Admin: {data['master_admin']['email']}")
        print(f"  Login URL: {data['login_url']}")


class TestMasterAdminFlow:
    """Test Master Admin login and dashboard access"""
    
    def test_master_admin_login(self):
        """Master Admin can login at /{tenant-slug}/login"""
        # Use the created test franchise
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TestSuperAdminFlow.master_admin_email,
            "password": TestSuperAdminFlow.master_admin_password
        })
        
        assert response.status_code == 200, f"Master Admin login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "tenants" in data
        assert len(data["tenants"]) > 0
        
        # Find the test tenant in memberships
        test_tenant = next((t for t in data["tenants"] if t["tenant_slug"] == TestSuperAdminFlow.test_tenant_slug), None)
        assert test_tenant is not None, "Master Admin should have membership to test tenant"
        assert test_tenant["role"] == "master_admin"
        
        TestMasterAdminFlow.master_admin_token = data["access_token"]
        TestMasterAdminFlow.tenant_id = test_tenant["tenant_id"]
        print(f"✓ Master Admin login successful, tenant: {test_tenant['tenant_name']}")
    
    def test_select_tenant_context(self):
        """Master Admin can select tenant context"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/auth/select-tenant", headers=headers, json={
            "tenant_id": TestMasterAdminFlow.tenant_id
        })
        
        assert response.status_code == 200, f"Failed to select tenant: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert data["active_tenant"]["tenant_id"] == TestMasterAdminFlow.tenant_id
        
        # Update token with tenant context
        TestMasterAdminFlow.master_admin_token = data["access_token"]
        print(f"✓ Tenant context selected: {data['active_tenant']['tenant_name']}")
    
    def test_master_admin_can_access_vehicles(self):
        """Master Admin can access vehicles endpoint"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        assert response.status_code == 200, f"Failed to get vehicles: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Master Admin can access vehicles: {len(data)} vehicles")
    
    def test_master_admin_can_access_bookings(self):
        """Master Admin can access bookings endpoint"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        assert response.status_code == 200, f"Failed to get bookings: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Master Admin can access bookings: {len(data)} bookings")
    
    def test_master_admin_can_access_team(self):
        """Master Admin can access tenant users endpoint"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tenant/users", headers=headers)
        assert response.status_code == 200, f"Failed to get team: {response.text}"
        
        data = response.json()
        assert "users" in data
        print(f"✓ Master Admin can access team: {len(data['users'])} users")
    
    def test_master_admin_can_create_vehicle(self):
        """Master Admin can create a vehicle"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/vehicles", headers=headers, json={
            "name": "Test Vehicle",
            "registration": "TEST-123"
        })
        
        assert response.status_code == 200, f"Failed to create vehicle: {response.text}"
        data = response.json()
        
        assert data["name"] == "Test Vehicle"
        assert data["registration"] == "TEST-123"
        TestMasterAdminFlow.test_vehicle_id = data["id"]
        print(f"✓ Master Admin created vehicle: {data['name']}")
    
    def test_master_admin_can_create_staff(self):
        """Master Admin can create staff user"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        staff_email = f"staff-{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/tenant/users", headers=headers, 
            params={"role": "staff"},
            json={
                "name": "Test Staff",
                "email": staff_email
            })
        
        assert response.status_code == 200, f"Failed to create staff: {response.text}"
        data = response.json()
        
        assert "user_id" in data
        assert "temporary_password" in data
        
        TestMasterAdminFlow.staff_email = staff_email
        TestMasterAdminFlow.staff_password = data["temporary_password"]
        TestMasterAdminFlow.staff_user_id = data["user_id"]
        print(f"✓ Master Admin created staff: {staff_email}")


class TestStaffFlow:
    """Test Staff login and limited access"""
    
    def test_staff_login(self):
        """Staff can login at /{tenant-slug}/login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TestMasterAdminFlow.staff_email,
            "password": TestMasterAdminFlow.staff_password
        })
        
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "tenants" in data
        
        TestStaffFlow.staff_token = data["access_token"]
        TestStaffFlow.tenant_id = data["tenants"][0]["tenant_id"] if data["tenants"] else None
        print(f"✓ Staff login successful")
    
    def test_staff_select_tenant(self):
        """Staff can select tenant context"""
        if not TestStaffFlow.tenant_id:
            pytest.skip("No tenant available for staff")
        
        headers = {"Authorization": f"Bearer {TestStaffFlow.staff_token}"}
        
        response = requests.post(f"{BASE_URL}/api/auth/select-tenant", headers=headers, json={
            "tenant_id": TestStaffFlow.tenant_id
        })
        
        assert response.status_code == 200, f"Failed to select tenant: {response.text}"
        data = response.json()
        
        TestStaffFlow.staff_token = data["access_token"]
        print(f"✓ Staff tenant context selected")
    
    def test_staff_can_view_vehicles(self):
        """Staff can view vehicles (Live Fleet Status)"""
        headers = {"Authorization": f"Bearer {TestStaffFlow.staff_token}"}
        
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        assert response.status_code == 200, f"Staff cannot view vehicles: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Staff can view Live Fleet: {len(data)} vehicles")
    
    def test_staff_can_view_bookings(self):
        """Staff can view bookings"""
        headers = {"Authorization": f"Bearer {TestStaffFlow.staff_token}"}
        
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        assert response.status_code == 200, f"Staff cannot view bookings: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Staff can view bookings: {len(data)} bookings")


class TestLiftRequestFeature:
    """Test Request a Lift feature"""
    
    def test_staff_can_create_lift_request(self):
        """Staff can submit a lift request"""
        headers = {"Authorization": f"Bearer {TestStaffFlow.staff_token}"}
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/lift-requests", headers=headers, json={
            "from_location": "Office",
            "to_location": "Client Site",
            "date": tomorrow,
            "time": "09:00",
            "seats_needed": 1,
            "notes": "Test lift request"
        })
        
        assert response.status_code == 200, f"Failed to create lift request: {response.text}"
        data = response.json()
        
        assert data["from_location"] == "Office"
        assert data["to_location"] == "Client Site"
        assert data["status"] == "open"
        
        TestLiftRequestFeature.lift_request_id = data["id"]
        print(f"✓ Lift request created: {data['id']}")
    
    def test_get_active_lift_requests(self):
        """Can get active lift requests"""
        headers = {"Authorization": f"Bearer {TestStaffFlow.staff_token}"}
        
        response = requests.get(f"{BASE_URL}/api/lift-requests/active", headers=headers)
        assert response.status_code == 200, f"Failed to get active lift requests: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should contain our created request
        our_request = next((r for r in data if r["id"] == TestLiftRequestFeature.lift_request_id), None)
        assert our_request is not None, "Created lift request should be in active list"
        print(f"✓ Active lift requests: {len(data)} requests")
    
    def test_list_all_lift_requests(self):
        """Can list all lift requests"""
        headers = {"Authorization": f"Bearer {TestStaffFlow.staff_token}"}
        
        response = requests.get(f"{BASE_URL}/api/lift-requests", headers=headers)
        assert response.status_code == 200, f"Failed to list lift requests: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ All lift requests: {len(data)} requests")


class TestComplianceAlerts:
    """Test Compliance Alerts feature for vehicles with expiring tax"""
    
    def test_vehicle_with_tax_expiry(self):
        """Create vehicle with tax expiry within 30 days for compliance alert"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        # Set tax due date to 15 days from now
        tax_due = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/vehicles", headers=headers, json={
            "name": "Compliance Test Vehicle",
            "registration": "COMP-001",
            "tax_due_date": tax_due
        })
        
        assert response.status_code == 200, f"Failed to create vehicle: {response.text}"
        data = response.json()
        
        assert data["tax_due_date"] == tax_due
        TestComplianceAlerts.compliance_vehicle_id = data["id"]
        print(f"✓ Vehicle with tax expiry created: {data['name']}, tax due: {tax_due}")
    
    def test_vehicles_list_includes_tax_expiry(self):
        """Vehicles list includes tax_due_date for compliance checking"""
        headers = {"Authorization": f"Bearer {TestMasterAdminFlow.master_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        compliance_vehicle = next((v for v in data if v.get("id") == TestComplianceAlerts.compliance_vehicle_id), None)
        
        if compliance_vehicle:
            assert "tax_due_date" in compliance_vehicle
            print(f"✓ Vehicle tax_due_date available for compliance alerts")


class TestTenantLookup:
    """Test tenant lookup by slug for branded login pages"""
    
    def test_tenant_lookup_by_slug(self):
        """Can lookup tenant by slug for branded login"""
        response = requests.get(f"{BASE_URL}/api/tenants/by-slug/{TestSuperAdminFlow.test_tenant_slug}")
        
        assert response.status_code == 200, f"Failed to lookup tenant: {response.text}"
        data = response.json()
        
        assert data["slug"] == TestSuperAdminFlow.test_tenant_slug
        assert "name" in data
        assert "status" in data
        print(f"✓ Tenant lookup successful: {data['name']}")
    
    def test_nonexistent_tenant_returns_404(self):
        """Non-existent tenant slug returns 404"""
        response = requests.get(f"{BASE_URL}/api/tenants/by-slug/nonexistent-tenant-xyz")
        
        assert response.status_code == 404
        print(f"✓ Non-existent tenant returns 404")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_tenant(self):
        """Delete test tenant (requires super admin)"""
        headers = {"Authorization": f"Bearer {TestSuperAdminFlow.super_admin_token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/platform/tenants/{TestSuperAdminFlow.test_tenant_id}",
            headers=headers,
            json={
                "password": SUPER_ADMIN_PASSWORD,
                "confirm": True
            }
        )
        
        # May fail if tenant doesn't exist or already deleted
        if response.status_code == 200:
            print(f"✓ Test tenant cleaned up")
        else:
            print(f"⚠ Cleanup skipped: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
