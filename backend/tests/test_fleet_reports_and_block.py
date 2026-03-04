"""
Test Fleet Reports, Block/Unblock Vehicle, and Service Alert Features
Tests for Quick Wing Fleet Management - Multi-Tenant SaaS Platform

Features tested:
1. Fleet Reports endpoint GET /api/tenant/fleet-reports
2. Fleet Reports CSV export GET /api/tenant/fleet-reports/csv
3. Block vehicle POST /api/vehicles/{id}/block
4. Unblock vehicle POST /api/vehicles/{id}/unblock
5. Service Alert in scan-update response
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin.test-franchise@quickwing.com"
ADMIN_PASSWORD = "JF7mIdG60wiV"

# Test vehicle ID (VW Golf with service_due_mileage=13000, current_mileage=12600)
TEST_VEHICLE_ID = "11ed37f9-4474-4ae5-b727-92f881cf78c1"


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_admin_login(self, admin_token):
        """Test admin login returns valid token"""
        assert admin_token is not None
        assert len(admin_token) > 0


class TestFleetReports:
    """Fleet Reports endpoint tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_fleet_reports_endpoint(self, admin_token):
        """Test GET /api/tenant/fleet-reports returns expected structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tenant/fleet-reports", headers=headers)
        
        assert response.status_code == 200, f"Fleet reports failed: {response.text}"
        data = response.json()
        
        # Verify summary stats
        assert "summary" in data
        summary = data["summary"]
        assert "total_vehicles" in summary
        assert "total_bookings" in summary
        assert "pending_bookings" in summary
        assert "blocked_cars" in summary
        assert isinstance(summary["total_vehicles"], int)
        assert isinstance(summary["total_bookings"], int)
        
        # Verify most_booked_cars
        assert "most_booked_cars" in data
        assert isinstance(data["most_booked_cars"], list)
        if len(data["most_booked_cars"]) > 0:
            car = data["most_booked_cars"][0]
            assert "id" in car
            assert "name" in car
            assert "registration" in car
            assert "bookings" in car
        
        # Verify daily_availability
        assert "daily_availability" in data
        daily = data["daily_availability"]
        assert "date" in daily
        assert "total_fleet" in daily
        assert "fully_free" in daily
        assert "partially_free" in daily
        assert "fully_booked" in daily
        
        # Verify location_summary
        assert "location_summary" in data
        assert isinstance(data["location_summary"], list)
        if len(data["location_summary"]) > 0:
            loc = data["location_summary"][0]
            assert "location" in loc
            assert "total" in loc
            assert "utilization" in loc
        
        print(f"Fleet reports: {summary['total_vehicles']} vehicles, {summary['total_bookings']} bookings, {summary['blocked_cars']} blocked")
    
    def test_fleet_reports_with_date_filter(self, admin_token):
        """Test fleet reports with date filters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/tenant/fleet-reports?from_date=2024-01-01&to_date=2026-12-31",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "most_booked_cars" in data
    
    def test_fleet_reports_csv_export(self, admin_token):
        """Test GET /api/tenant/fleet-reports/csv returns CSV file"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tenant/fleet-reports/csv", headers=headers)
        
        assert response.status_code == 200, f"CSV export failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type or "text/plain" in content_type, f"Unexpected content type: {content_type}"
        
        # Check CSV content
        csv_content = response.text
        assert "Fleet Report" in csv_content
        assert "Summary" in csv_content
        assert "Total Vehicles" in csv_content
        assert "Vehicle Details" in csv_content
        
        print(f"CSV export successful, {len(csv_content)} bytes")
    
    def test_fleet_reports_requires_auth(self):
        """Test fleet reports requires authentication"""
        response = requests.get(f"{BASE_URL}/api/tenant/fleet-reports")
        assert response.status_code in [401, 403]


class TestBlockUnblockVehicle:
    """Block and Unblock vehicle endpoint tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_block_vehicle_for_service(self, admin_token):
        """Test POST /api/vehicles/{id}/block with Service reason"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First ensure vehicle is unblocked
        requests.post(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/unblock", headers=headers)
        
        # Block for Service
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/block",
            headers=headers,
            json={"reason": "Service", "notes": "Scheduled maintenance"}
        )
        
        assert response.status_code == 200, f"Block failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "Service" in data["message"]
        assert "vehicle" in data
        
        vehicle = data["vehicle"]
        assert vehicle["is_blocked"] == True
        assert vehicle["blocked_reason"] == "Service"
        assert vehicle["blocked_notes"] == "Scheduled maintenance"
        assert "blocked_by" in vehicle
        assert "blocked_at" in vehicle
        
        print(f"Vehicle blocked for Service: {vehicle['name']}")
    
    def test_block_already_blocked_vehicle(self, admin_token):
        """Test blocking an already blocked vehicle returns 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to block again
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/block",
            headers=headers,
            json={"reason": "Cleaning"}
        )
        
        assert response.status_code == 400
        assert "already blocked" in response.json().get("detail", "").lower()
    
    def test_unblock_vehicle(self, admin_token):
        """Test POST /api/vehicles/{id}/unblock"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/unblock",
            headers=headers
        )
        
        assert response.status_code == 200, f"Unblock failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "unblocked" in data["message"].lower()
        assert "vehicle" in data
        
        vehicle = data["vehicle"]
        assert vehicle["is_blocked"] == False
        assert vehicle["blocked_reason"] is None
        assert vehicle["current_status"] == "Free"
        
        print(f"Vehicle unblocked: {vehicle['name']}")
    
    def test_unblock_not_blocked_vehicle(self, admin_token):
        """Test unblocking a vehicle that is not blocked returns 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/unblock",
            headers=headers
        )
        
        assert response.status_code == 400
        assert "not blocked" in response.json().get("detail", "").lower()
    
    def test_block_vehicle_for_cleaning(self, admin_token):
        """Test blocking vehicle for Cleaning"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/block",
            headers=headers,
            json={"reason": "Cleaning", "notes": "Deep clean required"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["blocked_reason"] == "Cleaning"
        
        # Unblock for next test
        requests.post(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/unblock", headers=headers)
    
    def test_block_vehicle_for_other(self, admin_token):
        """Test blocking vehicle for Other reason"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/block",
            headers=headers,
            json={"reason": "Other", "notes": "Insurance inspection"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle"]["blocked_reason"] == "Other"
        
        # Unblock for next test
        requests.post(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/unblock", headers=headers)
    
    def test_block_requires_admin(self):
        """Test block endpoint requires admin authentication"""
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/block",
            json={"reason": "Service"}
        )
        assert response.status_code in [401, 403]
    
    def test_block_invalid_vehicle(self, admin_token):
        """Test blocking non-existent vehicle returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/invalid-vehicle-id/block",
            headers=headers,
            json={"reason": "Service"}
        )
        
        assert response.status_code == 404


class TestServiceAlert:
    """Service Alert in scan-update response tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_service_alert_warning(self, admin_token):
        """Test service alert when mileage approaches service_due_mileage (within 1000km)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # VW Golf has service_due_mileage=13000
        # Set mileage to 12600 (400km remaining - should trigger urgent alert)
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            headers=headers,
            json={
                "current_status": "Free",
                "current_mileage": 12600
            }
        )
        
        assert response.status_code == 200, f"Scan update failed: {response.text}"
        data = response.json()
        
        # Should have service_alert in response
        assert "service_alert" in data, "Service alert not in response"
        alert = data["service_alert"]
        
        assert "type" in alert
        assert alert["type"] in ["warning", "urgent", "overdue"]
        assert "message" in alert
        assert "remaining_km" in alert
        
        print(f"Service alert: {alert['type']} - {alert['message']}")
    
    def test_service_alert_urgent(self, admin_token):
        """Test urgent service alert when mileage is within 500km of service due"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Set mileage to 12700 (300km remaining - should trigger urgent alert)
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            headers=headers,
            json={
                "current_status": "Free",
                "current_mileage": 12700
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "service_alert" in data
        alert = data["service_alert"]
        assert alert["type"] == "urgent"
        assert alert["remaining_km"] == 300
        
        print(f"Urgent alert: {alert['message']}")
    
    def test_service_alert_overdue(self, admin_token):
        """Test overdue service alert when mileage exceeds service_due_mileage"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Set mileage to 13500 (500km past service due)
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            headers=headers,
            json={
                "current_status": "Free",
                "current_mileage": 13500
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "service_alert" in data
        alert = data["service_alert"]
        assert alert["type"] == "overdue"
        assert alert["remaining_km"] == -500
        assert "OVERDUE" in alert["message"]
        
        print(f"Overdue alert: {alert['message']}")
    
    def test_no_service_alert_when_far_from_due(self, admin_token):
        """Test no service alert when mileage is far from service_due_mileage"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Set mileage to 10000 (3000km remaining - no alert)
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            headers=headers,
            json={
                "current_status": "Free",
                "current_mileage": 10000
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should NOT have service_alert
        assert "service_alert" not in data or data.get("service_alert") is None
        
        print("No service alert when far from due (as expected)")
    
    def test_reset_vehicle_mileage(self, admin_token):
        """Reset vehicle mileage to original value for other tests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/scan-update",
            headers=headers,
            json={
                "current_status": "Free",
                "current_mileage": 12600
            }
        )
        
        assert response.status_code == 200
        print("Vehicle mileage reset to 12600 km")


class TestVehicleDetails:
    """Test vehicle details include all required fields"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_vehicle_has_all_fields(self, admin_token):
        """Test vehicle response includes mileage, service_due, tax, nct, location"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}", headers=headers)
        
        assert response.status_code == 200, f"Get vehicle failed: {response.text}"
        vehicle = response.json()
        
        # Check required fields
        assert "id" in vehicle
        assert "name" in vehicle
        assert "registration" in vehicle
        assert "current_status" in vehicle
        
        # Check enhanced fields
        assert "current_mileage" in vehicle
        assert "service_due_mileage" in vehicle
        assert "tax_due_date" in vehicle
        assert "base_location" in vehicle
        
        # Check block-related fields
        assert "is_blocked" in vehicle
        
        print(f"Vehicle {vehicle['name']}: mileage={vehicle.get('current_mileage')}, service_due={vehicle.get('service_due_mileage')}, location={vehicle.get('base_location')}")


class TestBlockedVehicleInReports:
    """Test blocked vehicles appear correctly in fleet reports"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_blocked_vehicle_counted_in_reports(self, admin_token):
        """Test blocked vehicles are counted in fleet reports summary"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Block the vehicle
        requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/block",
            headers=headers,
            json={"reason": "Service"}
        )
        
        # Get fleet reports
        response = requests.get(f"{BASE_URL}/api/tenant/fleet-reports", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["summary"]["blocked_cars"] >= 1
        
        print(f"Blocked cars in report: {data['summary']['blocked_cars']}")
        
        # Unblock for cleanup
        requests.post(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/unblock", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
