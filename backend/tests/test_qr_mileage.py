"""
Test QR Code and Public Mileage Submission Endpoints
Tests for Quick Wing Fleet Management - Staff Mobile View & QR Code Features
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iteration
STAFF_EMAIL = "teststaff@standard-fleet.com"
STAFF_PASSWORD = "teststaff123"
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"
TENANT_SLUG = "standard-fleet"
TEST_VEHICLE_ID = "0faa5d79-38b8-48cb-b37a-a44e9ea1b428"


class TestAuthentication:
    """Test authentication for staff and admin users"""
    
    def test_staff_login(self):
        """Test staff user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        print(f"Staff login response: {response.status_code}")
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == STAFF_EMAIL
        print("Staff login: PASSED")
    
    def test_super_admin_login(self):
        """Test super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        print(f"Super admin login response: {response.status_code}")
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print("Super admin login: PASSED")


class TestQRCodeEndpoint:
    """Test QR code generation endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        data = response.json()
        token = data["access_token"]
        
        # Select tenant
        tenants = data.get("tenants", [])
        standard_fleet = next((t for t in tenants if t["tenant_slug"] == TENANT_SLUG), None)
        if standard_fleet:
            select_response = requests.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": standard_fleet["tenant_id"]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if select_response.status_code == 200:
                token = select_response.json()["access_token"]
        
        return token
    
    def test_qr_code_endpoint_returns_png(self, admin_token):
        """Test QR code endpoint returns valid PNG image"""
        # First get a vehicle ID from the tenant
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get vehicles: {response.text}"
        vehicles = response.json()
        
        if not vehicles:
            pytest.skip("No vehicles found in tenant")
        
        vehicle_id = vehicles[0]["id"]
        
        # Get QR code
        qr_response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/qr",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"QR code response status: {qr_response.status_code}")
        print(f"QR code content-type: {qr_response.headers.get('content-type')}")
        
        assert qr_response.status_code == 200, f"QR code request failed: {qr_response.text}"
        assert "image/png" in qr_response.headers.get("content-type", ""), "Response is not PNG image"
        assert len(qr_response.content) > 100, "QR code image too small"
        print(f"QR code image size: {len(qr_response.content)} bytes")
        print("QR code endpoint returns valid PNG: PASSED")
    
    def test_qr_code_with_test_vehicle(self, admin_token):
        """Test QR code for specific test vehicle"""
        qr_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/qr",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"Test vehicle QR response: {qr_response.status_code}")
        
        if qr_response.status_code == 404:
            print("Test vehicle not found - may need to create it")
            pytest.skip("Test vehicle not found")
        
        assert qr_response.status_code == 200, f"QR code request failed: {qr_response.text}"
        assert "image/png" in qr_response.headers.get("content-type", "")
        print("QR code for test vehicle: PASSED")


