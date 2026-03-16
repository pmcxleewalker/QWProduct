"""
Test Plan Comparison, Feature Gating, Monthly Customization Credits, and Super Admin Feature Overrides
Tests for iteration 16 - Plan management features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"
BUMBLEANCE_ADMIN_EMAIL = "admin.bumbleance@quickwing.com"
BUMBLEANCE_ADMIN_PASSWORD = "admin123"


class TestPlanConfigurations:
    """Test plan configuration endpoints"""
    
    def test_get_plan_configurations(self):
        """GET /api/platform/plans returns all 3 plans with correct pricing"""
        response = requests.get(f"{BASE_URL}/api/platform/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) == 3, f"Expected 3 plans, got {len(plans)}"
        
        # Verify plan IDs
        plan_ids = [p["id"] for p in plans]
        assert "standard" in plan_ids
        assert "essential" in plan_ids
        assert "professional" in plan_ids
        
        # Verify pricing
        for plan in plans:
            if plan["id"] == "standard":
                assert plan["price"] == 179, f"Standard price should be 179, got {plan['price']}"
            elif plan["id"] == "essential":
                assert plan["price"] == 279, f"Essential price should be 279, got {plan['price']}"
            elif plan["id"] == "professional":
                assert plan["price"] == 399, f"Professional price should be 399, got {plan['price']}"
        
        print("✓ Plan configurations returned with correct pricing (€179, €279, €399)")
    
    def test_plan_features_structure(self):
        """Verify each plan has features dict with expected keys"""
        response = requests.get(f"{BASE_URL}/api/platform/plans")
        assert response.status_code == 200
        
        data = response.json()
        plans = data["plans"]
        
        expected_feature_keys = [
            "basic_fleet_management",
            "booking_management",
            "enhanced_reports",
            "api_access",
            "priority_support",
            "custom_branding"
        ]
        
        for plan in plans:
            assert "features" in plan, f"Plan {plan['id']} missing features"
            for key in expected_feature_keys:
                assert key in plan["features"], f"Plan {plan['id']} missing feature key: {key}"
        
        print("✓ All plans have correct feature structure")
    
    def test_plan_limits_structure(self):
        """Verify each plan has max_vehicles, max_users, customizations_per_month"""
        response = requests.get(f"{BASE_URL}/api/platform/plans")
        assert response.status_code == 200
        
        data = response.json()
        plans = data["plans"]
        
        for plan in plans:
            assert "max_vehicles" in plan, f"Plan {plan['id']} missing max_vehicles"
            assert "max_users" in plan, f"Plan {plan['id']} missing max_users"
            assert "customizations_per_month" in plan, f"Plan {plan['id']} missing customizations_per_month"
            assert plan["max_vehicles"] > 0
            assert plan["max_users"] > 0
            assert plan["customizations_per_month"] >= 0
        
        print("✓ All plans have correct limits structure")


class TestSuperAdminAuth:
    """Test super admin authentication"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_super_admin_login(self, super_admin_token):
        """Super admin can login successfully"""
        assert super_admin_token is not None
        assert len(super_admin_token) > 50
        print("✓ Super admin login successful")


class TestTenantListWithUsage:
    """Test tenant list includes usage counts"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_tenants_list_includes_usage_counts(self, super_admin_token):
        """GET /api/platform/tenants returns vehicles_count and users_count"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tenants" in data
        tenants = data["tenants"]
        assert len(tenants) > 0, "No tenants found"
        
        for tenant in tenants:
            assert "vehicles_count" in tenant, f"Tenant {tenant['name']} missing vehicles_count"
            assert "users_count" in tenant, f"Tenant {tenant['name']} missing users_count"
            assert isinstance(tenant["vehicles_count"], int)
            assert isinstance(tenant["users_count"], int)
        
        # Find Bumbleance and verify counts
        bumbleance = next((t for t in tenants if t["slug"] == "bumbleance"), None)
        if bumbleance:
            print(f"✓ Bumbleance: {bumbleance['vehicles_count']} vehicles, {bumbleance['users_count']} users")
        
        print("✓ Tenant list includes usage counts")


class TestTenantFeatures:
    """Test tenant feature endpoints"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def bumbleance_tenant_id(self, super_admin_token):
        """Get Bumbleance tenant ID"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        tenants = response.json()["tenants"]
        bumbleance = next((t for t in tenants if t["slug"] == "bumbleance"), None)
        assert bumbleance is not None, "Bumbleance tenant not found"
        return bumbleance["id"]
    
    def test_get_tenant_features(self, super_admin_token, bumbleance_tenant_id):
        """GET /api/platform/tenants/{id}/features returns features and limits"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tenant_id" in data
        assert "plan" in data
        assert "features" in data
        assert "limits" in data
        assert "feature_overrides" in data
        
        # Verify limits structure
        limits = data["limits"]
        assert "max_vehicles" in limits
        assert "max_users" in limits
        assert "customizations_remaining" in limits
        assert "customizations_per_month" in limits
        
        print(f"✓ Tenant features retrieved: plan={data['plan']}, limits={limits}")


class TestPlanChange:
    """Test plan change functionality"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def bumbleance_tenant_id(self, super_admin_token):
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        tenants = response.json()["tenants"]
        bumbleance = next((t for t in tenants if t["slug"] == "bumbleance"), None)
        return bumbleance["id"]
    
    def test_change_plan_to_essential(self, super_admin_token, bumbleance_tenant_id):
        """PUT /api/platform/tenants/{id}/plan changes plan successfully"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Change to essential
        response = requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/plan",
            params={"new_plan": "essential"},
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["plan"] == "essential"
        assert "new_limits" in data
        
        print(f"✓ Plan changed to essential: {data['new_limits']}")
        
        # Change back to standard
        response = requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/plan",
            params={"new_plan": "standard"},
            headers=headers
        )
        assert response.status_code == 200
        print("✓ Plan reverted to standard")
    
    def test_change_plan_invalid(self, super_admin_token, bumbleance_tenant_id):
        """PUT /api/platform/tenants/{id}/plan with invalid plan returns 400"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/plan",
            params={"new_plan": "invalid_plan"},
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid plan rejected with 400")


