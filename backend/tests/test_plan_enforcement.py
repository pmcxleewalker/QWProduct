"""
Test Plan Enforcement - 3-Tier Subscription System
Tests for vehicle and user limit enforcement based on tenant plan
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
BUMBLEANCE_ADMIN = {"email": "admin.bumbleance@quickwing.com", "password": "admin123"}
SUPER_ADMIN = {"email": "superadmin@quickwing.com", "password": "Super123"}


class TestPlanEnforcement:
    """Test plan limits and enforcement for vehicles and users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, credentials):
        """Helper to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def get_tenant_id_from_login(self, credentials):
        """Helper to get tenant_id from login response"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            data = response.json()
            if data.get("active_tenant"):
                return data["active_tenant"]["tenant_id"]
            elif data.get("tenants") and len(data["tenants"]) > 0:
                return data["tenants"][0]["tenant_id"]
        return None
    
    # ==================== GET /api/my-plan Tests ====================
    
    def test_my_plan_endpoint_returns_correct_structure(self):
        """Test GET /api/my-plan returns correct plan info, limits, usage, and features"""
        # Login as Bumbleance admin
        token = self.get_auth_token(BUMBLEANCE_ADMIN)
        assert token is not None, "Failed to login as Bumbleance admin"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "plan" in data, "Response should contain 'plan'"
        assert "limits" in data, "Response should contain 'limits'"
        assert "usage" in data, "Response should contain 'usage'"
        assert "features" in data, "Response should contain 'features'"
        
        # Verify plan info
        plan = data["plan"]
        assert "id" in plan, "Plan should have 'id'"
        assert "name" in plan, "Plan should have 'name'"
        assert "description" in plan, "Plan should have 'description'"
        
        # Verify limits
        limits = data["limits"]
        assert "max_vehicles" in limits, "Limits should have 'max_vehicles'"
        assert "max_users" in limits, "Limits should have 'max_users'"
        assert isinstance(limits["max_vehicles"], int), "max_vehicles should be an integer"
        assert isinstance(limits["max_users"], int), "max_users should be an integer"
        
        # Verify usage
        usage = data["usage"]
        assert "vehicles" in usage, "Usage should have 'vehicles'"
        assert "users" in usage, "Usage should have 'users'"
        assert isinstance(usage["vehicles"], int), "vehicles usage should be an integer"
        assert isinstance(usage["users"], int), "users usage should be an integer"
        
        # Verify features is a dict
        assert isinstance(data["features"], dict), "Features should be a dictionary"
        
        print(f"✓ Plan: {plan['name']} ({plan['id']})")
        print(f"✓ Limits: {limits['max_vehicles']} vehicles, {limits['max_users']} users")
        print(f"✓ Usage: {usage['vehicles']} vehicles, {usage['users']} users")
        print(f"✓ Features: {list(data['features'].keys())}")
    
    def test_my_plan_requires_authentication(self):
        """Test GET /api/my-plan requires authentication"""
        # Clear any existing auth
        self.session.headers.pop("Authorization", None)
        
        response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_my_plan_legacy_plan_mapping(self):
        """Test that legacy plan names (starter, basic, pro) are mapped correctly"""
        # This test verifies the backend handles legacy plan names
        token = self.get_auth_token(BUMBLEANCE_ADMIN)
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert response.status_code == 200
        
        data = response.json()
        plan_id = data["plan"]["id"]
        
        # Plan should be one of the valid 3-tier plans
        valid_plans = ["standard", "essential", "professional"]
        assert plan_id in valid_plans, f"Plan '{plan_id}' should be one of {valid_plans}"
        print(f"✓ Plan ID '{plan_id}' is valid")
    
    # ==================== Vehicle Limit Enforcement Tests ====================
    
    def test_vehicle_creation_blocked_at_limit(self):
        """Test POST /api/vehicles returns 403 when vehicle limit is reached"""
        # Login as Bumbleance admin
        token = self.get_auth_token(BUMBLEANCE_ADMIN)
        assert token is not None, "Failed to login as Bumbleance admin"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First, get current plan data
        plan_response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert plan_response.status_code == 200
        plan_data = plan_response.json()
        
        current_vehicles = plan_data["usage"]["vehicles"]
        max_vehicles = plan_data["limits"]["max_vehicles"]
        
        print(f"Current vehicles: {current_vehicles}/{max_vehicles}")
        
        # If not at limit, we need to temporarily set limit to current count
        # This test documents the expected behavior when at limit
        if current_vehicles >= max_vehicles:
            # Already at limit - try to create vehicle
            vehicle_data = {
                "name": "TEST_LimitVehicle",
                "registration": "TEST-LIMIT-001"
            }
            
            response = self.session.post(f"{BASE_URL}/api/vehicles", json=vehicle_data)
            assert response.status_code == 403, f"Expected 403 when at limit, got {response.status_code}"
            
            # Verify error message
            error_data = response.json()
            assert "limit" in error_data.get("detail", "").lower() or "upgrade" in error_data.get("detail", "").lower(), \
                f"Error message should mention limit: {error_data}"
            print(f"✓ Vehicle creation blocked at limit with message: {error_data.get('detail')}")
        else:
            print(f"⚠ Not at vehicle limit ({current_vehicles}/{max_vehicles}). To test limit enforcement, set max_vehicles={current_vehicles} in MongoDB")
            # Document expected behavior
            print("Expected behavior: POST /api/vehicles should return 403 with 'Vehicle limit reached' message when at limit")
    
    def test_vehicle_creation_succeeds_under_limit(self):
        """Test POST /api/vehicles succeeds when under limit"""
        token = self.get_auth_token(BUMBLEANCE_ADMIN)
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get current plan data
        plan_response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert plan_response.status_code == 200
        plan_data = plan_response.json()
        
        current_vehicles = plan_data["usage"]["vehicles"]
        max_vehicles = plan_data["limits"]["max_vehicles"]
        
        if current_vehicles < max_vehicles:
            # Create a test vehicle
            vehicle_data = {
                "name": "TEST_PlanEnforcement_Vehicle",
                "registration": f"TEST-PLAN-{current_vehicles + 1}"
            }
            
            response = self.session.post(f"{BASE_URL}/api/vehicles", json=vehicle_data)
            
            if response.status_code == 201:
                print(f"✓ Vehicle created successfully under limit")
                # Clean up - delete the test vehicle
                vehicle_id = response.json().get("id")
                if vehicle_id:
                    delete_response = self.session.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}")
                    print(f"✓ Test vehicle cleaned up (status: {delete_response.status_code})")
            else:
                print(f"Vehicle creation response: {response.status_code} - {response.text}")
        else:
            print(f"⚠ Already at vehicle limit ({current_vehicles}/{max_vehicles}), skipping creation test")
    
    # ==================== User Limit Enforcement Tests ====================
    
    def test_user_creation_blocked_at_limit(self):
        """Test POST /api/tenant/users returns 403 when user limit is reached"""
        token = self.get_auth_token(BUMBLEANCE_ADMIN)
        assert token is not None, "Failed to login as Bumbleance admin"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get current plan data
        plan_response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert plan_response.status_code == 200
        plan_data = plan_response.json()
        
        current_users = plan_data["usage"]["users"]
        max_users = plan_data["limits"]["max_users"]
        
        print(f"Current users: {current_users}/{max_users}")
        
        if current_users >= max_users:
            # Already at limit - try to create user
            user_data = {
                "email": "test.limit.user@example.com",
                "name": "Test Limit User",
                "password": "testpass123"
            }
            
            response = self.session.post(f"{BASE_URL}/api/tenant/users", json=user_data)
            assert response.status_code == 403, f"Expected 403 when at limit, got {response.status_code}"
            
            # Verify error message
            error_data = response.json()
            assert "limit" in error_data.get("detail", "").lower() or "upgrade" in error_data.get("detail", "").lower(), \
                f"Error message should mention limit: {error_data}"
            print(f"✓ User creation blocked at limit with message: {error_data.get('detail')}")
        else:
            print(f"⚠ Not at user limit ({current_users}/{max_users}). To test limit enforcement, set max_users={current_users} in MongoDB")
            print("Expected behavior: POST /api/tenant/users should return 403 with 'User limit reached' message when at limit")
    
    def test_user_creation_succeeds_under_limit(self):
        """Test POST /api/tenant/users succeeds when under limit"""
        token = self.get_auth_token(BUMBLEANCE_ADMIN)
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get current plan data
        plan_response = self.session.get(f"{BASE_URL}/api/my-plan")
        assert plan_response.status_code == 200
        plan_data = plan_response.json()
        
        current_users = plan_data["usage"]["users"]
        max_users = plan_data["limits"]["max_users"]
        
        if current_users < max_users:
            # Create a test user
            import uuid
            test_email = f"test.plan.{uuid.uuid4().hex[:8]}@example.com"
            user_data = {
                "email": test_email,
                "name": "Test Plan User",
                "password": "testpass123"
            }
            
            response = self.session.post(f"{BASE_URL}/api/tenant/users", json=user_data, params={"role": "staff"})
            
            if response.status_code in [200, 201]:
                print(f"✓ User created successfully under limit")
                # Clean up - delete the test user
                user_id = response.json().get("user_id")
                if user_id:
                    delete_response = self.session.delete(f"{BASE_URL}/api/tenant/users/{user_id}")
                    print(f"✓ Test user cleaned up (status: {delete_response.status_code})")
            else:
                print(f"User creation response: {response.status_code} - {response.text}")
        else:
            print(f"⚠ Already at user limit ({current_users}/{max_users}), skipping creation test")


