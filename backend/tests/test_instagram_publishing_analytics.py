"""
Test Instagram Publishing and Analytics Features for Content Worker

Tests cover:
- Analytics Overview API
- Analytics Posts API
- Top Posts API
- Category and Format Analytics
- Sync Metrics API
- Instagram Connection (connect/disconnect/refresh-token)
- Draft Schedule/Unschedule/Publish/Retry endpoints
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is not set")


class TestAuthentication:
    """Test authentication for super admin"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        return data["access_token"]
    
    def test_super_admin_login(self, auth_token):
        """Test that super admin can login"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✅ Super admin login successful")


class TestInstagramSettings:
    """Test Instagram settings and connection APIs"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_instagram_settings(self, auth_headers):
        """Test getting Instagram settings"""
        response = requests.get(f"{BASE_URL}/api/content-worker/instagram-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should have connection_status field
        assert "connection_status" in data
        print(f"✅ Instagram settings retrieved: connection_status={data.get('connection_status')}")
    
    def test_instagram_connect(self, auth_headers):
        """Test connecting Instagram account (mocked)"""
        # Connect with test data
        connect_data = {
            "access_token": "test_access_token_12345",
            "account_id": "ig_test_account_001",
            "account_name": "test_account",
            "token_expires_at": (datetime.utcnow() + timedelta(days=60)).isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/content-worker/instagram/connect", 
                                headers=auth_headers, json=connect_data)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "connected" in data["message"].lower() or data.get("account_name") == "test_account"
        print(f"✅ Instagram connected: {data}")
    
    def test_instagram_settings_after_connect(self, auth_headers):
        """Verify settings after connection"""
        response = requests.get(f"{BASE_URL}/api/content-worker/instagram-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("connection_status") == "connected"
        assert data.get("account_name") == "test_account"
        print(f"✅ Instagram settings verified after connect")
    
    def test_instagram_refresh_token(self, auth_headers):
        """Test refreshing Instagram token"""
        response = requests.post(f"{BASE_URL}/api/content-worker/instagram/refresh-token", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Token refresh successful: {data}")
    
    def test_instagram_disconnect(self, auth_headers):
        """Test disconnecting Instagram"""
        response = requests.post(f"{BASE_URL}/api/content-worker/instagram/disconnect", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "disconnected" in data.get("message", "").lower()
        print(f"✅ Instagram disconnected")
    
    def test_reconnect_for_further_tests(self, auth_headers):
        """Reconnect Instagram for further tests"""
        connect_data = {
            "access_token": "test_access_token_12345",
            "account_id": "ig_test_account_001",
            "account_name": "quickwing_test",
            "token_expires_at": (datetime.utcnow() + timedelta(days=60)).isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/content-worker/instagram/connect", 
                                headers=auth_headers, json=connect_data)
        assert response.status_code == 200
        print(f"✅ Instagram reconnected for further tests")


class TestAnalyticsAPIs:
    """Test Analytics APIs"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_analytics_overview(self, auth_headers):
        """Test analytics overview endpoint"""
        response = requests.get(f"{BASE_URL}/api/content-worker/analytics/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        expected_fields = ["total_posts", "total_likes", "total_comments", "total_reach", 
                         "total_saves", "engagement_rate"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✅ Analytics overview: total_posts={data.get('total_posts')}, "
              f"total_likes={data.get('total_likes')}, engagement_rate={data.get('engagement_rate')}%")
    
    def test_analytics_posts(self, auth_headers):
        """Test analytics posts endpoint"""
        response = requests.get(f"{BASE_URL}/api/content-worker/analytics/posts?limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "posts" in data
        assert isinstance(data["posts"], list)
        print(f"✅ Analytics posts retrieved: {len(data['posts'])} posts")
    
    def test_analytics_top_posts(self, auth_headers):
        """Test top posts endpoint"""
        response = requests.get(f"{BASE_URL}/api/content-worker/analytics/top-posts?metric=likes&limit=5", 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "posts" in data
        assert "sorted_by" in data
        assert data["sorted_by"] == "likes"
        print(f"✅ Top posts retrieved: {len(data['posts'])} posts sorted by likes")
    
    def test_analytics_top_posts_by_reach(self, auth_headers):
        """Test top posts by reach"""
        response = requests.get(f"{BASE_URL}/api/content-worker/analytics/top-posts?metric=reach&limit=5", 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["sorted_by"] == "reach"
        print(f"✅ Top posts by reach retrieved")
    
    def test_analytics_by_category(self, auth_headers):
        """Test analytics by category"""
        response = requests.get(f"{BASE_URL}/api/content-worker/analytics/by-category", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        assert isinstance(data["categories"], list)
        print(f"✅ Analytics by category: {len(data['categories'])} categories")
    
    def test_analytics_by_format(self, auth_headers):
        """Test analytics by format"""
        response = requests.get(f"{BASE_URL}/api/content-worker/analytics/by-format", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "formats" in data
        assert isinstance(data["formats"], list)
        print(f"✅ Analytics by format: {len(data['formats'])} formats")
    
    def test_sync_metrics(self, auth_headers):
        """Test sync metrics endpoint"""
        response = requests.post(f"{BASE_URL}/api/content-worker/analytics/sync", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "synced_count" in data
        print(f"✅ Metrics sync: {data}")


class TestSchedulePublishWorkflow:
    """Test schedule, unschedule, publish, retry workflow"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_draft(self, auth_headers):
        """Create a test draft for workflow testing"""
        # First get an asset
        assets_resp = requests.get(f"{BASE_URL}/api/content-worker/assets", headers=auth_headers)
        asset_id = None
        if assets_resp.status_code == 200 and assets_resp.json().get("assets"):
            asset_id = assets_resp.json()["assets"][0].get("id")
        
        # Create draft
        draft_data = {
            "post_title": "TEST_Publishing_Workflow_Draft",
            "post_type": "product_demo",
            "format_type": "reel",
            "hook": "Testing the publishing workflow",
            "asset_id": asset_id,
            "content_focus": "test content focus",
            "generated_captions": ["Test caption 1", "Test caption 2"],
            "selected_caption_index": 0,
            "cta": "Test CTA",
            "hashtags": "#test #workflow",
            "notes": "Test draft for publishing workflow"
        }
        
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts", 
                                headers=auth_headers, json=draft_data)
        assert response.status_code == 200
        data = response.json()
        return data.get("draft", data)
    
    def test_submit_draft_for_review(self, auth_headers, test_draft):
        """Submit draft for review"""
        draft_id = test_draft.get("id")
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/submit-review", 
                                headers=auth_headers)
        assert response.status_code == 200
        print(f"✅ Draft submitted for review")
    
    def test_approve_draft(self, auth_headers, test_draft):
        """Approve the draft"""
        draft_id = test_draft.get("id")
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/approve", 
                                headers=auth_headers)
        assert response.status_code == 200
        print(f"✅ Draft approved")
    
    def test_schedule_draft(self, auth_headers, test_draft):
        """Test scheduling an approved draft"""
        draft_id = test_draft.get("id")
        
        # Schedule for 1 hour in the future
        scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
        
        response = requests.post(
            f"{BASE_URL}/api/content-worker/drafts/{draft_id}/schedule?scheduled_at={scheduled_time}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "scheduled" in data.get("message", "").lower()
        print(f"✅ Draft scheduled: {data}")
    
    def test_verify_draft_scheduled_status(self, auth_headers, test_draft):
        """Verify draft status is now scheduled"""
        draft_id = test_draft.get("id")
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/full", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "scheduled"
        print(f"✅ Draft status verified as scheduled")
    
    def test_unschedule_draft(self, auth_headers, test_draft):
        """Test unscheduling a draft"""
        draft_id = test_draft.get("id")
        
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/unschedule",
                                headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "unscheduled" in data.get("message", "").lower() or "approved" in data.get("message", "").lower()
        print(f"✅ Draft unscheduled: {data}")
    
    def test_verify_draft_back_to_approved(self, auth_headers, test_draft):
        """Verify draft is back to approved status"""
        draft_id = test_draft.get("id")
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/full", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "approved"
        print(f"✅ Draft status verified as approved after unschedule")
    
    def test_publish_draft(self, auth_headers, test_draft):
        """Test publishing a draft (mocked)"""
        draft_id = test_draft.get("id")
        
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/publish",
                                headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should return success with mocked Instagram data
        assert "message" in data
        assert "instagram_post_id" in data or "published" in data.get("message", "").lower()
        print(f"✅ Draft published (mocked): {data}")
    
    def test_verify_draft_posted_status(self, auth_headers, test_draft):
        """Verify draft status is now posted"""
        draft_id = test_draft.get("id")
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/full", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "posted"
        assert data.get("instagram_post_id") is not None
        assert data.get("instagram_post_url") is not None
        print(f"✅ Draft verified as posted with Instagram ID: {data.get('instagram_post_id')}")


class TestSchedulePublishEdgeCases:
    """Test edge cases for schedule/publish"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_asset_id(self, auth_headers):
        """Get an existing asset ID for draft creation"""
        assets_resp = requests.get(f"{BASE_URL}/api/content-worker/assets", headers=auth_headers)
        if assets_resp.status_code == 200 and assets_resp.json().get("assets"):
            return assets_resp.json()["assets"][0].get("id")
        return None
    
    def test_schedule_non_approved_draft_fails(self, auth_headers, test_asset_id):
        """Test that scheduling a non-approved draft fails"""
        if not test_asset_id:
            pytest.skip("No asset available for test")
        
        # Create a draft but don't approve it
        draft_data = {
            "post_title": "TEST_Unapproved_Draft",
            "post_type": "product_demo",
            "format_type": "reel",
            "asset_id": test_asset_id
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/content-worker/drafts", 
                                   headers=auth_headers, json=draft_data)
        assert create_resp.status_code == 200
        draft_id = create_resp.json().get("draft", {}).get("id") or create_resp.json().get("id")
        
        # Try to schedule without approval
        scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
        response = requests.post(
            f"{BASE_URL}/api/content-worker/drafts/{draft_id}/schedule?scheduled_at={scheduled_time}",
            headers=auth_headers
        )
        # Should fail because draft is not approved
        assert response.status_code == 400
        print(f"✅ Correctly rejected scheduling unapproved draft")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/content-worker/drafts/{draft_id}", headers=auth_headers)
    
    def test_publish_non_approved_draft_fails(self, auth_headers, test_asset_id):
        """Test that publishing a non-approved draft fails"""
        if not test_asset_id:
            pytest.skip("No asset available for test")
        
        # Create a draft
        draft_data = {
            "post_title": "TEST_Unpublishable_Draft",
            "post_type": "product_demo",
            "format_type": "reel",
            "asset_id": test_asset_id
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/content-worker/drafts", 
                                   headers=auth_headers, json=draft_data)
        assert create_resp.status_code == 200
        draft_id = create_resp.json().get("draft", {}).get("id") or create_resp.json().get("id")
        
        # Try to publish without approval
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/publish",
                                headers=auth_headers)
        assert response.status_code == 400
        print(f"✅ Correctly rejected publishing unapproved draft")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/content-worker/drafts/{draft_id}", headers=auth_headers)
    
    def test_unschedule_non_scheduled_draft_fails(self, auth_headers, test_asset_id):
        """Test that unscheduling a non-scheduled draft fails"""
        if not test_asset_id:
            pytest.skip("No asset available for test")
        
        # Create and approve a draft
        draft_data = {
            "post_title": "TEST_Not_Scheduled_Draft",
            "post_type": "product_demo",
            "format_type": "reel",
            "asset_id": test_asset_id
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/content-worker/drafts", 
                                   headers=auth_headers, json=draft_data)
        assert create_resp.status_code == 200
        draft_id = create_resp.json().get("draft", {}).get("id") or create_resp.json().get("id")
        
        # Submit and approve
        requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/submit-review", headers=auth_headers)
        requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/approve", headers=auth_headers)
        
        # Try to unschedule (should fail as it's not scheduled)
        response = requests.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/unschedule",
                                headers=auth_headers)
        assert response.status_code == 400
        print(f"✅ Correctly rejected unscheduling non-scheduled draft")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/content-worker/drafts/{draft_id}", headers=auth_headers)


class TestReviewQueueStatusFilter:
    """Test Review Queue status filtering"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_filter_drafts_by_status_all(self, auth_headers):
        """Test getting all drafts"""
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "drafts" in data
        print(f"✅ All drafts retrieved: {len(data['drafts'])} drafts")
    
    def test_filter_drafts_by_status_posted(self, auth_headers):
        """Test filtering drafts by posted status"""
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts?status=posted", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "drafts" in data
        # All returned should have posted status
        for draft in data["drafts"]:
            assert draft.get("status") == "posted"
        print(f"✅ Posted drafts: {len(data['drafts'])}")
    
    def test_filter_drafts_by_status_scheduled(self, auth_headers):
        """Test filtering drafts by scheduled status"""
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts?status=scheduled", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "drafts" in data
        print(f"✅ Scheduled drafts: {len(data['drafts'])}")
    
    def test_filter_drafts_by_status_approved(self, auth_headers):
        """Test filtering drafts by approved status"""
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts?status=approved", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "drafts" in data
        print(f"✅ Approved drafts: {len(data['drafts'])}")
    
    def test_filter_drafts_by_status_failed(self, auth_headers):
        """Test filtering drafts by failed status"""
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts?status=failed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "drafts" in data
        print(f"✅ Failed drafts: {len(data['drafts'])}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@quickwing.com",
            "password": "Super123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_cleanup_test_drafts(self, auth_headers):
        """Clean up test drafts"""
        # Get all drafts and delete ones with TEST_ prefix
        response = requests.get(f"{BASE_URL}/api/content-worker/drafts", headers=auth_headers)
        if response.status_code == 200:
            drafts = response.json().get("drafts", [])
            deleted_count = 0
            for draft in drafts:
                if draft.get("post_title", "").startswith("TEST_"):
                    delete_resp = requests.delete(
                        f"{BASE_URL}/api/content-worker/drafts/{draft['id']}", 
                        headers=auth_headers
                    )
                    if delete_resp.status_code == 200:
                        deleted_count += 1
            print(f"✅ Cleaned up {deleted_count} test drafts")
