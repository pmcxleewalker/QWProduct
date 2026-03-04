"""
Test Suite for Announcements and Daily Timeline Features
Tests:
- POST /api/messages - Create announcements
- GET /api/announcements - List announcements
- GET /api/announcements/pending - Get unacknowledged announcements
- GET /api/announcements/unread-count - Get unread count
- POST /api/messages/{id}/acknowledge - Acknowledge announcement
- DELETE /api/announcements/{id} - Delete announcement
- GET /api/tenant/reports/daily-timeline - Daily availability timeline
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN = {"email": "superadmin@quickwing.com", "password": "Super123"}
TENANT_ID = "d7ee2b3a-ebac-4677-bc56-065efd5e16f8"  # Cork City Cabs


class TestAnnouncementsAndTimeline:
    """Test suite for Announcements and Daily Timeline features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.created_announcement_id = None
        
    def get_super_admin_token(self):
        """Login as super admin and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def impersonate_tenant(self, token):
        """Impersonate Cork City Cabs tenant"""
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.post(f"{BASE_URL}/api/platform/tenants/{TENANT_ID}/impersonate")
        assert response.status_code == 200, f"Impersonation failed: {response.text}"
        return response.json()["access_token"]
    
    def authenticate_as_tenant_admin(self):
        """Full authentication flow to get tenant context"""
        super_token = self.get_super_admin_token()
        tenant_token = self.impersonate_tenant(super_token)
        self.session.headers.update({"Authorization": f"Bearer {tenant_token}"})
        return tenant_token

    # ==================== ANNOUNCEMENTS TESTS ====================
    
    def test_01_create_announcement(self):
        """Test POST /api/messages - Create a new announcement"""
        self.authenticate_as_tenant_admin()
        
        announcement_data = {
            "title": f"TEST_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "This is a test announcement for staff",
            "priority": "high",
            "requires_acknowledgment": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/messages", json=announcement_data)
        
        assert response.status_code == 200, f"Create announcement failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain announcement ID"
        assert data["title"] == announcement_data["title"]
        assert data["content"] == announcement_data["content"]
        assert data["priority"] == "high"
        assert data["requires_acknowledgment"] == True
        assert "created_by" in data
        assert "created_at" in data
        assert "acknowledged_by" in data
        assert isinstance(data["acknowledged_by"], list)
        
        # Store for later tests
        self.__class__.created_announcement_id = data["id"]
        print(f"✓ Created announcement: {data['id']}")
    
    def test_02_list_announcements(self):
        """Test GET /api/announcements - List all announcements"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/announcements")
        
        assert response.status_code == 200, f"List announcements failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If we created an announcement, it should be in the list
        if hasattr(self.__class__, 'created_announcement_id') and self.__class__.created_announcement_id:
            announcement_ids = [a["id"] for a in data]
            assert self.__class__.created_announcement_id in announcement_ids, "Created announcement should be in list"
        
        print(f"✓ Listed {len(data)} announcements")
    
    def test_03_get_pending_announcements(self):
        """Test GET /api/announcements/pending - Get unacknowledged announcements"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/announcements/pending")
        
        assert response.status_code == 200, f"Get pending announcements failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # All pending announcements should require acknowledgment
        for announcement in data:
            assert announcement.get("requires_acknowledgment") == True, "Pending announcements should require acknowledgment"
        
        print(f"✓ Found {len(data)} pending announcements")
    
    def test_04_get_unread_count(self):
        """Test GET /api/announcements/unread-count - Get count of unread announcements"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/announcements/unread-count")
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        
        # Should have count field
        assert "count" in data, "Response should contain count field"
        assert isinstance(data["count"], int), "Count should be an integer"
        assert data["count"] >= 0, "Count should be non-negative"
        
        print(f"✓ Unread count: {data['count']}")
    
    def test_05_acknowledge_announcement(self):
        """Test POST /api/messages/{id}/acknowledge - Acknowledge an announcement"""
        self.authenticate_as_tenant_admin()
        
        # First create a new announcement to acknowledge
        announcement_data = {
            "title": f"TEST_ToAcknowledge_{uuid.uuid4().hex[:8]}",
            "content": "This announcement will be acknowledged",
            "priority": "normal",
            "requires_acknowledgment": True
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/messages", json=announcement_data)
        assert create_response.status_code == 200, f"Create announcement failed: {create_response.text}"
        announcement_id = create_response.json()["id"]
        
        # Now acknowledge it
        response = self.session.post(f"{BASE_URL}/api/messages/{announcement_id}/acknowledge")
        
        assert response.status_code == 200, f"Acknowledge failed: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        
        # Verify it's no longer in pending
        pending_response = self.session.get(f"{BASE_URL}/api/announcements/pending")
        pending_ids = [a["id"] for a in pending_response.json()]
        assert announcement_id not in pending_ids, "Acknowledged announcement should not be in pending list"
        
        # Clean up - delete the test announcement
        self.session.delete(f"{BASE_URL}/api/announcements/{announcement_id}")
        
        print(f"✓ Acknowledged announcement: {announcement_id}")
    
    def test_06_acknowledge_nonexistent_announcement(self):
        """Test acknowledging a non-existent announcement returns 404"""
        self.authenticate_as_tenant_admin()
        
        fake_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/messages/{fake_id}/acknowledge")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent announcement returns 404")
    
    def test_07_delete_announcement(self):
        """Test DELETE /api/announcements/{id} - Delete an announcement"""
        self.authenticate_as_tenant_admin()
        
        # Create an announcement to delete
        announcement_data = {
            "title": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}",
            "content": "This announcement will be deleted",
            "priority": "low",
            "requires_acknowledgment": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/messages", json=announcement_data)
        assert create_response.status_code == 200
        announcement_id = create_response.json()["id"]
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/announcements/{announcement_id}")
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify it's gone
        list_response = self.session.get(f"{BASE_URL}/api/announcements")
        announcement_ids = [a["id"] for a in list_response.json()]
        assert announcement_id not in announcement_ids, "Deleted announcement should not be in list"
        
        print(f"✓ Deleted announcement: {announcement_id}")
    
    def test_08_delete_nonexistent_announcement(self):
        """Test deleting a non-existent announcement returns 404"""
        self.authenticate_as_tenant_admin()
        
        fake_id = str(uuid.uuid4())
        response = self.session.delete(f"{BASE_URL}/api/announcements/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete non-existent announcement returns 404")
    
    def test_09_create_announcement_with_all_priorities(self):
        """Test creating announcements with different priority levels"""
        self.authenticate_as_tenant_admin()
        
        priorities = ["low", "normal", "high", "urgent"]
        created_ids = []
        
        for priority in priorities:
            announcement_data = {
                "title": f"TEST_Priority_{priority}_{uuid.uuid4().hex[:6]}",
                "content": f"Testing {priority} priority",
                "priority": priority,
                "requires_acknowledgment": False
            }
            
            response = self.session.post(f"{BASE_URL}/api/messages", json=announcement_data)
            assert response.status_code == 200, f"Create {priority} announcement failed: {response.text}"
            
            data = response.json()
            assert data["priority"] == priority, f"Priority should be {priority}"
            created_ids.append(data["id"])
        
        # Clean up
        for ann_id in created_ids:
            self.session.delete(f"{BASE_URL}/api/announcements/{ann_id}")
        
        print(f"✓ Created announcements with all priorities: {priorities}")

    # ==================== DAILY TIMELINE TESTS ====================
    
    def test_10_get_daily_timeline(self):
        """Test GET /api/tenant/reports/daily-timeline - Get hourly availability"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline")
        
        assert response.status_code == 200, f"Get daily timeline failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "date" in data, "Response should contain date"
        assert "total_vehicles" in data, "Response should contain total_vehicles"
        assert "blocked_vehicles" in data, "Response should contain blocked_vehicles"
        assert "available_fleet" in data, "Response should contain available_fleet"
        assert "timeline" in data, "Response should contain timeline"
        assert "summary" in data, "Response should contain summary"
        
        # Verify timeline structure
        timeline = data["timeline"]
        assert isinstance(timeline, list), "Timeline should be a list"
        assert len(timeline) == 16, f"Timeline should have 16 hours (07:00-22:00), got {len(timeline)}"
        
        # Verify each hour slot
        for slot in timeline:
            assert "hour" in slot, "Each slot should have hour"
            assert "hour_24" in slot, "Each slot should have hour_24"
            assert "total_fleet" in slot, "Each slot should have total_fleet"
            assert "in_use" in slot, "Each slot should have in_use"
            assert "free" in slot, "Each slot should have free"
            assert "utilization_percent" in slot, "Each slot should have utilization_percent"
        
        # Verify summary structure
        summary = data["summary"]
        assert "peak_hour" in summary, "Summary should have peak_hour"
        assert "peak_vehicles_in_use" in summary, "Summary should have peak_vehicles_in_use"
        assert "average_utilization" in summary, "Summary should have average_utilization"
        
        print(f"✓ Daily timeline: {data['total_vehicles']} vehicles, avg utilization: {summary['average_utilization']}%")
    
    def test_11_get_daily_timeline_with_date(self):
        """Test GET /api/tenant/reports/daily-timeline with specific date"""
        self.authenticate_as_tenant_admin()
        
        # Test with today's date
        today = datetime.now().strftime("%Y-%m-%d")
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline", params={"date": today})
        
        assert response.status_code == 200, f"Get timeline with date failed: {response.text}"
        data = response.json()
        
        assert data["date"] == today, f"Date should be {today}"
        print(f"✓ Daily timeline for {today}")
    
    def test_12_get_daily_timeline_past_date(self):
        """Test GET /api/tenant/reports/daily-timeline with past date"""
        self.authenticate_as_tenant_admin()
        
        # Test with yesterday
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline", params={"date": yesterday})
        
        assert response.status_code == 200, f"Get timeline for past date failed: {response.text}"
        data = response.json()
        
        assert data["date"] == yesterday, f"Date should be {yesterday}"
        print(f"✓ Daily timeline for past date: {yesterday}")
    
    def test_13_get_daily_timeline_invalid_date(self):
        """Test GET /api/tenant/reports/daily-timeline with invalid date format"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline", params={"date": "invalid-date"})
        
        assert response.status_code == 400, f"Expected 400 for invalid date, got {response.status_code}"
        print("✓ Invalid date format returns 400")
    
    def test_14_daily_timeline_requires_admin(self):
        """Test that daily timeline requires admin authentication"""
        # Try without authentication
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline")
        
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Daily timeline requires authentication")
    
    def test_15_timeline_hours_are_correct(self):
        """Test that timeline covers correct hours (07:00 - 22:00)"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline")
        assert response.status_code == 200
        
        timeline = response.json()["timeline"]
        
        # Check first and last hours
        assert timeline[0]["hour"] == "07:00", "First hour should be 07:00"
        assert timeline[0]["hour_24"] == 7, "First hour_24 should be 7"
        assert timeline[-1]["hour"] == "22:00", "Last hour should be 22:00"
        assert timeline[-1]["hour_24"] == 22, "Last hour_24 should be 22"
        
        # Check all hours are sequential
        for i, slot in enumerate(timeline):
            expected_hour = 7 + i
            assert slot["hour_24"] == expected_hour, f"Hour {i} should be {expected_hour}"
        
        print("✓ Timeline hours are correct (07:00 - 22:00)")
    
    def test_16_timeline_utilization_calculation(self):
        """Test that utilization percentages are calculated correctly"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/daily-timeline")
        assert response.status_code == 200
        
        data = response.json()
        available_fleet = data["available_fleet"]
        
        for slot in data["timeline"]:
            if available_fleet > 0:
                expected_util = round((slot["in_use"] / available_fleet * 100), 1)
                assert slot["utilization_percent"] == expected_util, f"Utilization calculation mismatch at {slot['hour']}"
            else:
                assert slot["utilization_percent"] == 0, "Utilization should be 0 when no fleet available"
        
        print("✓ Utilization percentages calculated correctly")

    # ==================== CLEANUP ====================
    
    def test_99_cleanup_test_announcements(self):
        """Clean up any remaining test announcements"""
        self.authenticate_as_tenant_admin()
        
        response = self.session.get(f"{BASE_URL}/api/announcements")
        if response.status_code == 200:
            announcements = response.json()
            deleted_count = 0
            for ann in announcements:
                if ann.get("title", "").startswith("TEST_"):
                    delete_response = self.session.delete(f"{BASE_URL}/api/announcements/{ann['id']}")
                    if delete_response.status_code == 200:
                        deleted_count += 1
            
            print(f"✓ Cleaned up {deleted_count} test announcements")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
