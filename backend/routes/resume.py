from fastapi import APIRouter, UploadFile, File, Header, HTTPException, status
from typing import Optional
import logging

from backend.services import parser, session, gemini
from backend.models.schemas import AnalysisResponse

router = APIRouter(prefix="/api/resume", tags=["resume"])
logger = logging.getLogger(__name__)

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    x_session_id: Optional[str] = Header(None)
):
    """
    Endpoint to upload a PDF/DOCX resume.
    Extracts text and associates it with the current session.
    """
    # Get or create the session
    current_session = session.get_or_create_session(x_session_id)
    
    # Read file content
    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )
            
        # Extract text
        extracted_text = parser.extract_text(content, file.filename)
        
        # Save to session state
        current_session.resume_text = extracted_text
        current_session.resume_filename = file.filename
        # Reset analysis and chats since a new resume is uploaded
        current_session.analysis = None
        current_session.chats = {}
        current_session.active_chat_id = None
        
        return {
            "session_id": current_session.session_id,
            "filename": file.filename,
            "message": "Resume uploaded and text extracted successfully."
        }
    except ValueError as e:
        logger.error(f"Validation error in resume upload: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing resume: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the resume: {str(e)}"
        )

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_resume(x_session_id: Optional[str] = Header(None)):
    """
    Analyzes the uploaded resume using Gemini and stores the result.
    If the analysis already exists, returns the cached version.
    """
    if not x_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID header (X-Session-ID) is missing."
        )
        
    current_session = session.get_or_create_session(x_session_id)
    
    if not current_session.resume_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No resume has been uploaded for this session yet."
        )
        
    # Return cached analysis if available
    if current_session.analysis:
        return current_session.analysis
        
    # Trigger Gemini Analysis
    try:
        analysis_data = gemini.analyze_resume_api(current_session.resume_text)
        current_session.analysis = analysis_data
        return analysis_data
    except Exception as e:
        logger.error(f"Error during resume analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/status")
async def get_resume_status(x_session_id: Optional[str] = Header(None)):
    """
    Returns the current resume upload and analysis status for the session.
    """
    current_session = session.get_or_create_session(x_session_id)
    return {
        "session_id": current_session.session_id,
        "has_resume": bool(current_session.resume_text),
        "filename": current_session.resume_filename,
        "has_analysis": bool(current_session.analysis)
    }
