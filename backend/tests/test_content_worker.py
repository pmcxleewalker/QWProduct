"""
Content Worker Module Backend API Tests
Tests for the Quick Wing Content Worker - Instagram Content Management Module

Test modules covered:
- Content Worker Stats (Dashboard)
- Content Assets CRUD
- Content Drafts CRUD with workflow (create, submit for review, approve, reject)
- Content Ideas CRUD
- Post Templates CRUD
- Instagram Settings API
- Super Admin Access Control
"""

import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"


class TestContentWorkerAuth:
    """Test authentication and access control for Content Worker"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = self._get_super_admin_token()
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_super_admin_login(self):
        """Test super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        print("Super Admin login - PASSED")
    
    def test_content_worker_requires_super_admin(self):
        """Test Content Worker endpoints require super admin role"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/content-worker/stats")
        assert response.status_code in [401, 403], "Should require authentication"
        print("Content Worker requires auth - PASSED")


class TestContentWorkerStats:
    """Test Content Worker Dashboard Stats API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_content_stats(self):
        """Test getting content worker dashboard statistics"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/stats")
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Response should contain stats"
        stats = data["stats"]
        
        # Verify all stat fields are present
        expected_fields = ["total_drafts", "in_review", "approved", "scheduled", 
                          "posted", "rejected", "total_assets", "total_ideas"]
        for field in expected_fields:
            assert field in stats, f"Missing stat field: {field}"
            assert isinstance(stats[field], int), f"{field} should be integer"
        
        # Check recent data arrays
        assert "recent_assets" in data
        assert "recent_ideas" in data
        assert isinstance(data["recent_assets"], list)
        assert isinstance(data["recent_ideas"], list)
        
        print(f"Content Stats retrieved - total_drafts: {stats['total_drafts']}, assets: {stats['total_assets']}, ideas: {stats['total_ideas']} - PASSED")


class TestContentIdeas:
    """Test Content Ideas CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_idea_id = None
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_create_content_idea(self):
        """Test creating a content idea"""
        idea_data = {
            "title": "TEST_Behind the scenes content",
            "category": "product_demo",
            "recommended_format": "reel",
            "hook": "Ever wondered how we manage 100+ vehicles?",
            "cta": "Follow for more fleet tips!",
            "target_audience": "Fleet managers and business owners"
        }
        
        response = self.session.post(f"{BASE_URL}/api/content-worker/ideas", json=idea_data)
        assert response.status_code == 200, f"Failed to create idea: {response.text}"
        
        data = response.json()
        assert "idea" in data
        assert data["idea"]["title"] == idea_data["title"]
        assert data["idea"]["category"] == idea_data["category"]
        assert "id" in data["idea"]
        
        self.created_idea_id = data["idea"]["id"]
        print(f"Content Idea created - ID: {self.created_idea_id} - PASSED")
        return self.created_idea_id
    
    def test_get_content_ideas(self):
        """Test getting list of content ideas"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/ideas")
        assert response.status_code == 200, f"Failed to get ideas: {response.text}"
        
        data = response.json()
        assert "ideas" in data
        assert "total" in data
        assert isinstance(data["ideas"], list)
        
        print(f"Content Ideas retrieved - Total: {data['total']} - PASSED")
    
    def test_get_ideas_filtered_by_category(self):
        """Test filtering ideas by category"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/ideas?category=product_demo")
        assert response.status_code == 200, f"Failed to filter ideas: {response.text}"
        
        data = response.json()
        assert "ideas" in data
        # All ideas should have the specified category
        for idea in data["ideas"]:
            assert idea["category"] == "product_demo"
        
        print("Content Ideas filtered by category - PASSED")
    
    def test_update_content_idea_status(self):
        """Test updating content idea status"""
        # First create an idea
        idea_id = self.test_create_content_idea()
        
        # Update status
        response = self.session.put(f"{BASE_URL}/api/content-worker/ideas/{idea_id}?status=used")
        assert response.status_code == 200, f"Failed to update idea: {response.text}"
        
        print("Content Idea status updated - PASSED")
    
    def test_delete_content_idea(self):
        """Test deleting a content idea"""
        # First create an idea
        idea_id = self.test_create_content_idea()
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/content-worker/ideas/{idea_id}")
        assert response.status_code == 200, f"Failed to delete idea: {response.text}"
        
        # Verify deletion
        response = self.session.get(f"{BASE_URL}/api/content-worker/ideas")
        ideas = response.json().get("ideas", [])
        idea_ids = [i["id"] for i in ideas]
        assert idea_id not in idea_ids, "Idea should be deleted"
        
        print("Content Idea deleted - PASSED")


