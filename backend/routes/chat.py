from fastapi import APIRouter, Header, HTTPException, status
from typing import Optional, List
import logging

from backend.services import session, gemini
from backend.models import schemas

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)

@router.post("/new", response_model=schemas.NewChatResponse)
async def create_new_chat(x_session_id: Optional[str] = Header(None)):
    """
    Creates a new chat session under the current session.
    """
    if not x_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID header (X-Session-ID) is missing."
        )
        
    current_session = session.get_or_create_session(x_session_id)
    chat = session.new_chat(current_session.session_id)
    
    return schemas.NewChatResponse(chat_id=chat.id, title=chat.title)

@router.get("/history", response_model=schemas.ChatHistoryResponse)
async def get_chats(x_session_id: Optional[str] = Header(None)):
    """
    Returns the list of all chat sessions for the current session.
    """
    if not x_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID header (X-Session-ID) is missing."
        )
        
    history = session.get_chat_history(x_session_id)
    return schemas.ChatHistoryResponse(chats=history)

@router.get("/{chat_id}", response_model=List[schemas.ChatMessage])
async def get_chat_messages(chat_id: str, x_session_id: Optional[str] = Header(None)):
    """
    Returns the messages of a specific chat.
    """
    if not x_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID header (X-Session-ID) is missing."
        )
        
    chat = session.get_chat(x_session_id, chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found."
        )
        
    return chat.messages

@router.post("", response_model=schemas.ChatResponse)
async def send_message(
    payload: schemas.ChatRequest,
    x_session_id: Optional[str] = Header(None)
):
    """
    Sends a message in a specific chat, gets a reply from Gemini,
    and updates session history.
    """
    if not x_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID header (X-Session-ID) is missing."
        )
        
    current_session = session.get_or_create_session(x_session_id)
    
    # 1. Verify candidate resume is uploaded
    if not current_session.resume_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mock interview requires a resume. Please upload a PDF or DOCX resume first."
        )
        
    # 2. Verify the chat exists
    chat = session.get_chat(current_session.session_id, payload.chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found."
        )
        
    # 3. Retrieve prior chat history (excluding the new user message)
    # We copy the list to avoid mutations during Gemini call
    history = list(chat.messages)
    
    # 4. Save user's message to the session database
    session.add_message(
        session_id=current_session.session_id,
        chat_id=payload.chat_id,
        role="user",
        content=payload.message
    )
    
    # 5. Generate chat reply using Gemini
    try:
        reply_content = gemini.generate_chat_reply(
            resume_text=current_session.resume_text,
            history=history,
            new_message=payload.message
        )
        
        # 6. Save model's reply to the session database
        session.add_message(
            session_id=current_session.session_id,
            chat_id=payload.chat_id,
            role="model",
            content=reply_content
        )
        
        # 7. Auto-update chat title if it's the first message
        if len(history) == 0:
            title = payload.message[:30]
            if len(payload.message) > 30:
                title += "..."
            session.update_chat_title(
                session_id=current_session.session_id,
                chat_id=payload.chat_id,
                title=title
            )
            
        return schemas.ChatResponse(chat_id=payload.chat_id, reply=reply_content)
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
