"""
Test cases for Staff Location Map feature
Tests the location tracking API endpoints:
- POST /api/location/update - Staff updates their location
- POST /api/location/stop-sharing - Staff stops sharing location
- GET /api/location/my-status - Get current user's sharing status
- GET /api/admin/staff-locations - Admin gets all staff locations
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"email": "admin@quickwing.com", "password": "admin123"}
STAFF_CREDENTIALS = {"email": "staff@quickwing.com", "password": "staff123"}
MASTER_ADMIN_CREDENTIALS = {"email": "carlyodonovan@bluebirdcare.ie", "password": "carly123"}


class TestLocationAPI:
    """Staff Location Map API tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def staff_token(self):
        """Get staff authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Staff authentication failed")
    
    @pytest.fixture(scope="class")
    def master_admin_token(self):
        """Get master admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Master admin authentication failed")
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_staff_login(self):
        """Test staff can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_CREDENTIALS)
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "staff"
        print(f"✓ Staff login successful: {data['user']['email']}")
    
    def test_staff_update_location(self, staff_token):
        """Test staff can update their location"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": 52.0588,
            "longitude": -9.5072,
            "accuracy": 10.5,
            "heading": 180.0,
            "speed": 5.0
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=headers
        )
        assert response.status_code == 200, f"Location update failed: {response.text}"
        data = response.json()
        assert data["message"] == "Location updated successfully"
        print(f"✓ Staff location updated: lat={location_data['latitude']}, lng={location_data['longitude']}")
    
    def test_staff_get_my_status(self, staff_token):
        """Test staff can get their location sharing status"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(
            f"{BASE_URL}/api/location/my-status",
            headers=headers
        )
        assert response.status_code == 200, f"Get status failed: {response.text}"
        data = response.json()
        assert "is_sharing" in data
        assert "last_updated" in data
        print(f"✓ Staff location status: is_sharing={data['is_sharing']}, last_updated={data['last_updated']}")
    
    def test_admin_get_staff_locations(self, admin_token):
        """Test admin can get all staff locations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/staff-locations",
            headers=headers
        )
        assert response.status_code == 200, f"Get staff locations failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "active_locations" in data
        assert "inactive_users" in data
        assert "total_active" in data
        assert "total_inactive" in data
        
        print(f"✓ Admin got staff locations: {data['total_active']} active, {data['total_inactive']} inactive")
        
        # Verify active locations have required fields
        if data['active_locations']:
            loc = data['active_locations'][0]
            assert "user_id" in loc
            assert "user_email" in loc
            assert "user_name" in loc
            assert "latitude" in loc
            assert "longitude" in loc
            assert "is_sharing" in loc
            print(f"  - Active location sample: {loc['user_name']} at ({loc['latitude']}, {loc['longitude']})")
    
    def test_staff_stop_sharing(self, staff_token):
        """Test staff can stop sharing their location"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.post(
            f"{BASE_URL}/api/location/stop-sharing",
            headers=headers
        )
        assert response.status_code == 200, f"Stop sharing failed: {response.text}"
        data = response.json()
        assert data["message"] == "Location sharing stopped"
        print("✓ Staff stopped location sharing")
    
    def test_staff_status_after_stop(self, staff_token):
        """Test staff status shows not sharing after stop"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(
            f"{BASE_URL}/api/location/my-status",
            headers=headers
        )
        assert response.status_code == 200, f"Get status failed: {response.text}"
        data = response.json()
        assert data["is_sharing"] == False
        print(f"✓ Staff status confirmed: is_sharing={data['is_sharing']}")
    
    def test_staff_cannot_access_admin_endpoint(self, staff_token):
        """Test staff cannot access admin staff-locations endpoint"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/staff-locations",
            headers=headers
        )
        # Should return 403 Forbidden for non-admin users
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Staff correctly denied access to admin endpoint")
    
    def test_unauthenticated_cannot_update_location(self):
        """Test unauthenticated user cannot update location"""
        location_data = {
            "latitude": 52.0588,
            "longitude": -9.5072
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated user correctly denied location update")
    
    def test_staff_resume_sharing(self, staff_token):
        """Test staff can resume sharing location after stopping"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": 52.1234,
            "longitude": -9.6789,
            "accuracy": 15.0
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=headers
        )
        assert response.status_code == 200, f"Resume sharing failed: {response.text}"
        
        # Verify status is now sharing
        status_response = requests.get(
            f"{BASE_URL}/api/location/my-status",
            headers=headers
        )
        assert status_response.status_code == 200
        data = status_response.json()
        assert data["is_sharing"] == True
        print(f"✓ Staff resumed location sharing: is_sharing={data['is_sharing']}")
    
    def test_admin_sees_active_staff_after_resume(self, admin_token, staff_token):
        """Test admin can see staff in active locations after they resume sharing"""
        # First ensure staff is sharing
        staff_headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": 52.2000,
            "longitude": -9.7000
        }
        requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=staff_headers
        )
        
        # Now check admin view
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/staff-locations",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Staff should be in active locations
        assert data["total_active"] >= 1, "Expected at least 1 active staff member"
        
        # Find staff in active locations
        staff_found = False
        for loc in data["active_locations"]:
            if loc["user_email"] == STAFF_CREDENTIALS["email"]:
                staff_found = True
                assert loc["latitude"] == 52.2000
                assert loc["longitude"] == -9.7000
                print(f"✓ Admin sees staff at ({loc['latitude']}, {loc['longitude']})")
                break
        
        assert staff_found, "Staff not found in active locations"


class TestLocationAPIEdgeCases:
    """Edge case tests for location API"""
    
    @pytest.fixture(scope="class")
    def staff_token(self):
        """Get staff authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Staff authentication failed")
    
    def test_location_update_with_minimal_data(self, staff_token):
        """Test location update with only required fields"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": 52.0000,
            "longitude": -9.0000
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=headers
        )
        assert response.status_code == 200
        print("✓ Location update with minimal data successful")
    
    def test_location_update_with_all_optional_fields(self, staff_token):
        """Test location update with all optional fields"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": 52.0588,
            "longitude": -9.5072,
            "accuracy": 5.0,
            "heading": 90.0,
            "speed": 10.5
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=headers
        )
        assert response.status_code == 200
        print("✓ Location update with all optional fields successful")
    
    def test_location_update_invalid_latitude(self, staff_token):
        """Test location update with invalid latitude (should fail validation)"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": "invalid",
            "longitude": -9.5072
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=headers
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("✓ Invalid latitude correctly rejected")
    
    def test_location_update_missing_required_field(self, staff_token):
        """Test location update with missing required field"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        location_data = {
            "latitude": 52.0588
            # Missing longitude
        }
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json=location_data,
            headers=headers
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("✓ Missing required field correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
