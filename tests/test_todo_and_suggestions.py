"""
Test suite for Quick Wing Fleet Management App - Advanced To-Do Features and Booking Suggestions
Tests:
1. Admin To-Do List with scheduling options (daily, weekly, monthly)
2. Creating mandatory tasks with schedule types
3. Booking suggestions API returns car availability
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@quickwing.com"
ADMIN_PASSWORD = "admin123"
STAFF_EMAIL = "staff@quickwing.com"
STAFF_PASSWORD = "staff123"


class TestAuthentication:
    """Authentication tests to get tokens for subsequent tests"""
    
    def test_admin_login(self, api_client):
        """Test admin login and get token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✅ Admin login successful - role: {data['user']['role']}")
        return data["access_token"]
    
    def test_staff_login(self, api_client):
        """Test staff login and get token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "staff"
        print(f"✅ Staff login successful - role: {data['user']['role']}")
        return data["access_token"]


class TestTodoScheduling:
    """Tests for Admin To-Do List with scheduling options"""
    
    def test_create_todo_one_time(self, admin_client):
        """Test creating a one-time (non-scheduled) to-do item"""
        response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_One-time task",
            "is_mandatory": False,
            "schedule_type": None,
            "schedule_days": []
        })
        assert response.status_code == 200, f"Failed to create todo: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_One-time task"
        assert data["is_mandatory"] == False
        assert data.get("schedule_type") is None
        print(f"✅ Created one-time todo: {data['title']}")
        return data["id"]
    
    def test_create_todo_daily_schedule(self, admin_client):
        """Test creating a mandatory task with daily schedule"""
        response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Daily mandatory task",
            "is_mandatory": True,
            "schedule_type": "daily",
            "schedule_days": []
        })
        assert response.status_code == 200, f"Failed to create daily todo: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_Daily mandatory task"
        assert data["is_mandatory"] == True
        assert data["schedule_type"] == "daily"
        print(f"✅ Created daily scheduled todo: {data['title']}, schedule_type: {data['schedule_type']}")
        return data["id"]
    
    def test_create_todo_weekly_schedule(self, admin_client):
        """Test creating a mandatory task with weekly schedule (Mon, Wed, Fri)"""
        response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Weekly mandatory task",
            "is_mandatory": True,
            "schedule_type": "weekly",
            "schedule_days": [1, 3, 5]  # Mon, Wed, Fri (Sunday=0)
        })
        assert response.status_code == 200, f"Failed to create weekly todo: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_Weekly mandatory task"
        assert data["is_mandatory"] == True
        assert data["schedule_type"] == "weekly"
        assert data["schedule_days"] == [1, 3, 5]
        print(f"✅ Created weekly scheduled todo: {data['title']}, schedule_days: {data['schedule_days']}")
        return data["id"]
    
    def test_create_todo_monthly_schedule(self, admin_client):
        """Test creating a mandatory task with monthly schedule (1st and 15th)"""
        response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Monthly mandatory task",
            "is_mandatory": True,
            "schedule_type": "monthly",
            "schedule_days": [1, 15]  # 1st and 15th of month
        })
        assert response.status_code == 200, f"Failed to create monthly todo: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_Monthly mandatory task"
        assert data["is_mandatory"] == True
        assert data["schedule_type"] == "monthly"
        assert data["schedule_days"] == [1, 15]
        print(f"✅ Created monthly scheduled todo: {data['title']}, schedule_days: {data['schedule_days']}")
        return data["id"]
    
    def test_get_all_todos(self, admin_client):
        """Test getting all to-do items"""
        response = admin_client.get(f"{BASE_URL}/api/admin/todos")
        assert response.status_code == 200, f"Failed to get todos: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} todos")
        
        # Check that our test todos are present
        test_todos = [t for t in data if t["title"].startswith("TEST_")]
        print(f"   Found {len(test_todos)} test todos")
        return data
    
    def test_update_todo_schedule(self, admin_client):
        """Test updating a todo's schedule type"""
        # First create a todo
        create_response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Update schedule test",
            "is_mandatory": True,
            "schedule_type": "daily",
            "schedule_days": []
        })
        assert create_response.status_code == 200
        todo_id = create_response.json()["id"]
        
        # Update to weekly schedule
        update_response = admin_client.put(f"{BASE_URL}/api/admin/todos/{todo_id}", json={
            "schedule_type": "weekly",
            "schedule_days": [0, 6]  # Sunday and Saturday
        })
        assert update_response.status_code == 200, f"Failed to update todo: {update_response.text}"
        data = update_response.json()
        assert data["schedule_type"] == "weekly"
        assert data["schedule_days"] == [0, 6]
        print(f"✅ Updated todo schedule from daily to weekly: {data['schedule_days']}")
        return todo_id
    
    def test_complete_and_verify_todo(self, admin_client):
        """Test completing a todo and verifying completion info"""
        # Create a todo
        create_response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Complete test task",
            "is_mandatory": True,
            "schedule_type": "daily",
            "schedule_days": []
        })
        assert create_response.status_code == 200
        todo_id = create_response.json()["id"]
        
        # Complete the todo
        complete_response = admin_client.put(f"{BASE_URL}/api/admin/todos/{todo_id}", json={
            "is_completed": True
        })
        assert complete_response.status_code == 200, f"Failed to complete todo: {complete_response.text}"
        data = complete_response.json()
        assert data["is_completed"] == True
        assert data["completed_by"] is not None
        assert data["completed_at"] is not None
        print(f"✅ Completed todo, completed_by: {data['completed_by']}, completed_at: {data['completed_at']}")
        return todo_id
    
    def test_delete_todo(self, admin_client):
        """Test deleting a todo"""
        # Create a todo to delete
        create_response = admin_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Delete me",
            "is_mandatory": False
        })
        assert create_response.status_code == 200
        todo_id = create_response.json()["id"]
        
        # Delete the todo
        delete_response = admin_client.delete(f"{BASE_URL}/api/admin/todos/{todo_id}")
        assert delete_response.status_code == 200, f"Failed to delete todo: {delete_response.text}"
        print(f"✅ Deleted todo: {todo_id}")
        
        # Verify it's deleted
        get_response = admin_client.get(f"{BASE_URL}/api/admin/todos")
        todos = get_response.json()
        assert not any(t["id"] == todo_id for t in todos), "Todo should be deleted"
        print(f"✅ Verified todo is deleted")


