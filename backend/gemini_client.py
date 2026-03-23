import os 
import websockets
import json
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HOST = "generativelanguage.googleapis.com"
MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025"
WS_URL = f"wss://{HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={GEMINI_API_KEY}"

class GeminiLiveSession:
    def __init__(self):
        self.ws = None
        self.emergency_flag = False
        self.journal_data = None # 🛠️ NEW: Holds the generated journal

    async def connect(self):
        self.ws = await websockets.connect(WS_URL, open_timeout=30)
        setup_message = {
            "setup": {
                "model": MODEL,
                "tools": [{
                    "functionDeclarations": [
                        {
                            "name": "trigger_emergency_resources",
                            "description": "Call this tool IMMEDIATELY if the user mentions self-harm, suicide, severe depression, or being in immediate physical/mental danger.",
                        },
                        # 🛠️ NEW: The automated journaling tool
                        {
                            "name": "save_journal_entry",
                            "description": "Call this tool at the very end of the session to automatically save a summary of the conversation.",
                            "parameters": {
                                "type": "OBJECT",
                                "properties": {
                                    "summary": {"type": "STRING", "description": "A concise, 2-sentence clinical summary of what the user discussed."},
                                    "mood": {"type": "STRING", "description": "The user's primary mood (e.g., Calm, Anxious, Stressed, Happy)."}
                                },
                                "required": ["summary", "mood"]
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Aoede"}}
                    }
                },
                "systemInstruction": {
                    "parts": [{"text": """Your name is Aura. You are an empathetic, active-listening AI emotional companion. You have access to a live video and audio feed of the user.
                    CORE BEHAVIORS:
                    1. EMPATHY FIRST: Validate the user's emotions.
                    2. ACTIVE LISTENING: Ask open-ended questions to help the user explore their feelings.
                    3. VISUAL AWARENESS: Observe their facial expressions and gently acknowledge them.
                    4. SAFETY FIRST: If the user mentions self-harm or severe crisis, call `trigger_emergency_resources` immediately.
                    5. PACING: Keep your spoken responses concise, soft, and conversational."""}]
                }
            }
        }
        await self.ws.send(json.dumps(setup_message))
        print("Gemini Live Session Initialized:", await self.ws.recv())

    async def handle_tool_call(self, tool_call):
        responses = []
        for call in tool_call.get("functionCalls", []):
            name = call.get("name")
            call_id = call.get("id")

            if name == "trigger_emergency_resources":
                print("🚨 AI Triggered Emergency Protocol!")
                self.emergency_flag = True 
                responses.append({
                    "id": call_id,
                    "response": {"result": "Emergency UI triggered successfully."}
                })
            
            # 🛠️ NEW: Intercept the automated journal tool
            elif name == "save_journal_entry":
                print("📝 AI is generating the automatic journal!")
                args = call.get("args", {})
                self.journal_data = {
                    "summary": args.get("summary", "Session concluded naturally."),
                    "mood": args.get("mood", "Neutral")
                }
                responses.append({
                    "id": call_id,
                    "response": {"result": "Journal saved successfully. You may now end the session."}
                })

        if responses:
            await self.ws.send(json.dumps({"toolResponse": {"functionResponses": responses}}))

    # 🛠️ NEW: The hidden prompt that triggers the AI to write the journal
    async def request_journal_summary(self):
        msg = {
            "clientContent": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": "I am ending the session now. Please silently call the `save_journal_entry` tool to summarize our entire conversation and assess my mood based on what I said. Do not speak out loud."}]
                }],
                "turnComplete": True
            }
        }
        await self.ws.send(json.dumps(msg))

    async def send_audio(self, base64_audio):
        await self.ws.send(json.dumps({"realtimeInput": {"mediaChunks": [{"mimeType": "audio/pcm;rate=16000", "data": base64_audio}]}}))

    async def send_video(self, base64_image):
        await self.ws.send(json.dumps({"realtimeInput": {"mediaChunks": [{"mimeType": "image/jpeg", "data": base64_image}]}}))

    async def receive_audio_stream(self):
        try:
            while True:
                response = await self.ws.recv()
                data = json.loads(response)

                if "toolCall" in data:
                    await self.handle_tool_call(data["toolCall"])
                    continue

                if "serverContent" in data and "modelTurn" in data["serverContent"]:
                    for part in data["serverContent"]["modelTurn"]["parts"]:
                        if "inlineData" in part:
                            yield {"type": "audio", "data": part["inlineData"]["data"]}
                            
                if self.emergency_flag:
                    yield {"type": "emergency"}
                    self.emergency_flag = False

                # 🛠️ NEW: Yield the journal data up to FastAPI so it can save it
                if self.journal_data:
                    yield {"type": "journal_generated", "data": self.journal_data}
                    self.journal_data = None

        except websockets.exceptions.ConnectionClosed:
            print("WebSocket closed.")


    async def request_journal_summary(self):
        msg = {
            "clientContent": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": "SYSTEM COMMAND: The user has ended the session. You MUST immediately execute the `save_journal_entry` tool right now to summarize the conversation. Do NOT generate any spoken audio or text response. ONLY use the tool."}]
                }],
                "turnComplete": True
            }
        }
        await self.ws.send(json.dumps(msg))

    async def close(self):
        if self.ws: await self.ws.close()