"""
Proxycurl LinkedIn Service - Simple LinkedIn Data Extraction

Much simpler than PhantomBuster:
- No agents to create
- No cookies to manage
- Just one API call
- 5-10 second response
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


class ProxycurlService:
    """Service for LinkedIn data extraction via Proxycurl API."""

    def __init__(self):
        self.api_key = os.getenv("PROXYCURL_API_KEY")
        self.base_url = "https://nubela.co/proxycurl/api/v2/linkedin"

    def scrape_profile(self, profile_url: str) -> Dict[str, Any]:
        """
        Scrape LinkedIn profile using Proxycurl.

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
                "PROXYCURL_API_KEY not set. Get free API key from https://nubela.co/proxycurl/"
            )

        # Build request URL with parameters
        params = {
            "url": profile_url,
            "fallback_to_cache": "on-error",
            "use_cache": "if-present",
            "skills": "include",
            "inferred_salary": "include",
            "personal_email": "include",
            "personal_contact_number": "include",
            "twitter_profile_id": "include",
            "facebook_profile_id": "include",
            "github_profile_id": "include",
            "extra": "include",
        }

        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }

        req = urllib.request.Request(url, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
                return self._normalize_for_research(data)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')

            if e.code == 401:
                raise ValueError("Invalid Proxycurl API key. Get one from https://nubela.co/proxycurl/")
            elif e.code == 404:
                raise Exception("LinkedIn profile not found or is private")
            elif e.code == 429:
                raise Exception("Rate limit exceeded. Upgrade your Proxycurl plan or wait.")
            else:
                raise Exception(f"Proxycurl API error {e.code}: {error_body}")

        except urllib.error.URLError as e:
            raise Exception(f"Network error: {str(e)}")

    def _normalize_for_research(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform Proxycurl data into ProspectResearch format.

        Returns dict matching ProspectResearch fields.
        """

        # Build LinkedIn bio from summary and headline
        linkedin_bio = ""
        if raw.get("headline"):
            linkedin_bio += f"{raw['headline']}\n\n"
        if raw.get("summary"):
            linkedin_bio += raw["summary"]

        # Format recent posts/activity (Proxycurl provides activities)
        recent_posts = ""
        if raw.get("activities") and isinstance(raw["activities"], list):
            post_lines = []
            for activity in raw["activities"][:5]:
                title = activity.get("title", "")
                link = activity.get("link", "")
                if title:
                    post_lines.append(f"• {title}")
            recent_posts = "\n".join(post_lines)

        # Detect recent job change
        job_change = ""
        experiences = raw.get("experiences", [])
        if experiences and len(experiences) > 0:
            current = experiences[0]
            starts_at = current.get("starts_at", {})

            # Check if started recently (within last year)
            if starts_at:
                year = starts_at.get("year")
                month = starts_at.get("month")
                if year and month:
                    # Simple check - if current year or last year
                    current_year = datetime.now().year
                    if year >= current_year - 1:
                        company = current.get("company")
                        title = current.get("title")
                        job_change = f"Recently joined {company} as {title}"

        # Extract company news from experiences
        company_news = ""
        if experiences and len(experiences) > 0:
            current = experiences[0]
            description = current.get("description", "")
            if description and len(description) > 50:
                company_news = description[:200] + "..." if len(description) > 200 else description

        # Format education
        education_summary = ""
        if raw.get("education") and isinstance(raw["education"], list):
            schools = [
                edu.get("school") for edu in raw["education"][:2]
                if edu.get("school")
            ]
            education_summary = ", ".join(schools)

        # Get skills
        skills = []
        if raw.get("skills") and isinstance(raw["skills"], list):
            skills = raw["skills"][:10]

        # Get current company
        current_company = None
        if experiences and len(experiences) > 0:
            current_company = experiences[0].get("company")

        return {
            "linkedin_bio": linkedin_bio.strip(),
            "recent_posts": recent_posts.strip(),
            "job_change": job_change,
            "recent_funding": "",  # Would need external news API
            "company_news": company_news,
            "mutual_connections": "",  # Not available via Proxycurl

            # Additional metadata
            "_metadata": {
                "full_name": raw.get("full_name"),
                "first_name": raw.get("first_name"),
                "last_name": raw.get("last_name"),
                "headline": raw.get("headline"),
                "summary": raw.get("summary"),
                "location": f"{raw.get('city', '')}, {raw.get('country', '')}".strip(", "),
                "current_company": current_company,
                "occupation": raw.get("occupation"),
                "connections": raw.get("connections"),
                "follower_count": raw.get("follower_count"),
                "education": education_summary,
                "skills": skills,
                "languages": raw.get("languages", []),
                "profile_url": raw.get("public_identifier"),
                "scraped_at": datetime.utcnow().isoformat(),

                # Contact info (if available)
                "personal_emails": raw.get("personal_emails", []),
                "personal_numbers": raw.get("personal_numbers", []),

                # Social profiles
                "twitter": raw.get("twitter_profile_id"),
                "github": raw.get("github_profile_id"),
            }
        }


# Singleton instance
_proxycurl_service = None


def get_proxycurl_service() -> ProxycurlService:
    """Get or create Proxycurl service singleton."""
    global _proxycurl_service
    if _proxycurl_service is None:
        _proxycurl_service = ProxycurlService()
    return _proxycurl_service
