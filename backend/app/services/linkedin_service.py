"""
LinkedIn Automation Service - PhantomBuster Integration

Auto-fetch LinkedIn profile data to populate prospect research.
"""

import os
import time
import json
from typing import Dict, Any, Optional
from datetime import datetime
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class LinkedInService:
    """Service for LinkedIn automation via PhantomBuster."""

    def __init__(self):
        self.api_key = os.getenv("PHANTOMBUSTER_API_KEY")
        self.linkedin_cookie = os.getenv("LINKEDIN_COOKIE")
        self.base_url = "https://api.phantombuster.com/api/v2"

        # Agent IDs from config
        self.PROFILE_SCRAPER_ID = "3807529390197070"
        self.MESSAGE_SENDER_ID = "4552989693488023"

    def scrape_profile(self, profile_url: str, timeout: int = 120) -> Dict[str, Any]:
        """
        Scrape a LinkedIn profile and return normalized data.

        Args:
            profile_url: LinkedIn profile URL (e.g., https://www.linkedin.com/in/someone/)
            timeout: Max wait time in seconds (default: 120)

        Returns:
            Dict with profile data ready for ProspectResearch fields

        Raises:
            ValueError: If credentials missing
            Exception: If scraping fails
        """
        if not self.api_key:
            raise ValueError("PHANTOMBUSTER_API_KEY not set in environment")
        if not self.linkedin_cookie:
            raise ValueError("LINKEDIN_COOKIE not set in environment")

        # Launch PhantomBuster agent
        # Build the argument object that the LinkedIn Profile Scraper expects
        agent_args = {
            "sessionCookie": self.linkedin_cookie,
            "spreadsheetUrl": profile_url,
        }

        headers = {
            "X-Phantombuster-Key": self.api_key,
            "Content-Type": "application/json"
        }

        # PhantomBuster API expects: { id: number, argument: string }
        # The argument must be a JSON string
        launch_payload = {
            "id": int(self.PROFILE_SCRAPER_ID),
            "argument": json.dumps(agent_args)
        }

        launch_data = json.dumps(launch_payload).encode('utf-8')

        launch_req = urllib.request.Request(
            f"{self.base_url}/agents/launch",
            data=launch_data,
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(launch_req, timeout=30) as resp:
                result = json.loads(resp.read())
                container_id = result.get("containerId")

                if not container_id:
                    raise Exception(f"Failed to launch agent: {result}")

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            raise Exception(f"PhantomBuster API error {e.code}: {error_body}")

        # Poll for completion
        start_time = time.time()

        while (time.time() - start_time) < timeout:
            status_req = urllib.request.Request(
                f"{self.base_url}/containers/fetch?id={container_id}",
                headers={"X-Phantombuster-Key": self.api_key}
            )

            with urllib.request.urlopen(status_req, timeout=30) as resp:
                container = json.loads(resp.read())
                status = container.get("status")

                if status == "success":
                    # Get output data
                    output_url = container.get("resultObject", {}).get("output")

                    if output_url:
                        output_req = urllib.request.Request(output_url)
                        with urllib.request.urlopen(output_req, timeout=30) as out_resp:
                            output_data = json.loads(out_resp.read())

                            if output_data and len(output_data) > 0:
                                profile = output_data[0]
                                return self._normalize_for_research(profile)

                    raise Exception("No profile data returned from PhantomBuster")

                elif status == "error":
                    error_msg = container.get("message", "Unknown error")
                    raise Exception(f"Scraping failed: {error_msg}")

            time.sleep(5)

        raise TimeoutError(f"Profile scraping timed out after {timeout}s")

    def _normalize_for_research(self, raw_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform PhantomBuster profile data into ProspectResearch format.

        Returns dict matching ProspectResearch fields:
        {
            "linkedin_bio": str,
            "recent_posts": str,
            "job_change": str,
            "recent_funding": str,
            "company_news": str,
            "mutual_connections": str
        }
        """

        # Build LinkedIn bio
        linkedin_bio = ""
        if raw_profile.get("headline"):
            linkedin_bio += f"{raw_profile['headline']}\n\n"
        if raw_profile.get("description") or raw_profile.get("summary"):
            linkedin_bio += (raw_profile.get("description") or raw_profile.get("summary", ""))

        # Format recent posts
        recent_posts = ""
        if raw_profile.get("posts") and isinstance(raw_profile["posts"], list):
            post_lines = []
            for post in raw_profile["posts"][:5]:  # Top 5 posts
                text = post.get("text", "")
                if text:
                    truncated = text[:200] + "..." if len(text) > 200 else text
                    likes = post.get("likes", 0)
                    post_lines.append(f"• {truncated} ({likes} likes)")
            recent_posts = "\n".join(post_lines)

        # Detect recent job change
        job_change = ""
        experience = raw_profile.get("jobs", [])
        if experience and len(experience) > 0:
            current = experience[0]
            duration = current.get("duration", "")
            company = current.get("companyName", "")
            title = current.get("jobTitle", "")

            # Check if duration indicates recent change
            duration_lower = duration.lower()
            if any(keyword in duration_lower for keyword in ["month", "months", "week", "weeks", "days"]):
                job_change = f"Recently joined {company} as {title}"
            elif "1 yr" in duration_lower or "1 year" in duration_lower:
                job_change = f"Joined {company} as {title} about 1 year ago"

        # Extract education for context (not a direct field but useful)
        education_summary = ""
        if raw_profile.get("schools") and isinstance(raw_profile["schools"], list):
            schools = [s.get("schoolName", "") for s in raw_profile["schools"][:2]]
            education_summary = ", ".join(filter(None, schools))

        # Get skills for additional context
        skills = raw_profile.get("skills", [])[:10] if raw_profile.get("skills") else []

        return {
            "linkedin_bio": linkedin_bio.strip(),
            "recent_posts": recent_posts.strip(),
            "job_change": job_change,
            "recent_funding": "",  # Requires external enrichment
            "company_news": "",     # Requires external enrichment
            "mutual_connections": "",  # Requires LinkedIn API access

            # Additional context (not ProspectResearch fields but useful)
            "_metadata": {
                "full_name": raw_profile.get("fullName"),
                "headline": raw_profile.get("headline"),
                "location": raw_profile.get("location"),
                "current_company": experience[0].get("companyName") if experience else None,
                "connections": raw_profile.get("connectionsCount"),
                "education": education_summary,
                "skills": skills,
                "profile_url": raw_profile.get("profileUrl"),
                "scraped_at": datetime.utcnow().isoformat(),
            }
        }

    def send_message(
        self,
        profile_url: str,
        message: str,
        timeout: int = 120
    ) -> Dict[str, Any]:
        """
        Send a LinkedIn message to a profile.

        Args:
            profile_url: LinkedIn profile URL
            message: Message text to send
            timeout: Max wait time in seconds

        Returns:
            {"success": bool, "message": str, "sent_at": str}
        """
        if not self.api_key or not self.linkedin_cookie:
            return {
                "success": False,
                "message": "PhantomBuster credentials not configured"
            }

        agent_args = {
            "sessionCookie": self.linkedin_cookie,
            "spreadsheetUrl": json.dumps([{
                "profileUrl": profile_url,
                "message": message
            }])
        }

        headers = {
            "X-Phantombuster-Key": self.api_key,
            "Content-Type": "application/json"
        }

        launch_data = json.dumps({
            "id": int(self.MESSAGE_SENDER_ID),
            "argument": json.dumps(agent_args)
        }).encode('utf-8')

        launch_req = urllib.request.Request(
            f"{self.base_url}/agents/launch",
            data=launch_data,
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(launch_req, timeout=30) as resp:
                result = json.loads(resp.read())
                container_id = result.get("containerId")

                if not container_id:
                    return {
                        "success": False,
                        "message": "Failed to launch message sender"
                    }

        except urllib.error.HTTPError as e:
            return {
                "success": False,
                "message": f"API error: {e.code}"
            }

        # Poll for completion
        start_time = time.time()

        while (time.time() - start_time) < timeout:
            status_req = urllib.request.Request(
                f"{self.base_url}/containers/fetch?id={container_id}",
                headers={"X-Phantombuster-Key": self.api_key}
            )

            with urllib.request.urlopen(status_req, timeout=30) as resp:
                container = json.loads(resp.read())
                status = container.get("status")

                if status == "success":
                    return {
                        "success": True,
                        "message": "LinkedIn message sent successfully",
                        "sent_at": datetime.utcnow().isoformat()
                    }
                elif status == "error":
                    return {
                        "success": False,
                        "message": container.get("message", "Unknown error")
                    }

            time.sleep(5)

        return {
            "success": False,
            "message": f"Timeout after {timeout}s"
        }


# Singleton instance
_linkedin_service: Optional[LinkedInService] = None


def get_linkedin_service() -> LinkedInService:
    """Get or create LinkedIn service singleton."""
    global _linkedin_service
    if _linkedin_service is None:
        _linkedin_service = LinkedInService()
    return _linkedin_service