class TestBookingSuggestions:
    """Tests for Booking Suggestions API"""
    
    def test_get_booking_suggestions(self, admin_client):
        """Test getting booking suggestions returns car availability"""
        response = admin_client.get(f"{BASE_URL}/api/bookings/suggestions")
        assert response.status_code == 200, f"Failed to get suggestions: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} car suggestions")
        
        # Verify structure of suggestions
        if len(data) > 0:
            suggestion = data[0]
            assert "car_id" in suggestion
            assert "car_name" in suggestion
            assert "registration" in suggestion
            assert "total_free_slots" in suggestion
            assert "free_slots" in suggestion
            print(f"   First suggestion: {suggestion['car_name']} ({suggestion['registration']})")
            print(f"   Total free slots: {suggestion['total_free_slots']}")
            
            # Verify free_slots structure
            if len(suggestion["free_slots"]) > 0:
                slot = suggestion["free_slots"][0]
                assert "date" in slot
                assert "day_name" in slot
                assert "start" in slot
                assert "end" in slot
                assert "duration_hours" in slot
                print(f"   Sample slot: {slot['day_name']} {slot['date']} {slot['start']}-{slot['end']} ({slot['duration_hours']}h)")
        
        return data
    
    def test_suggestions_exclude_blocked_cars(self, admin_client):
        """Test that blocked cars are not included in suggestions"""
        # Get all cars
        cars_response = admin_client.get(f"{BASE_URL}/api/cars")
        assert cars_response.status_code == 200
        cars = cars_response.json()
        
        # Get suggestions
        suggestions_response = admin_client.get(f"{BASE_URL}/api/bookings/suggestions")
        assert suggestions_response.status_code == 200
        suggestions = suggestions_response.json()
        
        # Check that blocked cars are not in suggestions
        blocked_car_ids = [c["id"] for c in cars if c.get("is_blocked")]
        suggestion_car_ids = [s["car_id"] for s in suggestions]
        
        for blocked_id in blocked_car_ids:
            assert blocked_id not in suggestion_car_ids, f"Blocked car {blocked_id} should not be in suggestions"
        
        print(f"✅ Verified {len(blocked_car_ids)} blocked cars are excluded from suggestions")
    
    def test_suggestions_show_free_time_slots(self, admin_client):
        """Test that suggestions show available time slots for next 7 days"""
        response = admin_client.get(f"{BASE_URL}/api/bookings/suggestions")
        assert response.status_code == 200
        suggestions = response.json()
        
        if len(suggestions) > 0:
            # Check that slots are within next 7 days
            today = datetime.now().date()
            max_date = today + timedelta(days=7)
            
            for suggestion in suggestions[:3]:  # Check first 3 cars
                for slot in suggestion["free_slots"][:5]:  # Check first 5 slots
                    slot_date = datetime.strptime(slot["date"], "%Y-%m-%d").date()
                    assert today <= slot_date <= max_date, f"Slot date {slot_date} should be within 7 days"
                    
                    # Verify time format (HH:MM)
                    assert ":" in slot["start"]
                    assert ":" in slot["end"]
                    
                    # Verify duration is positive
                    assert slot["duration_hours"] >= 1, "Minimum slot duration should be 1 hour"
            
            print(f"✅ Verified time slots are within 7-day window with valid format")


