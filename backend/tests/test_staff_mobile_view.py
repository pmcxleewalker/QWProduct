"""
Test Staff Mobile View APIs - Lift Requests, Vehicles, Bookings
Tests the backend APIs used by the StaffMobileView component
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
STAFF_USER = {
    "email": "teststaff@standard-fleet.com",
    "password": "teststaff123"
}

ADMIN_USER = {
    "email": "superadmin@quickwing.com",
    "password": "Super123"
}


class TestAuthentication:
    """Test authentication for staff user"""
    
    def test_staff_login(self):
        """Test staff user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == STAFF_USER["email"]
        print(f"SUCCESS: Staff user logged in - {data['user']['name']}")
        return data["access_token"]
    
    def test_admin_login(self):
        """Test admin user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        print(f"SUCCESS: Admin user logged in")
        return data["access_token"]


class TestVehiclesAPI:
    """Test vehicles API used by staff mobile view"""
    
    @pytest.fixture
    def staff_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
        return response.json()["access_token"]
    
    def test_get_vehicles(self, staff_token):
        """Test staff can get vehicles list"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        
        assert response.status_code == 200, f"Get vehicles failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} vehicles")
        return data


class TestBookingsAPI:
    """Test bookings API used by staff mobile view"""
    
    @pytest.fixture
    def staff_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
        return response.json()["access_token"]
    
    def test_get_bookings(self, staff_token):
        """Test staff can get bookings list"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        
        assert response.status_code == 200, f"Get bookings failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} bookings")
        return data
    
    def test_create_booking(self, staff_token):
        """Test staff can create a booking"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # First get available vehicles
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        vehicles = vehicles_response.json()
        
        if not vehicles:
            pytest.skip("No vehicles available for booking test")
        
        # Create a booking for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        booking_data = {
            "car_id": vehicles[0]["id"],
            "user_name": "Test Staff",
            "start_time": f"{tomorrow}T09:00:00",
            "end_time": f"{tomorrow}T17:00:00",
            "purpose": "TEST_Staff mobile view booking test"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        
        assert response.status_code in [200, 201], f"Create booking failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"SUCCESS: Created booking with ID: {data['id']}")
        return data


class TestLiftRequestsAPI:
    """Test lift requests API used by staff mobile view"""
    
    @pytest.fixture
    def staff_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_USER)
        return response.json()["access_token"]
    
    def test_get_lift_requests(self, staff_token):
        """Test staff can get lift requests list"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(f"{BASE_URL}/api/lift-requests", headers=headers)
        
        assert response.status_code == 200, f"Get lift requests failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} lift requests")
        return data
    
    def test_get_active_lift_requests(self, staff_token):
        """Test staff can get active lift requests"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(f"{BASE_URL}/api/lift-requests/active", headers=headers)
        
        assert response.status_code == 200, f"Get active lift requests failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} active lift requests")
        return data
    
    def test_create_lift_request(self, staff_token):
        """Test staff can create a lift request"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        lift_data = {
            "from_location": "TEST_Dublin Office",
            "to_location": "TEST_Cork Client Site",
            "date": tomorrow,
            "time": "14:30",
            "seats_needed": 1,
            "notes": "Contact: Test Staff - 0871234567"
        }
        
        response = requests.post(f"{BASE_URL}/api/lift-requests", json=lift_data, headers=headers)
        
        assert response.status_code in [200, 201], f"Create lift request failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["from_location"] == lift_data["from_location"]
        assert data["to_location"] == lift_data["to_location"]
        assert data["status"] == "open"
        print(f"SUCCESS: Created lift request with ID: {data['id']}")
        return data
    
    def test_lift_request_has_requester_info(self, staff_token):
        """Test that created lift request has requester info"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        lift_data = {
            "from_location": "TEST_Galway Office",
            "to_location": "TEST_Dublin HQ",
            "date": tomorrow,
            "time": "10:00",
            "seats_needed": 2,
            "notes": "Need 2 seats for team"
        }
        
        response = requests.post(f"{BASE_URL}/api/lift-requests", json=lift_data, headers=headers)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "requester_email" in data
        assert "requester_name" in data
        assert data["requester_email"] == STAFF_USER["email"]
        print(f"SUCCESS: Lift request has requester info - {data['requester_name']} ({data['requester_email']})")
        return data
    
    def test_accept_lift_request(self, staff_token):
        """Test accepting a lift request"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # First create a lift request
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        lift_data = {
            "from_location": "TEST_Accept Test From",
            "to_location": "TEST_Accept Test To",
            "date": tomorrow,
            "time": "16:00",
            "seats_needed": 1,
            "notes": "Test accept"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/lift-requests", json=lift_data, headers=headers)
        assert create_response.status_code in [200, 201]
        lift_id = create_response.json()["id"]
        
        # Accept the lift request
        accept_response = requests.post(
            f"{BASE_URL}/api/lift-requests/{lift_id}/accept",
            params={"message": "I can give you a lift!"},
            headers=headers
        )
        
        assert accept_response.status_code == 200, f"Accept lift request failed: {accept_response.text}"
        print(f"SUCCESS: Accepted lift request {lift_id}")
        return lift_id
    
    def test_dismiss_lift_request(self, staff_token):
        """Test dismissing a lift request"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # First create a lift request
        tomorrow = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d")
        lift_data = {
            "from_location": "TEST_Dismiss Test From",
            "to_location": "TEST_Dismiss Test To",
            "date": tomorrow,
            "time": "18:00",
            "seats_needed": 1,
            "notes": "Test dismiss"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/lift-requests", json=lift_data, headers=headers)
        assert create_response.status_code in [200, 201]
        lift_id = create_response.json()["id"]
        
        # Dismiss the lift request
        dismiss_response = requests.post(
            f"{BASE_URL}/api/lift-requests/{lift_id}/dismiss",
            headers=headers
        )
        
        assert dismiss_response.status_code == 200, f"Dismiss lift request failed: {dismiss_response.text}"
        print(f"SUCCESS: Dismissed lift request {lift_id}")
        return lift_id


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return response.json()["access_token"]
    
    def test_cleanup_test_bookings(self, admin_token):
        """Clean up test bookings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all bookings
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        if response.status_code != 200:
            print("Could not get bookings for cleanup")
            return
        
        bookings = response.json()
        deleted = 0
        for booking in bookings:
            if booking.get("purpose", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/bookings/{booking['id']}", headers=headers)
                if del_response.status_code in [200, 204]:
                    deleted += 1
        
        print(f"SUCCESS: Cleaned up {deleted} test bookings")
    
    def test_cleanup_test_lift_requests(self, admin_token):
        """Clean up test lift requests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all lift requests
        response = requests.get(f"{BASE_URL}/api/lift-requests", headers=headers)
        if response.status_code != 200:
            print("Could not get lift requests for cleanup")
            return
        
        lift_requests = response.json()
        dismissed = 0
        for lift in lift_requests:
            if lift.get("from_location", "").startswith("TEST_") or lift.get("to_location", "").startswith("TEST_"):
                # Dismiss test lift requests
                dismiss_response = requests.post(
                    f"{BASE_URL}/api/lift-requests/{lift['id']}/dismiss",
                    headers=headers
                )
                if dismiss_response.status_code == 200:
                    dismissed += 1
        
        print(f"SUCCESS: Cleaned up {dismissed} test lift requests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