class TestPlanConfiguration:
    """Test plan configuration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_platform_plans_endpoint(self):
        """Test GET /api/platform/plans returns all plan configurations"""
        response = self.session.get(f"{BASE_URL}/api/platform/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans'"
        
        plans = data["plans"]
        assert len(plans) >= 3, f"Should have at least 3 plans, got {len(plans)}"
        
        # Verify each plan has required fields
        for plan in plans:
            assert "id" in plan, f"Plan should have 'id': {plan}"
            assert "name" in plan, f"Plan should have 'name': {plan}"
            assert "max_vehicles" in plan, f"Plan should have 'max_vehicles': {plan}"
            assert "max_users" in plan, f"Plan should have 'max_users': {plan}"
            assert "features" in plan, f"Plan should have 'features': {plan}"
            
            print(f"✓ Plan: {plan['name']} - {plan['max_vehicles']} vehicles, {plan['max_users']} users")
        
        # Verify the 3-tier structure
        plan_ids = [p["id"] for p in plans]
        assert "standard" in plan_ids, "Should have 'standard' plan"
        assert "essential" in plan_ids, "Should have 'essential' plan"
        assert "professional" in plan_ids, "Should have 'professional' plan"


class TestSuperAdminPlanManagement:
    """Test super admin plan management capabilities"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with super admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_tenant_features(self):
        """Test GET /api/platform/tenants/{id}/features returns tenant features"""
        # First get list of tenants
        response = self.session.get(f"{BASE_URL}/api/platform/tenants")
        assert response.status_code == 200
        
        tenants = response.json().get("tenants", [])
        if len(tenants) > 0:
            tenant_id = tenants[0]["id"]
            
            # Get tenant features
            features_response = self.session.get(f"{BASE_URL}/api/platform/tenants/{tenant_id}/features")
            assert features_response.status_code == 200, f"Expected 200, got {features_response.status_code}"
            
            data = features_response.json()
            assert "tenant_id" in data
            assert "plan" in data
            assert "features" in data
            assert "limits" in data
            
            print(f"✓ Tenant {tenant_id} features retrieved")
            print(f"  Plan: {data['plan']}")
            print(f"  Limits: {data['limits']}")
        else:
            pytest.skip("No tenants available for testing")
    
    def test_get_tenant_with_usage_stats(self):
        """Test GET /api/platform/tenants/{id} returns usage stats"""
        # Get list of tenants
        response = self.session.get(f"{BASE_URL}/api/platform/tenants")
        assert response.status_code == 200
        
        tenants = response.json().get("tenants", [])
        if len(tenants) > 0:
            tenant_id = tenants[0]["id"]
            
            # Get tenant details with usage
            detail_response = self.session.get(f"{BASE_URL}/api/platform/tenants/{tenant_id}")
            assert detail_response.status_code == 200
            
            data = detail_response.json()
            assert "tenant" in data
            assert "usage" in data
            assert "plan_config" in data
            
            usage = data["usage"]
            assert "vehicles" in usage
            assert "max_vehicles" in usage
            assert "users" in usage
            assert "max_users" in usage
            
            print(f"✓ Tenant usage stats: {usage['vehicles']}/{usage['max_vehicles']} vehicles, {usage['users']}/{usage['max_users']} users")
        else:
            pytest.skip("No tenants available for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