class TestStaffTodoAccess:
    """Test that staff cannot access admin todo endpoints"""
    
    def test_staff_cannot_access_todos(self, staff_client):
        """Staff should not be able to access admin todos"""
        response = staff_client.get(f"{BASE_URL}/api/admin/todos")
        assert response.status_code in [401, 403], f"Staff should not access admin todos: {response.status_code}"
        print(f"✅ Staff correctly denied access to admin todos (status: {response.status_code})")
    
    def test_staff_cannot_create_todos(self, staff_client):
        """Staff should not be able to create todos"""
        response = staff_client.post(f"{BASE_URL}/api/admin/todos", json={
            "title": "TEST_Staff todo attempt",
            "is_mandatory": False
        })
        assert response.status_code in [401, 403], f"Staff should not create todos: {response.status_code}"
        print(f"✅ Staff correctly denied creating todos (status: {response.status_code})")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_todos(self, admin_client):
        """Delete all test todos created during testing"""
        response = admin_client.get(f"{BASE_URL}/api/admin/todos")
        if response.status_code == 200:
            todos = response.json()
            test_todos = [t for t in todos if t["title"].startswith("TEST_")]
            
            for todo in test_todos:
                delete_response = admin_client.delete(f"{BASE_URL}/api/admin/todos/{todo['id']}")
                if delete_response.status_code == 200:
                    print(f"   Deleted test todo: {todo['title']}")
            
            print(f"✅ Cleaned up {len(test_todos)} test todos")


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed - skipping authenticated tests")


@pytest.fixture
def staff_token(api_client):
    """Get staff authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Staff authentication failed - skipping authenticated tests")


@pytest.fixture
def admin_client(api_client, admin_token):
    """Session with admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


@pytest.fixture
def staff_client(api_client, staff_token):
    """Session with staff auth header"""
    api_client.headers.update({"Authorization": f"Bearer {staff_token}"})
    return api_client


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
