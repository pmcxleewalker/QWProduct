"""
Test suite for Quick Wing new features:
1. Request a Lift sticky button (frontend only - tested via Playwright)
2. Live Fleet Status dashboard with 30s auto-refresh
3. Individual Car Calendars with 07:00-22:00 time slots
4. All Cars monthly calendar view for admin
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TENANT_ADMIN = {"email": "admin.test-franchise@quickwing.com", "password": "JF7mIdG60wiV"}
STAFF_USER = {"email": "staff.test-franchise@quickwing.com", "password": "87xbq9WE56"}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=TENANT_ADMIN)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def staff_token(api_client):
    """Get staff authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Staff authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    """Session with admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root_accessible(self, api_client):
        """Test API root endpoint is accessible"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root response: {data}")


class TestAuthentication:
    """Authentication tests for admin and staff users"""
    
    def test_admin_login_success(self, api_client):
        """Test admin user can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TENANT_ADMIN)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Admin login successful: {data['user'].get('email')}")
    
    def test_staff_login_success(self, api_client):
        """Test staff user can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Staff login successful: {data['user'].get('email')}")


class TestVehiclesAPI:
    """Test vehicles API for Live Fleet Status feature"""
    
    def test_get_vehicles_requires_auth(self, api_client):
        """Test vehicles endpoint requires authentication"""
        # Clear any existing auth
        clean_client = requests.Session()
        clean_client.headers.update({"Content-Type": "application/json"})
        response = clean_client.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code in [401, 403]
        print("Vehicles endpoint correctly requires authentication")
    
    def test_get_vehicles_as_admin(self, api_client, admin_token):
        """Test admin can get vehicles list"""
        response = api_client.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin retrieved {len(data)} vehicles")
        
        # Verify vehicle structure
        if len(data) > 0:
            vehicle = data[0]
            assert "id" in vehicle
            assert "name" in vehicle
            assert "registration" in vehicle
            print(f"Sample vehicle: {vehicle.get('name')} - {vehicle.get('registration')}")
    
    def test_get_vehicles_as_staff(self, api_client, staff_token):
        """Test staff can get vehicles list (for Live Fleet Status)"""
        response = api_client.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Staff retrieved {len(data)} vehicles for Live Fleet Status")


class TestBookingsAPI:
    """Test bookings API for Car Calendars feature"""
    
    def test_get_bookings_requires_auth(self, api_client):
        """Test bookings endpoint requires authentication"""
        clean_client = requests.Session()
        clean_client.headers.update({"Content-Type": "application/json"})
        response = clean_client.get(f"{BASE_URL}/api/bookings")
        assert response.status_code in [401, 403]
        print("Bookings endpoint correctly requires authentication")
    
    def test_get_bookings_as_admin(self, api_client, admin_token):
        """Test admin can get bookings list"""
        response = api_client.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin retrieved {len(data)} bookings")
        
        # Verify booking structure for calendar display
        if len(data) > 0:
            booking = data[0]
            assert "id" in booking
            assert "car_id" in booking
            assert "start_time" in booking
            assert "end_time" in booking
            assert "user_name" in booking
            # Check for is_recurring field (new feature)
            print(f"Booking has is_recurring field: {'is_recurring' in booking}")
            print(f"Sample booking: {booking.get('user_name')} - {booking.get('start_time')}")
    
    def test_get_bookings_as_staff(self, api_client, staff_token):
        """Test staff can get bookings list (for Car Calendars)"""
        response = api_client.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Staff retrieved {len(data)} bookings for Car Calendars")
    
    def test_create_booking_with_recurring_flag(self, api_client, admin_token):
        """Test creating a booking with is_recurring flag (new feature)"""
        # First get a vehicle ID
        vehicles_response = api_client.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        vehicles = vehicles_response.json()
        if len(vehicles) == 0:
            pytest.skip("No vehicles available for booking test")
        
        vehicle_id = vehicles[0]["id"]
        
        # Create a test booking with is_recurring flag
        now = datetime.now()
        start_time = (now + timedelta(days=7)).replace(hour=10, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=1)
        
        booking_data = {
            "car_id": vehicle_id,
            "user_name": "TEST_Recurring_User",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "notes": "Test recurring booking",
            "is_recurring": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        # Verify is_recurring was saved
        assert data.get("is_recurring") == True
        print(f"Created recurring booking: {data.get('id')}")
        
        # Cleanup - delete the test booking
        booking_id = data["id"]
        delete_response = api_client.delete(
            f"{BASE_URL}/api/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Cleanup: Deleted test booking, status: {delete_response.status_code}")


class TestLiftRequestsAPI:
    """Test lift requests API for Request a Lift feature"""
    
    def test_get_lift_requests_as_staff(self, api_client, staff_token):
        """Test staff can access lift requests"""
        response = api_client.get(
            f"{BASE_URL}/api/lift-requests",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Staff retrieved {len(data)} lift requests")
    
    def test_create_lift_request_as_staff(self, api_client, staff_token):
        """Test staff can create a lift request"""
        lift_data = {
            "from_location": "TEST_Office",
            "to_location": "TEST_Airport",
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time": "14:00",
            "seats_needed": 2,
            "notes": "Test lift request"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lift-requests",
            json=lift_data,
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        print(f"Created lift request: {data.get('id')}")
        
        # Cleanup
        lift_id = data["id"]
        delete_response = api_client.delete(
            f"{BASE_URL}/api/lift-requests/{lift_id}",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Cleanup: Deleted test lift request, status: {delete_response.status_code}")


class TestTenantUsersAPI:
    """Test tenant users API for role-based access"""
    
    def test_get_tenant_users_admin_only(self, api_client, admin_token, staff_token):
        """Test only admin can get tenant users list"""
        # Admin should succeed
        admin_response = api_client.get(
            f"{BASE_URL}/api/tenant/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_response.status_code == 200
        print("Admin can access tenant users list")
        
        # Staff should be denied
        staff_response = api_client.get(
            f"{BASE_URL}/api/tenant/users",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert staff_response.status_code in [401, 403]
        print("Staff correctly denied access to tenant users list")


class TestFleetStatusData:
    """Test data structure for Live Fleet Status feature"""
    
    def test_fleet_status_data_structure(self, api_client, admin_token):
        """Verify vehicles have required fields for fleet status display"""
        response = api_client.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        vehicles = response.json()
        
        if len(vehicles) > 0:
            vehicle = vehicles[0]
            # Check required fields for Live Fleet Status
            required_fields = ["id", "name", "registration", "is_blocked"]
            for field in required_fields:
                assert field in vehicle, f"Missing field: {field}"
            print(f"Vehicle has all required fields for Live Fleet Status")
            print(f"Vehicle blocked status: {vehicle.get('is_blocked')}")


class TestCalendarDataStructure:
    """Test data structure for Car Calendars feature"""
    
    def test_booking_has_calendar_fields(self, api_client, admin_token):
        """Verify bookings have required fields for calendar display"""
        response = api_client.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        bookings = response.json()
        
        if len(bookings) > 0:
            booking = bookings[0]
            # Check required fields for calendar display
            required_fields = ["id", "car_id", "start_time", "end_time", "user_name"]
            for field in required_fields:
                assert field in booking, f"Missing field: {field}"
            
            # Check for is_recurring field (for color coding)
            has_recurring = "is_recurring" in booking
            print(f"Booking has is_recurring field: {has_recurring}")
            
            # Verify time format is parseable
            try:
                start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(booking["end_time"].replace("Z", "+00:00"))
                print(f"Booking times are valid ISO format: {start} to {end}")
            except Exception as e:
                pytest.fail(f"Invalid time format: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
