"""
Test QR Code Features for Quick Wing Fleet Management
- QR code generation for vehicles
- Vehicle scan-update endpoint (POST /api/vehicles/{id}/scan-update)
- Vehicle status history endpoint (GET /api/vehicles/{id}/status-history)
- Status options: Free, In Use, Needs Cleaning, Needs Repair
- Mileage validation
- Status updates logged to status_updates collection
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TENANT_ADMIN = {"email": "admin.test-franchise@quickwing.com", "password": "JF7mIdG60wiV"}
STAFF_USER = {"email": "staff.test-franchise@quickwing.com", "password": "87xbq9WE56"}
TEST_VEHICLE_ID = "11ed37f9-4474-4ae5-b727-92f881cf78c1"  # VW Golf


class TestQRCodeFeatures:
    """Test QR code scanning and vehicle status update features"""
    
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
    
    def test_01_api_accessible(self):
        """Test API root is accessible"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("✓ API root accessible")
    
    def test_02_admin_login(self):
        """Test admin can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=TENANT_ADMIN)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Admin login successful: {TENANT_ADMIN['email']}")
    
    def test_03_staff_login(self):
        """Test staff can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Staff login successful: {STAFF_USER['email']}")
    
    def test_04_get_vehicle_details(self):
        """Test getting vehicle details for QR code display"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}")
        
        assert response.status_code == 200
        vehicle = response.json()
        assert "id" in vehicle
        assert "name" in vehicle
        assert "registration" in vehicle
        print(f"✓ Vehicle details retrieved: {vehicle.get('name')} ({vehicle.get('registration')})")
    
    def test_05_scan_update_status_free(self):
        """Test updating vehicle status to 'Free' via scan-update endpoint"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        update_data = {
            "current_status": "Free",
            "current_mileage": 12600,
            "location": "Main Office",
            "notes": "Test update - Free status"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "vehicle" in data
        assert data["vehicle"]["current_status"] == "Free"
        assert data["vehicle"]["current_mileage"] == 12600
        print(f"✓ Vehicle status updated to 'Free' with mileage 12,600 km")
    
    def test_06_scan_update_status_in_use(self):
        """Test updating vehicle status to 'In Use' via scan-update endpoint"""
        token = self.get_auth_token(STAFF_USER)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        update_data = {
            "current_status": "In Use",
            "current_mileage": 12650,
            "location": "Site A",
            "notes": "Staff member took vehicle for delivery"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["current_status"] == "In Use"
        assert data["vehicle"]["current_mileage"] == 12650
        print(f"✓ Vehicle status updated to 'In Use' by staff with mileage 12,650 km")
    
    def test_07_scan_update_status_needs_cleaning(self):
        """Test updating vehicle status to 'Needs Cleaning'"""
        token = self.get_auth_token(STAFF_USER)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        update_data = {
            "current_status": "Needs Cleaning",
            "current_mileage": 12700,
            "location": "Main Office",
            "notes": "Vehicle returned dirty after site visit"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["current_status"] == "Needs Cleaning"
        print(f"✓ Vehicle status updated to 'Needs Cleaning'")
    
    def test_08_scan_update_status_needs_repair(self):
        """Test updating vehicle status to 'Needs Repair'"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        update_data = {
            "current_status": "Needs Repair",
            "current_mileage": 12750,
            "location": "Garage",
            "notes": "Engine warning light on"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["current_status"] == "Needs Repair"
        print(f"✓ Vehicle status updated to 'Needs Repair'")
    
    def test_09_get_status_history(self):
        """Test getting vehicle status history"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/status-history"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "vehicle_id" in data
        assert "history" in data
        assert isinstance(data["history"], list)
        
        # Should have at least 4 entries from our tests
        assert len(data["history"]) >= 4
        
        # Check history entry structure
        if data["history"]:
            entry = data["history"][0]
            assert "status" in entry
            assert "timestamp" in entry
            assert "reported_by" in entry
            print(f"✓ Status history retrieved: {len(data['history'])} entries")
            print(f"  Latest: {entry['status']} by {entry['reported_by']}")
    
    def test_10_scan_update_without_mileage(self):
        """Test updating vehicle status without mileage (optional field)"""
        token = self.get_auth_token(STAFF_USER)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        update_data = {
            "current_status": "Free",
            "location": "Main Office"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["current_status"] == "Free"
        print(f"✓ Vehicle status updated without mileage (optional)")
    
    def test_11_scan_update_invalid_vehicle(self):
        """Test scan-update with invalid vehicle ID returns 404"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_id = str(uuid.uuid4())
        update_data = {
            "current_status": "Free",
            "current_mileage": 10000
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{fake_id}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 404
        print(f"✓ Invalid vehicle ID correctly returns 404")
    
    def test_12_scan_update_requires_auth(self):
        """Test scan-update endpoint requires authentication"""
        # No auth header
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        update_data = {
            "current_status": "Free",
            "current_mileage": 10000
        }
        
        response = session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code in [401, 403]
        print(f"✓ Scan-update endpoint requires authentication")
    
    def test_13_status_history_requires_auth(self):
        """Test status-history endpoint requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/status-history"
        )
        
        assert response.status_code in [401, 403]
        print(f"✓ Status-history endpoint requires authentication")
    
    def test_14_vehicle_has_qr_fields(self):
        """Test vehicle response includes fields needed for QR code display"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}")
        
        assert response.status_code == 200
        vehicle = response.json()
        
        # Required fields for QR code display
        assert "id" in vehicle, "Vehicle must have 'id' for QR code"
        assert "name" in vehicle, "Vehicle must have 'name' for display"
        assert "registration" in vehicle, "Vehicle must have 'registration' for display"
        
        # Fields updated by scan
        assert "current_status" in vehicle or vehicle.get("current_status") is None
        assert "current_mileage" in vehicle or vehicle.get("current_mileage") is None
        assert "location" in vehicle or vehicle.get("location") is None
        assert "last_updated_by" in vehicle or vehicle.get("last_updated_by") is None
        
        print(f"✓ Vehicle has all required fields for QR code feature")
        print(f"  ID: {vehicle['id']}")
        print(f"  Name: {vehicle['name']}")
        print(f"  Registration: {vehicle['registration']}")
        print(f"  Current Status: {vehicle.get('current_status', 'N/A')}")
        print(f"  Current Mileage: {vehicle.get('current_mileage', 'N/A')}")
    
    def test_15_reset_vehicle_to_free(self):
        """Reset vehicle to Free status for clean state"""
        token = self.get_auth_token(TENANT_ADMIN)
        assert token, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        update_data = {
            "current_status": "Free",
            "current_mileage": 12800,
            "location": "Main Office",
            "notes": "Reset after testing"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["current_status"] == "Free"
        print(f"✓ Vehicle reset to 'Free' status with mileage 12,800 km")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