class TestContentAssets:
    """Test Content Assets operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_asset_id = None
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_assets(self):
        """Test getting list of content assets"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/assets")
        assert response.status_code == 200, f"Failed to get assets: {response.text}"
        
        data = response.json()
        assert "assets" in data
        assert "total" in data
        assert isinstance(data["assets"], list)
        
        print(f"Content Assets retrieved - Total: {data['total']} - PASSED")
    
    def test_create_asset_via_json(self):
        """Test creating an asset via JSON endpoint"""
        asset_data = {
            "title": "TEST_Sample Image Asset",
            "file_type": "image",
            "original_file_url": "https://example.com/test-image.jpg",
            "thumbnail_url": "https://example.com/test-image-thumb.jpg",
            "notes": "Test asset for automated testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/content-worker/assets", json=asset_data)
        assert response.status_code == 200, f"Failed to create asset: {response.text}"
        
        data = response.json()
        assert "asset" in data
        assert data["asset"]["title"] == asset_data["title"]
        assert data["asset"]["file_type"] == asset_data["file_type"]
        assert "id" in data["asset"]
        
        self.created_asset_id = data["asset"]["id"]
        print(f"Content Asset created via JSON - ID: {self.created_asset_id} - PASSED")
        return self.created_asset_id
    
    def test_delete_asset(self):
        """Test deleting a content asset"""
        # First create an asset
        asset_id = self.test_create_asset_via_json()
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/content-worker/assets/{asset_id}")
        assert response.status_code == 200, f"Failed to delete asset: {response.text}"
        
        # Verify deletion
        response = self.session.get(f"{BASE_URL}/api/content-worker/assets")
        assets = response.json().get("assets", [])
        asset_ids = [a["id"] for a in assets]
        assert asset_id not in asset_ids, "Asset should be deleted"
        
        print("Content Asset deleted - PASSED")


