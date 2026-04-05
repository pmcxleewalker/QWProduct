"""
Test Suite for All Cars Calendar and Fleet Map Features
Tests:
1. All Cars Calendar - standardized colors, stats, vehicle filter
2. Fleet Map - tier-gated feature (Essential and Professional only)
3. Booking journey fields - start_eircode, end_eircode, start_address, end_address, journey_stops
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "malcolm@quickwing.com"
SUPER_ADMIN_PASSWORD = "Malcolm123"

# Tenant IDs
STANDARD_TENANT_ID = "e8b95bc8-fadb-41d8-af50-6092a8ed5943"  # Standard Fleet Co
ESSENTIAL_TENANT_ID = "36334c4e-c256-4901-8756-61acfec6cbe9"  # Essential Care Fleet
PROFESSIONAL_TENANT_ID = "ba3ff69d-9847-4c78-93ad-6ba2ee10e76e"  # Professional Transport Group


class TestAuthentication:
    """Test authentication and impersonation"""
    
    def test_super_admin_login(self):
        """Test Super Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Super Admin login successful: {data['user']['email']}")
    
    def test_impersonate_essential_tenant(self):
        """Test impersonating Essential Care Fleet tenant"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Impersonate Essential tenant
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{ESSENTIAL_TENANT_ID}/impersonate",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Impersonation failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["tenant"]["slug"] == "essential-care"
        print(f"✓ Impersonation successful: {data['tenant']['name']}")


class TestPlanFeatures:
    """Test plan features for different tiers"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def get_impersonated_token(self, super_admin_token, tenant_id):
        """Get impersonated token for a tenant"""
        response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{tenant_id}/impersonate",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        return response.json()["access_token"]
    
    def test_standard_tier_no_map_feature(self, super_admin_token):
        """Test that Standard tier does NOT have map features"""
        token = self.get_impersonated_token(super_admin_token, STANDARD_TENANT_ID)
        
        response = requests.get(
            f"{BASE_URL}/api/my-plan",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Standard tier should NOT have show_map or map_booking_pins
        features = data.get("features", {})
        assert features.get("show_map") == False or features.get("show_map") is None, \
            "Standard tier should NOT have show_map feature"
        assert features.get("map_booking_pins") == False or features.get("map_booking_pins") is None, \
            "Standard tier should NOT have map_booking_pins feature"
        print(f"✓ Standard tier correctly does NOT have map features")
    
    def test_essential_tier_has_map_feature(self, super_admin_token):
        """Test that Essential tier HAS map features"""
        token = self.get_impersonated_token(super_admin_token, ESSENTIAL_TENANT_ID)
        
        response = requests.get(
            f"{BASE_URL}/api/my-plan",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Essential tier should have show_map and map_booking_pins
        features = data.get("features", {})
        assert features.get("show_map") == True, "Essential tier should have show_map feature"
        assert features.get("map_booking_pins") == True, "Essential tier should have map_booking_pins feature"
        print(f"✓ Essential tier correctly has map features: show_map={features.get('show_map')}, map_booking_pins={features.get('map_booking_pins')}")
    
    def test_professional_tier_has_map_feature(self, super_admin_token):
        """Test that Professional tier HAS map features"""
        token = self.get_impersonated_token(super_admin_token, PROFESSIONAL_TENANT_ID)
        
        response = requests.get(
            f"{BASE_URL}/api/my-plan",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Professional tier should have show_map and map_booking_pins
        features = data.get("features", {})
        assert features.get("show_map") == True, "Professional tier should have show_map feature"
        assert features.get("map_booking_pins") == True, "Professional tier should have map_booking_pins feature"
        print(f"✓ Professional tier correctly has map features: show_map={features.get('show_map')}, map_booking_pins={features.get('map_booking_pins')}")


class TestBookingJourneyFields:
    """Test booking creation with journey tracking fields"""
    
    @pytest.fixture
    def essential_token(self):
        """Get Essential tenant token via impersonation"""
        # Login as Super Admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        super_token = login_response.json()["access_token"]
        
        # Impersonate Essential tenant
        impersonate_response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{ESSENTIAL_TENANT_ID}/impersonate",
            headers={"Authorization": f"Bearer {super_token}"}
        )
        return impersonate_response.json()["access_token"]
    
    @pytest.fixture
    def essential_vehicle_id(self, essential_token):
        """Get a vehicle ID from Essential tenant"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        vehicles = response.json()
        assert len(vehicles) > 0, "No vehicles found in Essential tenant"
        return vehicles[0]["id"]
    
    def test_create_booking_with_journey_fields(self, essential_token, essential_vehicle_id):
        """Test creating a booking with journey tracking fields"""
        booking_data = {
            "car_id": essential_vehicle_id,
            "user_name": "TEST_Journey_User",
            "start_time": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT09:00:00"),
            "end_time": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT12:00:00"),
            "purpose": "Patient Transport",
            "location": "Dublin",
            "notes": "Test booking with journey data",
            "start_eircode": "D01 F5P2",
            "start_address": "Dublin City Centre",
            "end_eircode": "D04 V2E9",
            "end_address": "Ballsbridge",
            "journey_stops": [
                {"eircode": "D02 XY45", "address": "St Stephens Green", "stop_order": 1}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert response.status_code == 200, f"Booking creation failed: {response.text}"
        
        data = response.json()
        
        # Verify journey fields are saved
        assert data.get("start_eircode") == "D01 F5P2", "start_eircode not saved correctly"
        assert data.get("start_address") == "Dublin City Centre", "start_address not saved correctly"
        assert data.get("end_eircode") == "D04 V2E9", "end_eircode not saved correctly"
        assert data.get("end_address") == "Ballsbridge", "end_address not saved correctly"
        assert data.get("journey_stops") is not None, "journey_stops not saved"
        assert len(data.get("journey_stops", [])) == 1, "journey_stops count incorrect"
        
        print(f"✓ Booking created with journey fields:")
        print(f"  - start_eircode: {data.get('start_eircode')}")
        print(f"  - end_eircode: {data.get('end_eircode')}")
        print(f"  - journey_stops: {len(data.get('journey_stops', []))} stops")
        
        # Store booking ID for cleanup
        return data["id"]
    
    def test_get_booking_with_journey_fields(self, essential_token, essential_vehicle_id):
        """Test that bookings with journey fields can be retrieved"""
        # First create a booking
        booking_data = {
            "car_id": essential_vehicle_id,
            "user_name": "TEST_Journey_Retrieve",
            "start_time": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%dT10:00:00"),
            "end_time": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%dT14:00:00"),
            "start_eircode": "D07 ABC1",
            "end_eircode": "D15 XYZ9"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()["id"]
        
        # Get all bookings and verify journey fields are present
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert response.status_code == 200
        
        bookings = response.json()
        test_booking = next((b for b in bookings if b["id"] == booking_id), None)
        assert test_booking is not None, "Created booking not found in list"
        assert test_booking.get("start_eircode") == "D07 ABC1"
        assert test_booking.get("end_eircode") == "D15 XYZ9"
        
        print(f"✓ Booking retrieved with journey fields intact")
    
    def test_update_booking_journey_fields(self, essential_token, essential_vehicle_id):
        """Test updating booking journey fields"""
        # Create a booking first
        booking_data = {
            "car_id": essential_vehicle_id,
            "user_name": "TEST_Journey_Update",
            "start_time": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%dT08:00:00"),
            "end_time": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%dT11:00:00"),
            "start_eircode": "D01 OLD1",
            "end_eircode": "D02 OLD2"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()["id"]
        
        # Update the journey fields
        update_data = {
            "start_eircode": "D03 NEW1",
            "end_eircode": "D04 NEW2",
            "start_address": "New Start Location",
            "end_address": "New End Location"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/bookings/{booking_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert update_response.status_code == 200
        
        updated_booking = update_response.json()
        assert updated_booking.get("start_eircode") == "D03 NEW1"
        assert updated_booking.get("end_eircode") == "D04 NEW2"
        assert updated_booking.get("start_address") == "New Start Location"
        assert updated_booking.get("end_address") == "New End Location"
        
        print(f"✓ Booking journey fields updated successfully")


class TestVehiclesAndBookings:
    """Test vehicles and bookings for calendar display"""
    
    @pytest.fixture
    def essential_token(self):
        """Get Essential tenant token via impersonation"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        super_token = login_response.json()["access_token"]
        
        impersonate_response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{ESSENTIAL_TENANT_ID}/impersonate",
            headers={"Authorization": f"Bearer {super_token}"}
        )
        return impersonate_response.json()["access_token"]
    
    def test_get_vehicles(self, essential_token):
        """Test getting vehicles for calendar display"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert response.status_code == 200
        vehicles = response.json()
        assert isinstance(vehicles, list)
        assert len(vehicles) > 0, "No vehicles found"
        
        # Verify vehicle structure
        vehicle = vehicles[0]
        assert "id" in vehicle
        assert "name" in vehicle
        assert "registration" in vehicle
        
        print(f"✓ Retrieved {len(vehicles)} vehicles for calendar")
    
    def test_get_bookings(self, essential_token):
        """Test getting bookings for calendar display"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        
        # Verify booking structure if any exist
        if len(bookings) > 0:
            booking = bookings[0]
            assert "id" in booking
            assert "car_id" in booking
            assert "start_time" in booking
            assert "end_time" in booking
            assert "user_name" in booking
        
        print(f"✓ Retrieved {len(bookings)} bookings for calendar")
    
    def test_create_recurring_booking(self, essential_token):
        """Test creating a recurring booking (for calendar color coding)"""
        # Get a vehicle first
        vehicles_response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        vehicle_id = vehicles_response.json()[0]["id"]
        
        booking_data = {
            "car_id": vehicle_id,
            "user_name": "TEST_Recurring_User",
            "start_time": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT09:00:00"),
            "end_time": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT10:00:00"),
            "is_recurring": True,
            "recurrence_type": "weekly",
            "recurrence_count": 4
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {essential_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("is_recurring") == True, "Booking should be marked as recurring"
        
        print(f"✓ Recurring booking created (for Purple color in calendar)")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_bookings(self):
        """Clean up TEST_ prefixed bookings"""
        # Login as Super Admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        super_token = login_response.json()["access_token"]
        
        # Impersonate Essential tenant
        impersonate_response = requests.post(
            f"{BASE_URL}/api/platform/tenants/{ESSENTIAL_TENANT_ID}/impersonate",
            headers={"Authorization": f"Bearer {super_token}"}
        )
        token = impersonate_response.json()["access_token"]
        
        # Get all bookings
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {token}"}
        )
        bookings = response.json()
        
        # Delete TEST_ prefixed bookings
        deleted_count = 0
        for booking in bookings:
            if booking.get("user_name", "").startswith("TEST_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/bookings/{booking['id']}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if delete_response.status_code in [200, 204]:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test bookings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
