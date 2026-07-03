USE 
Set-Location -Path 'C:\[YourRootFolder]\[python]\interview preprator'; python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
to run the application


also create an .env file with
GEMINI_API_KEY = [your gemini api key]