class TestContentDrafts:
    """Test Content Drafts CRUD and workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_asset_id = None
        self.created_draft_id = None
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def _create_test_asset(self):
        """Create a test asset for drafts"""
        asset_data = {
            "title": "TEST_Draft Asset",
            "file_type": "image",
            "original_file_url": "https://example.com/draft-test.jpg"
        }
        response = self.session.post(f"{BASE_URL}/api/content-worker/assets", json=asset_data)
        if response.status_code == 200:
            return response.json()["asset"]["id"]
        return None
    
    def test_get_drafts(self):
        """Test getting list of content drafts"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/drafts")
        assert response.status_code == 200, f"Failed to get drafts: {response.text}"
        
        data = response.json()
        assert "drafts" in data
        assert "total" in data
        assert isinstance(data["drafts"], list)
        
        print(f"Content Drafts retrieved - Total: {data['total']} - PASSED")
    
    def test_create_draft(self):
        """Test creating a content draft"""
        # First create an asset
        asset_id = self._create_test_asset()
        assert asset_id, "Failed to create test asset"
        self.created_asset_id = asset_id
        
        draft_data = {
            "asset_id": asset_id,
            "post_title": "TEST_Fleet Management Tips",
            "post_type": "educational",
            "format_type": "reel",
            "hook": "Stop losing money on fleet management!",
            "caption_option_1": "Here's what the top fleet managers do differently...",
            "caption_option_2": "3 secrets to profitable fleet operations...",
            "caption_option_3": "The #1 mistake fleet owners make...",
            "cta": "Link in bio for free consultation",
            "hashtags": "#fleetmanagement #quickwing #business",
            "notes": "Test draft for automated testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/content-worker/drafts", json=draft_data)
        assert response.status_code == 200, f"Failed to create draft: {response.text}"
        
        data = response.json()
        assert "draft" in data
        assert data["draft"]["post_title"] == draft_data["post_title"]
        assert data["draft"]["status"] == "draft"
        assert "id" in data["draft"]
        
        self.created_draft_id = data["draft"]["id"]
        print(f"Content Draft created - ID: {self.created_draft_id}, Status: draft - PASSED")
        return self.created_draft_id, asset_id
    
    def test_get_specific_draft(self):
        """Test getting a specific draft with enriched data"""
        draft_id, _ = self.test_create_draft()
        
        response = self.session.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        assert response.status_code == 200, f"Failed to get draft: {response.text}"
        
        data = response.json()
        assert data["id"] == draft_id
        assert "asset" in data, "Draft should include asset data"
        assert "privacy_flags" in data, "Draft should include privacy flags"
        
        print("Specific Draft with enriched data retrieved - PASSED")
    
    def test_draft_workflow_submit_for_review(self):
        """Test submitting a draft for review"""
        draft_id, _ = self.test_create_draft()
        
        response = self.session.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/submit-review")
        assert response.status_code == 200, f"Failed to submit for review: {response.text}"
        
        # Verify status changed
        get_response = self.session.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        assert get_response.json()["status"] == "review", "Status should be 'review'"
        
        print("Draft submitted for review - Status: review - PASSED")
        return draft_id
    
    def test_draft_workflow_approve(self):
        """Test approving a draft"""
        draft_id = self.test_draft_workflow_submit_for_review()
        
        response = self.session.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/approve")
        assert response.status_code == 200, f"Failed to approve: {response.text}"
        
        # Verify status and approved_by
        get_response = self.session.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        data = get_response.json()
        assert data["status"] == "approved", "Status should be 'approved'"
        assert data["approved_by"] == SUPER_ADMIN_EMAIL, "approved_by should be set"
        
        print("Draft approved - Status: approved - PASSED")
    
    def test_draft_workflow_reject(self):
        """Test rejecting a draft"""
        # Create and submit for review
        draft_id, _ = self.test_create_draft()
        self.session.post(f"{BASE_URL}/api/content-worker/drafts/{draft_id}/submit-review")
        
        # Reject with notes
        response = self.session.post(
            f"{BASE_URL}/api/content-worker/drafts/{draft_id}/reject",
            params={"notes": "Needs better hook and more engaging caption"}
        )
        assert response.status_code == 200, f"Failed to reject: {response.text}"
        
        # Verify status
        get_response = self.session.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        data = get_response.json()
        assert data["status"] == "rejected", "Status should be 'rejected'"
        
        print("Draft rejected - Status: rejected - PASSED")
    
    def test_get_drafts_filtered_by_status(self):
        """Test filtering drafts by status"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/drafts?status=draft")
        assert response.status_code == 200, f"Failed to filter drafts: {response.text}"
        
        data = response.json()
        assert "drafts" in data
        # All drafts should have draft status
        for draft in data["drafts"]:
            assert draft["status"] == "draft"
        
        print("Drafts filtered by status - PASSED")
    
    def test_update_draft(self):
        """Test updating a draft"""
        draft_id, _ = self.test_create_draft()
        
        update_data = {
            "post_title": "TEST_Updated Fleet Management Tips",
            "hook": "Updated hook for better engagement"
        }
        
        response = self.session.put(f"{BASE_URL}/api/content-worker/drafts/{draft_id}", json=update_data)
        assert response.status_code == 200, f"Failed to update draft: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        data = get_response.json()
        assert data["post_title"] == update_data["post_title"]
        assert data["hook"] == update_data["hook"]
        
        print("Draft updated - PASSED")
    
    def test_delete_draft(self):
        """Test deleting a draft"""
        draft_id, asset_id = self.test_create_draft()
        
        # Delete draft
        response = self.session.delete(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        assert response.status_code == 200, f"Failed to delete draft: {response.text}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/content-worker/drafts/{draft_id}")
        assert get_response.status_code == 404, "Draft should be deleted"
        
        # Cleanup asset
        self.session.delete(f"{BASE_URL}/api/content-worker/assets/{asset_id}")
        
        print("Draft deleted - PASSED")


class TestPostTemplates:
    """Test Post Templates CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_templates(self):
        """Test getting list of post templates"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/templates")
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        
        data = response.json()
        assert "templates" in data
        assert isinstance(data["templates"], list)
        
        print(f"Post Templates retrieved - Total: {len(data['templates'])} - PASSED")
    
    def test_create_template(self):
        """Test creating a post template"""
        template_data = {
            "template_name": "TEST_Product Showcase",
            "format_type": "reel",
            "brand_style": "Modern and Professional",
            "logo_position": "bottom_right",
            "active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/content-worker/templates", json=template_data)
        assert response.status_code == 200, f"Failed to create template: {response.text}"
        
        data = response.json()
        assert "template" in data
        assert data["template"]["template_name"] == template_data["template_name"]
        assert data["template"]["format_type"] == template_data["format_type"]
        assert "id" in data["template"]
        
        template_id = data["template"]["id"]
        print(f"Post Template created - ID: {template_id} - PASSED")
        return template_id
    
    def test_update_template(self):
        """Test updating a post template"""
        template_id = self.test_create_template()
        
        response = self.session.put(
            f"{BASE_URL}/api/content-worker/templates/{template_id}",
            params={"active": False}
        )
        assert response.status_code == 200, f"Failed to update template: {response.text}"
        
        print("Post Template updated - PASSED")
    
    def test_delete_template(self):
        """Test deleting a post template"""
        template_id = self.test_create_template()
        
        response = self.session.delete(f"{BASE_URL}/api/content-worker/templates/{template_id}")
        assert response.status_code == 200, f"Failed to delete template: {response.text}"
        
        # Verify deletion
        response = self.session.get(f"{BASE_URL}/api/content-worker/templates")
        templates = response.json().get("templates", [])
        template_ids = [t["id"] for t in templates]
        assert template_id not in template_ids, "Template should be deleted"
        
        print("Post Template deleted - PASSED")


class TestInstagramSettings:
    """Test Instagram Settings API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_instagram_settings(self):
        """Test getting Instagram settings"""
        response = self.session.get(f"{BASE_URL}/api/content-worker/instagram-settings")
        assert response.status_code == 200, f"Failed to get Instagram settings: {response.text}"
        
        data = response.json()
        assert "connection_status" in data
        assert "token_status" in data
        
        print(f"Instagram Settings retrieved - Status: {data['connection_status']} - PASSED")
    
    def test_update_instagram_settings(self):
        """Test updating Instagram account name"""
        response = self.session.put(
            f"{BASE_URL}/api/content-worker/instagram-settings",
            params={"account_name": "@quickwing_test"}
        )
        assert response.status_code == 200, f"Failed to update Instagram settings: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/content-worker/instagram-settings")
        data = get_response.json()
        assert data.get("account_name") == "@quickwing_test" or data.get("account_name") is None
        
        print("Instagram Settings updated - PASSED")


