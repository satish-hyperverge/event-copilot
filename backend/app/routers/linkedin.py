"""
LinkedIn automation router - Proxycurl integration endpoints

Switched from PhantomBuster to Proxycurl for simplicity:
- No agents to create
- No cookies to manage
- Faster (5-10s vs 30-60s)
- More reliable
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.apify_linkedin_service import get_apify_service


router = APIRouter(prefix="/linkedin", tags=["linkedin"])


class ScrapeProfileRequest(BaseModel):
    profile_url: str


class SendMessageRequest(BaseModel):
    profile_url: str
    message: str


@router.post("/scrape-profile")
async def scrape_profile(request: ScrapeProfileRequest):
    """
    Auto-fetch LinkedIn profile data via Proxycurl API.

    Much simpler than PhantomBuster:
    - No agents to create
    - No cookies needed
    - Just one API call
    - 5-10 second response

    Returns normalized data ready to populate ProspectResearch fields:
    - linkedin_bio
    - recent_posts
    - job_change
    - (+ metadata like full_name, headline, etc.)
    """
    if not request.profile_url or "linkedin.com/in/" not in request.profile_url:
        raise HTTPException(
            status_code=400,
            detail="Invalid LinkedIn profile URL. Must contain 'linkedin.com/in/'"
        )

    service = get_apify_service()

    try:
        result = service.scrape_profile(request.profile_url)
        return {
            "success": True,
            "data": result
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to scrape profile: {str(e)}"
        )


@router.post("/send-message")
async def send_message(request: SendMessageRequest):
    """
    Send a LinkedIn message.

    NOTE: Proxycurl doesn't support sending messages.
    This endpoint is kept for future implementation.

    For now, messages must be sent manually via LinkedIn.
    """
    raise HTTPException(
        status_code=501,
        detail="Message sending not implemented with Proxycurl. Use LinkedIn directly or integrate a different service for automation."
    )


@router.get("/status")
async def check_status():
    """
    Check if LinkedIn automation is configured correctly.

    Returns configuration status and available features.
    """
    service = get_apify_service()

    return {
        "configured": bool(service.api_key),
        "has_api_key": bool(service.api_key),
        "service": "Proxycurl",
        "features": {
            "scrape_profile": bool(service.api_key),
            "send_message": False,  # Not supported by Proxycurl
        },
        "rate_limits": {
            "free_tier": "10 credits/month",
            "paid_tier": "Varies by plan",
            "speed": "5-10 seconds per profile"
        },
        "docs": "https://nubela.co/proxycurl/docs"
    }
