import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Video, Power, Mic, MicOff, Activity, SwitchCamera, PhoneCall } from 'lucide-react';

export default function Session() {
  const navigate = useNavigate();

  // Core States
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false); 
  const [mediaStream, setMediaStream] = useState(null); 
  const [facingMode, setFacingMode] = useState("user"); 
  const [isMuted, setIsMuted] = useState(false); 
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamIntervalRef = useRef(null);
  
  // Audio Refs
  const audioContextRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef([]); 

  // 1. Establish WebSocket Connection
  useEffect(() => {
    wsRef.current = new WebSocket('ws://127.0.0.1:8000/ws/session');
    
    wsRef.current.onopen = () => {
      console.log('Connected to Aura Backend');
      setIsConnected(true);
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'audio_response') {
        playAudioChunk(message.data);
      } else if (message.type === 'trigger_emergency') {
        setShowEmergencyModal(true);
      } else if (message.type === 'journal_saved') {
        // 🛠️ NEW: The backend finished saving the automated journal! Now we redirect.
        wsRef.current.close();
        navigate('/dashboard');
      }
    };

    wsRef.current.onclose = () => setIsConnected(false);

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [navigate]);

  // 2. Attach Video Stream to Element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [videoRef.current, mediaStream]);

  // 3. Audio Playback Engine
  const stopAudioPlayback = () => {
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); source.disconnect(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    setIsAiSpeaking(false); 
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  const playAudioChunk = (base64Audio) => {
    if (!audioContextRef.current) return;

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcm16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(pcm16Data.length);
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 0x7FFF;
    }

    const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    activeSourcesRef.current.push(source);
    setIsAiSpeaking(true); 

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setIsAiSpeaking(false); 
      }
    };

    const currentTime = audioContextRef.current.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime; 
    }
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  };

  // 4. Media Capture & Voice Activity Detection
  const startMedia = async (targetFacingMode = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: targetFacingMode }, 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } 
      });
      
      if (isMuted) stream.getAudioTracks()[0].enabled = false;
      setMediaStream(stream); 

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.isSpeaking = false;
            this.silenceFrames = 0;
            this.volumeThreshold = 0.03; 
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const float32Data = input[0];
              const pcm16Data = new Int16Array(float32Data.length);
              let maxAmplitude = 0;
              for (let i = 0; i < float32Data.length; i++) {
                const val = float32Data[i];
                if (Math.abs(val) > maxAmplitude) maxAmplitude = Math.abs(val);
                pcm16Data[i] = Math.max(-1, Math.min(1, val)) * 0x7FFF;
              }
              if (maxAmplitude > this.volumeThreshold) {
                if (!this.isSpeaking) {
                  this.isSpeaking = true;
                  this.port.postMessage({ event: 'speech_started' });
                }
                this.silenceFrames = 0;
              } else {
                this.silenceFrames++;
                if (this.isSpeaking && this.silenceFrames > 60) {
                  this.isSpeaking = false;
                  this.port.postMessage({ event: 'speech_stopped' });
                }
              }
              this.port.postMessage({ event: 'audio_data', buffer: pcm16Data.buffer }, [pcm16Data.buffer]);
            }
            return true; 
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(workletUrl);

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
      audioWorkletNodeRef.current = workletNode;
      source.connect(workletNode);

      workletNode.port.onmessage = (event) => {
        const { data } = event;
        if (data.event === 'speech_started') {
          setIsUserSpeaking(true);
          stopAudioPlayback(); 
        } else if (data.event === 'speech_stopped') {
          setIsUserSpeaking(false);
        } else if (data.event === 'audio_data') {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const buffer = new Uint8Array(data.buffer);
          let binary = '';
          for (let i = 0; i < buffer.byteLength; i++) {
            binary += String.fromCharCode(buffer[i]);
          }
          wsRef.current.send(JSON.stringify({ type: 'audio', data: btoa(binary) }));
        }
      };
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  // 5. Video Frame Capture
  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const MAX_WIDTH = 640; 
    const scale = MAX_WIDTH / videoRef.current.videoWidth;
    canvas.width = MAX_WIDTH;
    canvas.height = videoRef.current.videoHeight * scale;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    wsRef.current.send(JSON.stringify({ type: 'video', data: base64Image }));
  };

  // 6. UI Controls
  const toggleCamera = async () => {
    if (!mediaStream) return;
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);
    try {
      clearInterval(streamIntervalRef.current);
      if (audioWorkletNodeRef.current) audioWorkletNodeRef.current.disconnect();
      mediaStream.getTracks().forEach(track => track.stop());
      stopAudioPlayback(); 
      setMediaStream(null);
      await new Promise(resolve => setTimeout(resolve, 200));
      await startMedia(newFacingMode);
      setTimeout(() => captureAndSendFrame(), 800);
      streamIntervalRef.current = setInterval(captureAndSendFrame, 2000);
    } catch (err) {
      console.error("Camera switch failed:", err);
    }
  };

  const toggleMute = () => {
    if (mediaStream) {
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // 7. Session Lifecycle Management
  const startSession = () => {
    startMedia();
    streamIntervalRef.current = setInterval(captureAndSendFrame, 2000);
    setIsStreaming(true);
  };

  const handleEndSession = () => {
    // Stop all streaming
    clearInterval(streamIntervalRef.current);
    if (audioWorkletNodeRef.current) audioWorkletNodeRef.current.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    stopAudioPlayback(); 
    setMediaStream(null); 
    setIsStreaming(false);
    setIsUserSpeaking(false);
    setIsAiSpeaking(false);
    setIsMuted(false);

    // 🛠️ NEW: 100% Automated Magic
    alert("Aura is automatically summarizing your session. Please wait a moment...");
    const storedUser = JSON.parse(localStorage.getItem('user')); 
    
    // Trigger the backend to ask Gemini for the summary
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'end_session', 
        user_id: storedUser?.user_id || 1 
      }));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-5xl mx-auto h-[calc(100vh-80px)] relative">
      <canvas ref={canvasRef} className="hidden" />

      {/* EMERGENCY MODAL */}
      {showEmergencyModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-3xl">
          <div className="bg-gray-900 border-2 border-red-500 p-8 rounded-2xl max-w-lg text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]">
            <h2 className="text-3xl font-bold text-red-500 mb-4">Emergency Resources</h2>
            <p className="text-gray-300 mb-6">Aura detected you might be in distress. You are not alone. Please reach out to professional help immediately.</p>
            <div className="space-y-4">
              <a href="tel:112" className="flex items-center justify-center gap-3 bg-red-600/20 text-red-400 p-4 rounded-xl border border-red-500/50 hover:bg-red-600/40 transition-colors">
                <PhoneCall /> National Emergency Number: 112
              </a>
              <a href="tel:08002202020" className="flex items-center justify-center gap-3 bg-red-600/20 text-red-400 p-4 rounded-xl border border-red-500/50 hover:bg-red-600/40 transition-colors">
                <PhoneCall /> Mentally Aware Nigeria Hotline
              </a>
            </div>
            <button onClick={() => setShowEmergencyModal(false)} className="mt-8 text-sm text-gray-500 hover:text-white transition-colors">Dismiss</button>
          </div>
        </div>
      )}

      {!isStreaming ? (
        /* IDLE STATE */
        <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative flex items-center justify-center w-48 h-48 rounded-full bg-purple-900/20 border border-purple-500/30 shadow-[0_0_60px_-15px_rgba(168,85,247,0.4)]">
            <Bot size={80} className="text-purple-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-white">Ready to talk?</h2>
            <p className="text-gray-400 max-w-md">Allow camera and microphone access to begin your safe space session with Aura.</p>
          </div>
          <button 
            onClick={startSession}
            disabled={!isConnected}
            className={`flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg ${
              isConnected 
                ? 'bg-purple-600 hover:bg-purple-500 hover:shadow-purple-600/50 hover:-translate-y-1 text-white' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Video size={24} />
            Start Session
          </button>
        </div>
      ) : (
        /* ACTIVE CALL STATE */
        <div className="w-full h-full flex flex-col gap-4">
          
          {/* UPPER VIEW: USER CAMERA */}
          <div className="flex-1 relative bg-gray-900 rounded-3xl overflow-hidden border border-gray-800 shadow-xl group min-h-[40%]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover transition-transform duration-300" 
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }} 
            />
            
            <button
              onClick={toggleMute}
              className={`absolute top-4 left-4 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-3 border transition-all active:scale-95 shadow-lg z-10 ${
                isMuted ? 'bg-red-900/60 border-red-700/50' : 'bg-black/60 border-gray-700/50 hover:bg-black/80'
              }`}
            >
              {isMuted ? (
                <MicOff size={18} className="text-red-400" />
              ) : isUserSpeaking ? (
                <Activity size={18} className="text-green-400 animate-pulse" />
              ) : (
                <Mic size={18} className="text-gray-400" />
              )}
              <span className={`text-sm font-medium ${isMuted ? 'text-red-200' : 'text-gray-200'}`}>
                {isMuted ? 'Muted' : 'You'}
              </span>
            </button>

            <button
              onClick={toggleCamera}
              className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-xl text-white hover:bg-black/80 hover:text-purple-400 transition-all active:scale-95 border border-gray-700/50 shadow-lg z-10"
            >
              <SwitchCamera size={22} />
            </button>
          </div>

          {/* LOWER VIEW: AI AVATAR */}
          <div className="flex-1 relative bg-gray-900 rounded-3xl overflow-hidden border border-gray-800 shadow-xl flex flex-col items-center justify-center min-h-[40%]">
            <div className="relative flex items-center justify-center w-36 h-36">
              {isAiSpeaking && (
                <>
                  <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] delay-150"></div>
                </>
              )}
              <div className={`relative z-10 flex items-center justify-center w-32 h-32 rounded-full border-2 transition-all duration-300 ${isAiSpeaking ? 'bg-gray-800 border-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.3)]' : 'bg-gray-800/50 border-gray-700'}`}>
                 <Bot size={56} className={`transition-colors duration-300 ${isAiSpeaking ? 'text-purple-400' : 'text-gray-500'}`} />
              </div>
            </div>

            <p className={`mt-6 font-medium tracking-wide transition-opacity duration-300 ${isAiSpeaking ? 'text-purple-400' : 'text-gray-500'}`}>
              {isAiSpeaking ? 'Aura is Speaking...' : 'Aura is Listening...'}
            </p>

            <button 
              onClick={handleEndSession}
              className="mt-8 mb-6 bg-red-600/90 hover:bg-red-500 p-4 rounded-full shadow-lg hover:shadow-red-600/50 transition-all hover:-translate-y-1 backdrop-blur-sm"
              title="End Session"
            >
              <Power size={28} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}