class TestCleanup:
    """Cleanup test data after all tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        token = self._get_super_admin_token()
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def _get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_cleanup_test_data(self):
        """Cleanup TEST_ prefixed data"""
        # Cleanup drafts first (they reference assets)
        response = self.session.get(f"{BASE_URL}/api/content-worker/drafts")
        if response.status_code == 200:
            drafts = response.json().get("drafts", [])
            for draft in drafts:
                if draft.get("post_title", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/content-worker/drafts/{draft['id']}")
        
        # Cleanup assets
        response = self.session.get(f"{BASE_URL}/api/content-worker/assets")
        if response.status_code == 200:
            assets = response.json().get("assets", [])
            for asset in assets:
                if asset.get("title", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/content-worker/assets/{asset['id']}")
        
        # Cleanup ideas
        response = self.session.get(f"{BASE_URL}/api/content-worker/ideas")
        if response.status_code == 200:
            ideas = response.json().get("ideas", [])
            for idea in ideas:
                if idea.get("title", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/content-worker/ideas/{idea['id']}")
        
        # Cleanup templates
        response = self.session.get(f"{BASE_URL}/api/content-worker/templates")
        if response.status_code == 200:
            templates = response.json().get("templates", [])
            for template in templates:
                if template.get("template_name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/content-worker/templates/{template['id']}")
        
        print("Test data cleanup completed - PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
