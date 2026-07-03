import uuid
from typing import Dict, List, Optional
from backend.models.schemas import UserSession, ChatSession, ChatMessage, ChatHistoryItem

# In-memory dictionary acting as the global database for session states
# Maps session_id (UUID) -> UserSession
_sessions_db: Dict[str, UserSession] = {}

def get_or_create_session(session_id: Optional[str]) -> UserSession:
    """
    Retrieves an existing user session or creates a new one if it doesn't exist or is invalid.
    """
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if session_id not in _sessions_db:
        _sessions_db[session_id] = UserSession(session_id=session_id)
        
    return _sessions_db[session_id]

def new_chat(session_id: str, title: str = "New Chat") -> ChatSession:
    """
    Creates a new chat under the given session, sets it as active, and returns it.
    """
    session = get_or_create_session(session_id)
    chat_id = str(uuid.uuid4())
    chat = ChatSession(id=chat_id, title=title, messages=[])
    session.chats[chat_id] = chat
    session.active_chat_id = chat_id
    return chat

def get_chat(session_id: str, chat_id: str) -> Optional[ChatSession]:
    """
    Retrieves a specific chat by ID within a user session.
    """
    session = get_or_create_session(session_id)
    return session.chats.get(chat_id)

def get_chat_history(session_id: str) -> List[ChatHistoryItem]:
    """
    Returns a list of all chat titles and IDs in the session.
    """
    session = get_or_create_session(session_id)
    # Sort them in creation order, or just return as a list
    return [ChatHistoryItem(id=c.id, title=c.title) for c in session.chats.values()]

def add_message(session_id: str, chat_id: str, role: str, content: str) -> ChatMessage:
    """
    Appends a new message to the chat history.
    """
    session = get_or_create_session(session_id)
    if chat_id not in session.chats:
        raise ValueError(f"Chat with ID {chat_id} does not exist in this session.")
        
    msg = ChatMessage(role=role, content=content)
    session.chats[chat_id].messages.append(msg)
    return msg

def update_chat_title(session_id: str, chat_id: str, title: str):
    """
    Updates the display title of a specific chat session.
    """
    session = get_or_create_session(session_id)
    if chat_id in session.chats:
        session.chats[chat_id].title = title