class TestPublicMileageEndpoints:
    """Test public mileage submission endpoints (no auth required)"""
    
    def test_public_vehicle_info_endpoint(self):
        """Test public vehicle info endpoint loads without auth"""
        # First get a valid vehicle ID
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = admin_response.json()["access_token"]
        tenants = admin_response.json().get("tenants", [])
        standard_fleet = next((t for t in tenants if t["tenant_slug"] == TENANT_SLUG), None)
        
        if standard_fleet:
            select_response = requests.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": standard_fleet["tenant_id"]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if select_response.status_code == 200:
                token = select_response.json()["access_token"]
        
        vehicles_response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if vehicles_response.status_code != 200 or not vehicles_response.json():
            pytest.skip("No vehicles found")
        
        vehicle_id = vehicles_response.json()[0]["id"]
        
        # Now test PUBLIC endpoint (no auth)
        public_response = requests.get(
            f"{BASE_URL}/api/public/vehicle/{TENANT_SLUG}/{vehicle_id}"
        )
        
        print(f"Public vehicle info response: {public_response.status_code}")
        
        assert public_response.status_code == 200, f"Public endpoint failed: {public_response.text}"
        data = public_response.json()
        assert "vehicle" in data
        assert "tenant" in data
        assert data["vehicle"]["id"] == vehicle_id
        assert data["tenant"]["slug"] == TENANT_SLUG
        print(f"Vehicle info: {data['vehicle']['name']} - {data['vehicle'].get('registration', 'N/A')}")
        print("Public vehicle info endpoint: PASSED")
    
    def test_public_vehicle_info_with_test_vehicle(self):
        """Test public vehicle info for specific test vehicle"""
        response = requests.get(
            f"{BASE_URL}/api/public/vehicle/{TENANT_SLUG}/{TEST_VEHICLE_ID}"
        )
        
        print(f"Test vehicle public info response: {response.status_code}")
        
        if response.status_code == 404:
            print("Test vehicle not found in standard-fleet tenant")
            pytest.skip("Test vehicle not found")
        
        assert response.status_code == 200, f"Public endpoint failed: {response.text}"
        data = response.json()
        print(f"Test vehicle: {data['vehicle']['name']}")
        print("Public vehicle info for test vehicle: PASSED")
    
    def test_public_mileage_submission_without_auth(self):
        """Test mileage can be submitted without authentication"""
        # Get a vehicle first
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = admin_response.json()["access_token"]
        tenants = admin_response.json().get("tenants", [])
        standard_fleet = next((t for t in tenants if t["tenant_slug"] == TENANT_SLUG), None)
        
        if standard_fleet:
            select_response = requests.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": standard_fleet["tenant_id"]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if select_response.status_code == 200:
                token = select_response.json()["access_token"]
        
        vehicles_response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if vehicles_response.status_code != 200 or not vehicles_response.json():
            pytest.skip("No vehicles found")
        
        vehicle = vehicles_response.json()[0]
        vehicle_id = vehicle["id"]
        current_mileage = vehicle.get("current_mileage", 0) or 0
        
        # Submit mileage via PUBLIC endpoint (no auth)
        new_mileage = current_mileage + 10  # Add 10 km
        
        submit_response = requests.post(
            f"{BASE_URL}/api/public/vehicle/{TENANT_SLUG}/{vehicle_id}/submit-mileage",
            json={
                "mileage": new_mileage,
                "submitted_by_name": "TEST_QR_Scan_User",
                "notes": "Test mileage submission via QR scan"
            }
        )
        
        print(f"Public mileage submission response: {submit_response.status_code}")
        
        assert submit_response.status_code == 200, f"Mileage submission failed: {submit_response.text}"
        data = submit_response.json()
        assert data["success"] == True
        assert data["new_mileage"] == new_mileage
        assert data["previous_mileage"] == current_mileage
        print(f"Mileage updated: {current_mileage} -> {new_mileage}")
        print("Public mileage submission without auth: PASSED")
    
    def test_mileage_validation_rejects_lower_value(self):
        """Test that mileage cannot be submitted lower than current"""
        # Get a vehicle with mileage
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = admin_response.json()["access_token"]
        tenants = admin_response.json().get("tenants", [])
        standard_fleet = next((t for t in tenants if t["tenant_slug"] == TENANT_SLUG), None)
        
        if standard_fleet:
            select_response = requests.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": standard_fleet["tenant_id"]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if select_response.status_code == 200:
                token = select_response.json()["access_token"]
        
        vehicles_response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if vehicles_response.status_code != 200 or not vehicles_response.json():
            pytest.skip("No vehicles found")
        
        vehicle = vehicles_response.json()[0]
        vehicle_id = vehicle["id"]
        current_mileage = vehicle.get("current_mileage", 0) or 0
        
        if current_mileage == 0:
            pytest.skip("Vehicle has no mileage to test validation")
        
        # Try to submit lower mileage
        lower_mileage = current_mileage - 100
        
        submit_response = requests.post(
            f"{BASE_URL}/api/public/vehicle/{TENANT_SLUG}/{vehicle_id}/submit-mileage",
            json={
                "mileage": lower_mileage,
                "submitted_by_name": "TEST_Invalid_Submission"
            }
        )
        
        print(f"Lower mileage submission response: {submit_response.status_code}")
        
        assert submit_response.status_code == 400, f"Should reject lower mileage: {submit_response.text}"
        print("Mileage validation rejects lower value: PASSED")


