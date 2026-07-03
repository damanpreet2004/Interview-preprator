from pydantic import BaseModel
from typing import List, Dict, Optional

class ChatMessage(BaseModel):
    role: str  # Must be 'user' or 'model' for Gemini compatibility
    content: str

class ChatSession(BaseModel):
    id: str
    title: str
    messages: List[ChatMessage] = []

class UserSession(BaseModel):
    session_id: str
    resume_text: str = ""
    resume_filename: str = ""
    analysis: Optional[Dict] = None
    chats: Dict[str, ChatSession] = {}
    active_chat_id: Optional[str] = None

class AnalysisResponse(BaseModel):
    summary: str
    technical_skills: List[str]
    soft_skills: List[str]
    projects: List[str]
    improvements: List[str]
    weak_bullet_points: List[str]
    missing_skills: List[str]

class ChatRequest(BaseModel):
    chat_id: str
    message: str

class ChatResponse(BaseModel):
    chat_id: str
    reply: str

class NewChatResponse(BaseModel):
    chat_id: str
    title: str

class ChatHistoryItem(BaseModel):
    id: str
    title: str

class ChatHistoryResponse(BaseModel):
    chats: List[ChatHistoryItem]
