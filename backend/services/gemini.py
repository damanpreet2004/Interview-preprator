import os
import json
from typing import List
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

from backend.models.schemas import ChatMessage, AnalysisResponse
from backend.utils.prompts import RESUME_ANALYSIS_INSTRUCTION, get_interviewer_system_instruction

# Load environment variables
# Path to .env relative to this file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Lazy-loaded client to avoid crashing at module import if GEMINI_API_KEY is not set yet
_client = None

def get_client() -> genai.Client:
    """
    Returns the initialized Gemini client, loading the API key lazily.
    """
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")
            
        if not api_key or not api_key.strip():
            raise ValueError(
                "Gemini API key is missing. Please add your GEMINI_API_KEY to the "
                "backend/.env file or environment variables."
            )
        _client = genai.Client(api_key=api_key)
    return _client

def analyze_resume_api(resume_text: str) -> dict:
    """
    Sends resume text to Gemini to perform analysis and return a structured JSON response.
    """
    if not resume_text or not resume_text.strip():
        raise ValueError("Resume text is empty. Please upload a valid resume first.")

    try:
        client = get_client()
        # Request a structured JSON output conforming to the AnalysisResponse schema
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Analyze this resume content:\n\n{resume_text}",
            config=types.GenerateContentConfig(
                system_instruction=RESUME_ANALYSIS_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=AnalysisResponse,
                temperature=0.2, # Lower temperature for more factual extraction
            )
        )
        
        # Parse the JSON response
        data = json.loads(response.text)
        return data
    except APIError as e:
        raise RuntimeError(f"Gemini API Error during analysis: {str(e)}")
    except ValueError as e:
        raise RuntimeError(str(e))
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse Gemini analysis JSON output: {str(e)}. Raw response: {response.text}")
    except Exception as e:
        raise RuntimeError(f"An unexpected error occurred during resume analysis: {str(e)}")

def generate_chat_reply(resume_text: str, history: List[ChatMessage], new_message: str) -> str:
    """
    Reconstructs the interview chat history and asks Gemini for the next follow-up/question.
    """
    try:
        client = get_client()
        
        # Convert schemas.ChatMessage back into google.genai.types.Content format for the SDK
        history_contents = []
        for msg in history:
            role = "user" if msg.role == "user" else "model"
            history_contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)]
                )
            )
        
        # Create a new chat session pre-populated with the history
        chat = client.chats.create(
            model="gemini-2.5-flash",
            history=history_contents,
            config=types.GenerateContentConfig(
                system_instruction=get_interviewer_system_instruction(resume_text),
                temperature=0.7, # Slightly higher temperature for dynamic interviewer responses
            )
        )
        
        # Send the new message to get the reply
        response = chat.send_message(new_message)
        return response.text
    except APIError as e:
        raise RuntimeError(f"Gemini API Error during chat: {str(e)}")
    except ValueError as e:
        raise RuntimeError(str(e))
    except Exception as e:
        raise RuntimeError(f"An unexpected error occurred during the chat: {str(e)}")