class TestCustomizationCredits:
    """Test customization credit endpoints"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def bumbleance_tenant_id(self, super_admin_token):
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        tenants = response.json()["tenants"]
        bumbleance = next((t for t in tenants if t["slug"] == "bumbleance"), None)
        return bumbleance["id"]
    
    def test_use_customization_credit(self, super_admin_token, bumbleance_tenant_id):
        """POST /api/platform/tenants/{id}/use-customization deducts credit"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First reset credits to ensure we have some
        reset_response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/reset-customizations",
            headers=headers
        )
        assert reset_response.status_code == 200
        initial_credits = reset_response.json()["credits_remaining"]
        
        # Use one credit
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/use-customization",
            params={"description": "Test customization"},
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "credits_remaining" in data
        assert data["credits_remaining"] == initial_credits - 1
        
        print(f"✓ Customization credit used: {initial_credits} -> {data['credits_remaining']}")
    
    def test_reset_customization_credits(self, super_admin_token, bumbleance_tenant_id):
        """POST /api/platform/tenants/{id}/reset-customizations resets credits"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/reset-customizations",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "credits_remaining" in data
        assert data["credits_remaining"] > 0
        
        print(f"✓ Credits reset to {data['credits_remaining']}")


class TestFeatureOverrides:
    """Test feature override functionality"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def bumbleance_tenant_id(self, super_admin_token):
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=headers)
        tenants = response.json()["tenants"]
        bumbleance = next((t for t in tenants if t["slug"] == "bumbleance"), None)
        return bumbleance["id"]
    
    def test_update_feature_overrides(self, super_admin_token, bumbleance_tenant_id):
        """PUT /api/platform/tenants/{id}/features updates feature overrides"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Update features
        response = requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            json={
                "features": {"enhanced_reports": True},
                "max_vehicles": 15,
                "max_users": 25
            },
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "updates" in data
        
        print(f"✓ Feature overrides updated: {data['updates']}")
        
        # Verify the changes
        verify_response = requests.get(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            headers=headers
        )
        verify_data = verify_response.json()
        assert verify_data["features"]["enhanced_reports"] == True
        assert verify_data["limits"]["max_vehicles"] == 15
        assert verify_data["limits"]["max_users"] == 25
        
        print("✓ Feature overrides verified")
        
        # Reset to defaults
        requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            json={
                "features": {},
                "max_vehicles": 10,
                "max_users": 20
            },
            headers=headers
        )
        print("✓ Feature overrides reset to defaults")
    
    def test_update_limit_overrides(self, super_admin_token, bumbleance_tenant_id):
        """PUT /api/platform/tenants/{id}/features can update limits only"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            json={
                "max_vehicles": 12
            },
            headers=headers
        )
        assert response.status_code == 200
        
        # Verify
        verify_response = requests.get(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            headers=headers
        )
        assert verify_response.json()["limits"]["max_vehicles"] == 12
        
        # Reset
        requests.put(
            f"{BASE_URL}/api/platform/tenants/{bumbleance_tenant_id}/features",
            json={"max_vehicles": 10},
            headers=headers
        )
        print("✓ Limit override works independently")


class TestFeatureGating:
    """Test feature gating for tenant users"""
    
    @pytest.fixture
    def bumbleance_token(self):
        """Get Bumbleance admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUMBLEANCE_ADMIN_EMAIL,
            "password": BUMBLEANCE_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Bumbleance login failed: {response.text}"
        data = response.json()
        
        # Select tenant if needed
        if data.get("tenants") and len(data["tenants"]) > 0:
            tenant = next((t for t in data["tenants"] if t["tenant_slug"] == "bumbleance"), data["tenants"][0])
            select_response = requests.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": tenant["tenant_id"]},
                headers={"Authorization": f"Bearer {data['access_token']}"}
            )
            if select_response.status_code == 200:
                return select_response.json()["access_token"]
        
        return data["access_token"]
    
    def test_my_plan_returns_features(self, bumbleance_token):
        """GET /api/my-plan returns plan features for feature gating"""
        headers = {"Authorization": f"Bearer {bumbleance_token}"}
        response = requests.get(f"{BASE_URL}/api/my-plan", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data
        assert "features" in data
        assert "limits" in data
        assert "usage" in data
        
        # Verify features dict
        features = data["features"]
        assert "enhanced_reports" in features
        assert "basic_fleet_management" in features
        
        print(f"✓ My plan returns features: {list(features.keys())}")
        print(f"  Plan: {data['plan']['name']}, Enhanced Reports: {features.get('enhanced_reports')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
