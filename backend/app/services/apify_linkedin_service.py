"""
Apify LinkedIn Service - Reliable LinkedIn Data Extraction

Apify is a professional web scraping platform with:
- Reliable LinkedIn scrapers
- Simple API
- Free tier available
- Well-documented
"""

import os
import json
import time
from typing import Dict, Any
from datetime import datetime
import urllib.request
import urllib.parse
import urllib.error
from dotenv import load_dotenv

load_dotenv()


class ApifyLinkedInService:
    """Service for LinkedIn data extraction via Apify."""

    def __init__(self):
        self.api_key = os.getenv("APIFY_API_TOKEN")
        self.base_url = "https://api.apify.com/v2"
        # LinkedIn Profile Detail Scraper (10K+ users, API-friendly)
        self.actor_id = "apimaestro~linkedin-profile-detail"

    def scrape_profile(self, profile_url: str, timeout: int = 60) -> Dict[str, Any]:
        """
        Scrape LinkedIn profile using Apify.

        Args:
            profile_url: LinkedIn profile URL
            timeout: Max wait time in seconds

        Returns:
            Dict with normalized research data
        """
        if not self.api_key:
            raise ValueError(
                "APIFY_API_TOKEN not set. Get free API token from https://apify.com/\n"
                "Sign up, go to Settings > Integrations > API tokens"
            )

        # Step 1: Start the actor (scraper)
        # dev_fusion scraper uses profileUrls array format
        run_input = {
            "profileUrls": [profile_url],
            "proxyConfiguration": {
                "useApifyProxy": True
            }
        }

        headers = {
            "Content-Type": "application/json"
        }

        start_url = f"{self.base_url}/acts/{self.actor_id}/runs?token={self.api_key}"
        start_data = json.dumps(run_input).encode('utf-8')

        req = urllib.request.Request(start_url, data=start_data, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                run_data = json.loads(resp.read())
                run_id = run_data.get("data", {}).get("id")

                if not run_id:
                    raise Exception(f"Failed to start scraper: {run_data}")

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            if e.code == 401:
                raise ValueError("Invalid Apify API token")
            else:
                raise Exception(f"Apify API error {e.code}: {error_body}")

        # Step 2: Wait for completion and get results
        start_time = time.time()

        while (time.time() - start_time) < timeout:
            # Check run status
            status_url = f"{self.base_url}/actor-runs/{run_id}?token={self.api_key}"
            status_req = urllib.request.Request(status_url)

            with urllib.request.urlopen(status_req, timeout=30) as resp:
                status_data = json.loads(resp.read())
                status = status_data.get("data", {}).get("status")

                if status == "SUCCEEDED":
                    # Get the dataset (results)
                    dataset_id = status_data.get("data", {}).get("defaultDatasetId")

                    if dataset_id:
                        items_url = f"{self.base_url}/datasets/{dataset_id}/items?token={self.api_key}"
                        items_req = urllib.request.Request(items_url)

                        with urllib.request.urlopen(items_req, timeout=30) as items_resp:
                            items = json.loads(items_resp.read())

                            if items and len(items) > 0:
                                # Check if the scraper returned an error
                                if "error" in items[0]:
                                    error_msg = items[0].get("error", "Unknown error")
                                    raise Exception(f"Scraper error: {error_msg}")
                                return self._normalize_for_research(items[0])
                            else:
                                raise Exception(f"No data returned from scraper")
                    else:
                        raise Exception("No dataset returned")

                elif status == "FAILED":
                    raise Exception("Scraper failed to complete")

            time.sleep(3)

        raise TimeoutError(f"Scraping timed out after {timeout}s")

    def _normalize_for_research(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform Apify data into ProspectResearch format.
        """
        print(f"DEBUG: Raw data keys: {list(raw.keys())[:15]}")

        # Handle different data formats
        basic_info = raw.get("basic_info", {}) or {}

        # Build LinkedIn bio
        linkedin_bio = ""
        headline = basic_info.get("headline", "") or raw.get("headline", "")
        summary = basic_info.get("summary", "") or raw.get("summary", "")

        if headline:
            linkedin_bio += f"{headline}\n\n"
        if summary:
            linkedin_bio += summary

        # Format recent posts (if available)
        recent_posts = ""
        activities = raw.get("activities", []) or raw.get("posts", [])

        if isinstance(activities, list):
            post_lines = []
            for activity in activities[:5]:
                if isinstance(activity, dict):
                    text = activity.get("text", "") or activity.get("title", "")
                    if text:
                        truncated = text[:200] + "..." if len(text) > 200 else text
                        post_lines.append(f"• {truncated}")
            recent_posts = "\n".join(post_lines)

        # Detect job change
        job_change = ""
        positions = raw.get("positions", []) or raw.get("experience", [])

        if isinstance(positions, list) and len(positions) > 0:
            current = positions[0]
            company = current.get("companyName", "") or current.get("company", "")
            title = current.get("title", "")
            date_range = current.get("dateRange", "")

            date_range_str = str(date_range) if date_range else ""
            current_year_str = str(datetime.now().year)
            if "Present" in date_range_str or current_year_str in date_range_str:
                if company and title:
                    job_change = f"Currently at {company} as {title}"

        # Get education
        education = raw.get("schools", []) or raw.get("education", [])
        education_summary = ""

        if isinstance(education, list):
            schools = [
                edu.get("schoolName", "") or edu.get("school", "")
                for edu in education[:2]
                if edu.get("schoolName") or edu.get("school")
            ]
            education_summary = ", ".join(schools)

        # Get skills
        skills = raw.get("skills", [])
        if isinstance(skills, list):
            # Extract skill names if they're objects
            skills = [
                s.get("name", s) if isinstance(s, dict) else s
                for s in skills[:10]
            ]

        # Get current company
        current_company = None
        if isinstance(positions, list) and len(positions) > 0:
            current_company = positions[0].get("companyName") or positions[0].get("company")

        # Get full name
        full_name = (
            basic_info.get("full_name", "") or
            raw.get("fullName", "") or
            f"{basic_info.get('first_name', '')} {basic_info.get('last_name', '')}".strip() or
            f"{raw.get('firstName', '')} {raw.get('lastName', '')}".strip()
        )

        return {
            "linkedin_bio": linkedin_bio.strip(),
            "recent_posts": recent_posts.strip(),
            "job_change": job_change,
            "recent_funding": "",
            "company_news": "",
            "mutual_connections": "",

            "_metadata": {
                "full_name": full_name,
                "first_name": basic_info.get("first_name") or raw.get("firstName"),
                "last_name": basic_info.get("last_name") or raw.get("lastName"),
                "headline": headline,
                "summary": summary,
                "location": basic_info.get("location") or raw.get("location", ""),
                "current_company": current_company,
                "connections": basic_info.get("connections") or raw.get("connectionsCount"),
                "follower_count": basic_info.get("followers") or raw.get("followersCount"),
                "education": education_summary,
                "skills": skills,
                "profile_url": basic_info.get("profile_url") or raw.get("url") or raw.get("publicIdentifier"),
                "scraped_at": datetime.utcnow().isoformat(),
            }
        }


# Singleton
_apify_service = None


def get_apify_service() -> ApifyLinkedInService:
    """Get or create Apify service singleton."""
    global _apify_service
    if _apify_service is None:
        _apify_service = ApifyLinkedInService()
    return _apify_service
