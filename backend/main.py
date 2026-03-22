from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gemini_client import GeminiLiveSession
from datetime import datetime
from google import genai
from google.genai import types
from datetime import datetime
import asyncio
import json
import uvicorn
import os
import sqlite3

app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# --- DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect("app.db")
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, fullname TEXT, email TEXT UNIQUE, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS journals (id INTEGER PRIMARY KEY, user_id INTEGER, date TEXT, summary TEXT, mood TEXT)''')
    conn.commit()
    conn.close()

init_db()

# --- AUTH & API ROUTES ---
class User(BaseModel):
    fullname: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

@app.post("/api/signup")
def signup(user: User):
    conn = sqlite3.connect("app.db")
    try:
        conn.execute("INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)", (user.fullname, user.email, user.password)) # In production, hash this password!
        conn.commit()
        return {"message": "User created successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")
    finally:
        conn.close()

@app.post("/api/login")
def login(user: UserLogin):
    conn = sqlite3.connect("app.db")
    # 🛠️ 3. Update the SELECT statement to fetch the fullname alongside the ID
    cursor = conn.execute(
        "SELECT id, fullname FROM users WHERE email=? AND password=?", 
        (user.email, user.password)
    )
    row = cursor.fetchone()
    conn.close()
    
    if row: 
        # row[0] is the ID, row[1] is the fullname
        return {
            "user_id": row[0], 
            "email": user.email, 
            "fullname": row[1] 
        }
        
    raise HTTPException(status_code=401, detail="Invalid credentials")

# --- WEBSOCKET ROUTE ---
@app.websocket("/ws/session")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    gemini_session = GeminiLiveSession()
    await gemini_session.connect()

    async def receive_from_client():
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                if message.get("type") == "audio":
                    await gemini_session.send_audio(message["data"])
                elif message.get("type") == "video":
                    await gemini_session.send_video(message["data"])
                # 🛠️ NEW: Catch the end session command
                elif message.get("type") == "end_session":
                    # Save the user ID so we know who to attach the journal to
                    gemini_session.current_user_id = message.get("user_id", 1)
                    # Trigger the hidden prompt!
                    await gemini_session.request_journal_summary()
        except Exception as e:
            print(f"Client disconnected: {e}")

    async def send_to_client():
        try:
            async for payload in gemini_session.receive_audio_stream():
                if payload["type"] == "audio":
                    await websocket.send_text(json.dumps({"type": "audio_response", "data": payload["data"]}))
                elif payload["type"] == "emergency":
                    await websocket.send_text(json.dumps({"type": "trigger_emergency"}))
                # 🛠️ NEW: Receive the AI's journal and save it to SQLite!
                elif payload["type"] == "journal_generated":
                    summary = payload["data"]["summary"]
                    mood = payload["data"]["mood"]
                    user_id = getattr(gemini_session, 'current_user_id', 1)
                    date_str = datetime.now().strftime("%b %d, %Y")

                    conn = sqlite3.connect("app.db")
                    conn.execute("INSERT INTO journals (user_id, date, summary, mood) VALUES (?, ?, ?, ?)", 
                                 (user_id, date_str, summary, mood))
                    conn.commit()
                    conn.close()

                    # Tell the React frontend the journal is saved and it can redirect now
                    await websocket.send_text(json.dumps({"type": "journal_saved"}))
                    
        except Exception as e:
            print(f"Send error: {e}")

    rx = asyncio.create_task(receive_from_client())
    tx = asyncio.create_task(send_to_client())
    done, pending = await asyncio.wait([rx, tx], return_when=asyncio.FIRST_COMPLETED)
    for task in pending: task.cancel()
    await gemini_session.close()


class JournalRequest(BaseModel):
    user_id: int
    session_notes: str 

# 🛠️ NEW: Define the exact structure we want Gemini to return
class JournalSummary(BaseModel):
    summary: str
    mood: str

@app.post("/api/journals/generate")
def generate_and_save_journal(request: JournalRequest):
    """
    Takes raw session notes, uses the new Gemini SDK to generate a clinical summary,
    enforces a strict JSON output, and saves it to SQLite.
    """
    try:
        prompt = f"""
        You are an AI therapist's assistant. Analyze the following session notes.
        1. Write a concise, professional, 2-sentence summary of the session.
        2. Identify the user's primary mood (e.g., Calm, Anxious, Stressed, Relieved, Hopeful).
        
        Session Notes: "{request.session_notes}"
        """
        
        # 🛠️ NEW: Using the latest generate_content method with strict JSON schema
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=JournalSummary, # Forces the output to match our Pydantic model!
                temperature=0.2 # Lower temperature for more clinical/focused responses
            ),
        )
        
        # Because we used response_schema, response.text is guaranteed to be clean JSON
        ai_data = json.loads(response.text)
        
        summary = ai_data.get("summary", "Session completed successfully.")
        mood = ai_data.get("mood", "Neutral")
        date_str = datetime.now().strftime("%b %d, %Y")

        # Save to SQLite
        conn = sqlite3.connect("app.db")
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO journals (user_id, date, summary, mood) VALUES (?, ?, ?, ?)",
            (request.user_id, date_str, summary, mood)
        )
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()

        return {"id": new_id, "date": date_str, "summary": summary, "mood": mood}

    except Exception as e:
        print(f"Error generating journal: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate journal summary")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)

