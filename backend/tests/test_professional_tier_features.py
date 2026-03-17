"""
Test Professional Tier Features:
- Settings API (GET/PUT /api/tenant/settings)
- QR Code endpoint
- Booking management (update/delete)
- Cost analytics feature
- Custom branding feature
- API Access removal verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PROFESSIONAL_ADMIN = {
    "email": "admin@protransport.com",
    "password": "Pro123"
}

SUPER_ADMIN = {
    "email": "superadmin@quickwing.com",
    "password": "Super123"
}


@pytest.fixture(scope="module")
def pro_admin_token():
    """Get authentication token for professional tier admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=PROFESSIONAL_ADMIN)
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def super_admin_token():
    """Get authentication token for super admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


class TestSettingsAPI:
    """Test tenant settings endpoints for Professional tier"""
    
    def test_get_settings_returns_branding_and_cost_analytics(self, pro_admin_token):
        """GET /api/tenant/settings returns branding and cost_analytics sections"""
        response = requests.get(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify branding section
        assert "branding" in data
        assert "logo_url" in data["branding"]
        assert "primary_color" in data["branding"]
        assert "enabled" in data["branding"]
        assert data["branding"]["enabled"] == True  # Professional tier has custom_branding
        
        # Verify cost_analytics section
        assert "cost_analytics" in data
        assert "mileage_rate" in data["cost_analytics"]
        assert "fuel_cost_per_km" in data["cost_analytics"]
        assert "maintenance_cost_per_km" in data["cost_analytics"]
        assert "currency" in data["cost_analytics"]
        assert "distance_unit" in data["cost_analytics"]
        assert "enabled" in data["cost_analytics"]
        assert data["cost_analytics"]["enabled"] == True  # Professional tier has cost_analytics
    
    def test_update_settings_saves_values(self, pro_admin_token):
        """PUT /api/tenant/settings saves and returns updated values"""
        update_data = {
            "mileage_rate": 0.50,
            "fuel_cost_per_km": 0.18,
            "maintenance_cost_per_km": 0.12,
            "currency": "EUR",
            "distance_unit": "km",
            "logo_url": "https://test.com/logo.png",
            "primary_color": "#9333ea"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"},
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Settings updated successfully"
        assert "settings" in data
        
        # Verify branding was updated
        assert data["settings"]["branding"]["logo_url"] == "https://test.com/logo.png"
        assert data["settings"]["branding"]["primary_color"] == "#9333ea"
        
        # Verify cost_analytics was updated
        assert data["settings"]["cost_analytics"]["mileage_rate"] == 0.50
        assert data["settings"]["cost_analytics"]["fuel_cost_per_km"] == 0.18
        assert data["settings"]["cost_analytics"]["maintenance_cost_per_km"] == 0.12
    
    def test_get_settings_reflects_updates(self, pro_admin_token):
        """GET /api/tenant/settings returns previously saved values"""
        response = requests.get(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Values should reflect the update from previous test
        assert data["cost_analytics"]["mileage_rate"] == 0.50
        assert data["branding"]["logo_url"] == "https://test.com/logo.png"


class TestQRCodeEndpoint:
    """Test QR code generation endpoint"""
    
    def test_qr_code_returns_png_image(self, pro_admin_token):
        """GET /api/vehicles/{id}/qr returns valid PNG image"""
        # First get a vehicle ID
        vehicles_response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert vehicles_response.status_code == 200
        vehicles = vehicles_response.json()
        assert len(vehicles) > 0, "No vehicles found for testing"
        
        vehicle_id = vehicles[0]["id"]
        
        # Test QR code endpoint
        qr_response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/qr",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        
        assert qr_response.status_code == 200
        assert qr_response.headers.get("content-type") == "image/png"
        assert len(qr_response.content) > 100  # Should have some content
        
        # Verify PNG magic bytes
        assert qr_response.content[:8] == b'\x89PNG\r\n\x1a\n', "Response is not a valid PNG"


class TestBookingManagement:
    """Test booking CRUD operations"""
    
    def test_get_bookings_returns_list(self, pro_admin_token):
        """GET /api/bookings returns list of bookings"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
    
    def test_update_booking_status(self, pro_admin_token):
        """PUT /api/bookings/{id} updates booking status"""
        # Get existing booking
        bookings_response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        if len(bookings) == 0:
            pytest.skip("No bookings available for testing")
        
        booking_id = bookings[0]["id"]
        
        # Update booking
        update_response = requests.put(
            f"{BASE_URL}/api/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {pro_admin_token}"},
            json={"status": "confirmed"}
        )
        
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["status"] == "confirmed"
        assert updated["id"] == booking_id


class TestPlanFeatures:
    """Test plan features and api_access removal"""
    
    def test_my_plan_returns_professional_features(self, pro_admin_token):
        """GET /api/my-plan returns Professional tier features"""
        response = requests.get(
            f"{BASE_URL}/api/my-plan",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify plan info
        assert data["plan"]["name"] == "Quick Wing Professional"
        
        # Verify Professional tier features
        features = data["features"]
        assert features["custom_branding"] == True
        assert features["cost_analytics"] == True
        assert features["detailed_reports"] == True
        assert features["multi_location_support"] == True
        assert features["priority_support"] == True
        
        # Verify api_access is NOT in features (was removed)
        assert "api_access" not in features, "api_access should be removed from features"
    
    def test_platform_plans_no_api_access(self, super_admin_token):
        """GET /api/platform/plans should not include api_access feature"""
        response = requests.get(
            f"{BASE_URL}/api/platform/plans",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        plans = response.json()
        
        for plan in plans:
            features = plan.get("features", {})
            assert "api_access" not in features, f"api_access found in {plan['name']} plan"


class TestCostAnalyticsFeature:
    """Test cost analytics specific functionality"""
    
    def test_cost_analytics_enabled_for_professional(self, pro_admin_token):
        """Professional tier should have cost_analytics enabled"""
        response = requests.get(
            f"{BASE_URL}/api/my-plan",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["features"]["cost_analytics"] == True
    
    def test_settings_cost_analytics_configurable(self, pro_admin_token):
        """Cost analytics settings should be configurable"""
        # Update with specific values
        update_data = {
            "mileage_rate": 0.35,
            "fuel_cost_per_km": 0.12,
            "maintenance_cost_per_km": 0.08,
            "currency": "EUR",
            "distance_unit": "km"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"},
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify values were saved
        get_response = requests.get(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["cost_analytics"]["mileage_rate"] == 0.35
        assert data["cost_analytics"]["currency"] == "EUR"
        assert data["cost_analytics"]["distance_unit"] == "km"


class TestCustomBrandingFeature:
    """Test custom branding specific functionality"""
    
    def test_custom_branding_enabled_for_professional(self, pro_admin_token):
        """Professional tier should have custom_branding enabled"""
        response = requests.get(
            f"{BASE_URL}/api/my-plan",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["features"]["custom_branding"] == True
    
    def test_branding_settings_configurable(self, pro_admin_token):
        """Branding settings should be configurable"""
        update_data = {
            "logo_url": "https://example.com/brand-logo.png",
            "primary_color": "#7c3aed"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"},
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify values were saved
        get_response = requests.get(
            f"{BASE_URL}/api/tenant/settings",
            headers={"Authorization": f"Bearer {pro_admin_token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["branding"]["logo_url"] == "https://example.com/brand-logo.png"
        assert data["branding"]["primary_color"] == "#7c3aed"