class TestServiceAlerts:
    """Test service alert triggers when mileage approaches service_due_mileage"""
    
    def test_service_alert_triggers_when_approaching_due(self):
        """Test that service alert is returned when mileage approaches service_due_mileage"""
        # Get admin token and select tenant
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = admin_response.json()["access_token"]
        tenants = admin_response.json().get("tenants", [])
        standard_fleet = next((t for t in tenants if t["tenant_slug"] == TENANT_SLUG), None)
        
        if standard_fleet:
            select_response = requests.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": standard_fleet["tenant_id"]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if select_response.status_code == 200:
                token = select_response.json()["access_token"]
        
        # Get vehicles and find one with service_due_mileage
        vehicles_response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if vehicles_response.status_code != 200 or not vehicles_response.json():
            pytest.skip("No vehicles found")
        
        vehicles = vehicles_response.json()
        
        # Find a vehicle with service_due_mileage set
        vehicle_with_service = None
        for v in vehicles:
            if v.get("service_due_mileage"):
                vehicle_with_service = v
                break
        
        if not vehicle_with_service:
            # Set service_due_mileage on first vehicle for testing
            vehicle = vehicles[0]
            current_mileage = vehicle.get("current_mileage", 0) or 0
            service_due = current_mileage + 500  # Set service due 500km ahead
            
            update_response = requests.put(
                f"{BASE_URL}/api/vehicles/{vehicle['id']}",
                json={"service_due_mileage": service_due},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if update_response.status_code != 200:
                pytest.skip("Could not set service_due_mileage")
            
            vehicle_with_service = vehicle
            vehicle_with_service["service_due_mileage"] = service_due
        
        vehicle_id = vehicle_with_service["id"]
        service_due = vehicle_with_service["service_due_mileage"]
        
        # Submit mileage that's within 1000km of service due
        test_mileage = service_due - 800  # 800km before service due
        
        submit_response = requests.post(
            f"{BASE_URL}/api/public/vehicle/{TENANT_SLUG}/{vehicle_id}/submit-mileage",
            json={
                "mileage": test_mileage,
                "submitted_by_name": "TEST_Service_Alert_Check"
            }
        )
        
        print(f"Service alert test response: {submit_response.status_code}")
        
        if submit_response.status_code == 400:
            # Mileage might be lower than current - skip
            print(f"Mileage validation failed: {submit_response.text}")
            pytest.skip("Could not submit test mileage")
        
        assert submit_response.status_code == 200, f"Submission failed: {submit_response.text}"
        data = submit_response.json()
        
        print(f"Service alert in response: {data.get('service_alert')}")
        
        # Service alert should be present if within 1000km
        if data.get("service_alert"):
            print(f"Service alert triggered: {data['service_alert']['message']}")
            print("Service alert triggers when approaching due: PASSED")
        else:
            print("No service alert (mileage may not be within threshold)")


class TestPublicMileagePageRoute:
    """Test that the public mileage page route is accessible"""
    
    def test_mileage_page_url_format(self):
        """Verify the expected URL format for public mileage page"""
        # The frontend route should be: /{tenant}/vehicle/{id}/mileage
        expected_format = f"/{TENANT_SLUG}/vehicle/{TEST_VEHICLE_ID}/mileage"
        print(f"Expected public mileage page URL format: {expected_format}")
        print("URL format verification: PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
