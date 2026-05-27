"""
RapidAPI LinkedIn Service - Simple LinkedIn Data Extraction

Uses RapidAPI's "Realtime LinkedIn Data Scraper"
- Simple REST API
- Fast responses
- No complex setup
"""

import os
import json
from typing import Dict, Any
from datetime import datetime
import urllib.request
import urllib.parse
import urllib.error
from dotenv import load_dotenv

load_dotenv()


class RapidAPILinkedInService:
    """Service for LinkedIn data extraction via RapidAPI."""

    def __init__(self):
        self.api_key = os.getenv("RAPIDAPI_KEY")
        self.api_host = "realtime-linkdin-data-scraper.p.rapidapi.com"
        self.base_url = f"https://{self.api_host}"

    def scrape_profile(self, profile_url: str) -> Dict[str, Any]:
        """
        Scrape LinkedIn profile using RapidAPI.

        Args:
            profile_url: LinkedIn profile URL

        Returns:
            Dict with normalized research data

        Raises:
            ValueError: If API key not configured
            Exception: If API call fails
        """
        if not self.api_key:
            raise ValueError(
                "RAPIDAPI_KEY not set. Get your key from https://rapidapi.com/"
            )

        # Extract profile username from URL
        # https://www.linkedin.com/in/username/ -> username
        if "/in/" in profile_url:
            username = profile_url.split("/in/")[1].strip("/").split("?")[0]
        else:
            raise ValueError("Invalid LinkedIn profile URL format")

        # RapidAPI endpoint for profile data
        # Try different possible endpoints
        endpoint = f"{self.base_url}/profile.php?username={username}"

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.api_host,
            "Content-Type": "application/json"
        }

        req = urllib.request.Request(endpoint, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())

                # Check if we got valid data
                if isinstance(data, dict) and data.get("error"):
                    raise Exception(f"API error: {data.get('error')}")

                return self._normalize_for_research(data, profile_url)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')

            if e.code == 401:
                raise ValueError("Invalid RapidAPI key")
            elif e.code == 403:
                raise ValueError("RapidAPI subscription required or rate limit exceeded")
            elif e.code == 404:
                # Try alternative endpoint format
                raise Exception("Profile endpoint not found. The API might use a different endpoint format.")
            elif e.code == 429:
                raise Exception("Rate limit exceeded. Upgrade your RapidAPI plan or wait.")
            else:
                raise Exception(f"RapidAPI error {e.code}: {error_body}")

        except urllib.error.URLError as e:
            raise Exception(f"Network error: {str(e)}")

    def scrape_profile_alternative(self, profile_url: str) -> Dict[str, Any]:
        """
        Alternative method using direct profile URL as parameter.

        Some RapidAPI endpoints expect the full URL.
        """
        if not self.api_key:
            raise ValueError("RAPIDAPI_KEY not set")

        # Try with full URL as parameter
        params = urllib.parse.urlencode({"url": profile_url})
        endpoint = f"{self.base_url}/getProfile?{params}"

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.api_host,
            "Content-Type": "application/json"
        }

        req = urllib.request.Request(endpoint, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
                return self._normalize_for_research(data, profile_url)
        except Exception as e:
            # If this also fails, return helpful error
            raise Exception(f"Could not fetch profile. API might need different endpoint. Error: {str(e)}")

    def _normalize_for_research(self, raw: Dict[str, Any], profile_url: str) -> Dict[str, Any]:
        """
        Transform RapidAPI data into ProspectResearch format.

        The exact format depends on the API response structure.
        This handles common LinkedIn data formats.
        """

        # Build LinkedIn bio from available fields
        linkedin_bio = ""

        # Try different possible field names
        headline = (raw.get("headline") or raw.get("title") or
                   raw.get("current_position") or raw.get("occupation") or "")
        summary = (raw.get("summary") or raw.get("about") or
                  raw.get("bio") or raw.get("description") or "")

        if headline:
            linkedin_bio += f"{headline}\n\n"
        if summary:
            linkedin_bio += summary

        # Format recent posts/activity
        recent_posts = ""
        posts = (raw.get("posts") or raw.get("activities") or
                raw.get("recent_activity") or [])

        if isinstance(posts, list) and posts:
            post_lines = []
            for post in posts[:5]:
                if isinstance(post, dict):
                    text = post.get("text") or post.get("content") or post.get("title") or ""
                    if text:
                        truncated = text[:200] + "..." if len(text) > 200 else text
                        post_lines.append(f"• {truncated}")
                elif isinstance(post, str):
                    post_lines.append(f"• {post[:200]}")
            recent_posts = "\n".join(post_lines)

        # Detect recent job change
        job_change = ""
        experience = (raw.get("experience") or raw.get("positions") or
                     raw.get("work_experience") or [])

        if isinstance(experience, list) and len(experience) > 0:
            current = experience[0]
            if isinstance(current, dict):
                company = current.get("company") or current.get("company_name") or ""
                title = current.get("title") or current.get("position") or ""
                start_date = current.get("start_date") or current.get("starts_at") or ""

                # Check if recent (contains current year or "Present")
                current_year = str(datetime.now().year)
                if "Present" in str(start_date) or current_year in str(start_date):
                    if company and title:
                        job_change = f"Currently at {company} as {title}"

        # Get current company
        current_company = None
        if isinstance(experience, list) and len(experience) > 0:
            current = experience[0]
            if isinstance(current, dict):
                current_company = current.get("company") or current.get("company_name")

        # Get education
        education = (raw.get("education") or raw.get("schools") or [])
        education_summary = ""
        if isinstance(education, list):
            schools = []
            for edu in education[:2]:
                if isinstance(edu, dict):
                    school = edu.get("school") or edu.get("school_name") or edu.get("institution")
                    if school:
                        schools.append(school)
            education_summary = ", ".join(schools)

        # Get skills
        skills = raw.get("skills") or []
        if isinstance(skills, list):
            skills = skills[:10]

        # Get name
        full_name = (raw.get("full_name") or raw.get("name") or
                    raw.get("firstName", "") + " " + raw.get("lastName", "")).strip()

        # Get location
        location = (raw.get("location") or raw.get("city") or
                   raw.get("country") or "")

        return {
            "linkedin_bio": linkedin_bio.strip(),
            "recent_posts": recent_posts.strip(),
            "job_change": job_change,
            "recent_funding": "",  # Would need external source
            "company_news": "",     # Would need external source
            "mutual_connections": "",  # Not usually available via API

            # Additional metadata
            "_metadata": {
                "full_name": full_name,
                "headline": headline,
                "summary": summary,
                "location": location,
                "current_company": current_company,
                "connections": raw.get("connections") or raw.get("connections_count"),
                "follower_count": raw.get("followers") or raw.get("follower_count"),
                "education": education_summary,
                "skills": skills,
                "profile_url": profile_url,
                "scraped_at": datetime.utcnow().isoformat(),
                "raw_data_available": True,
            }
        }


# Singleton instance
_rapidapi_service = None


def get_rapidapi_service() -> RapidAPILinkedInService:
    """Get or create RapidAPI service singleton."""
    global _rapidapi_service
    if _rapidapi_service is None:
        _rapidapi_service = RapidAPILinkedInService()
    return _rapidapi_service
