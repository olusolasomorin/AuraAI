import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'; // Added some icons for better UI

export default function Auth({ setUser }) {
  const [isLogin, setIsLogin] = useState(true);
  const [fullname, setFullname] = useState(''); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  
  // 🛠️ NEW: States for loading and messaging
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' }); // Clear any previous messages

    if (!isLogin && !acceptedDisclaimer) {
        setFeedback({ message: "You must accept the medical disclaimer to continue.", type: 'error' });
        return;
    }

    setIsLoading(true); // Disable button and show loading text

    const endpoint = isLogin ? '/api/login' : '/api/signup';
    const payload = isLogin 
      ? { email, password } 
      : { fullname, email, password };

    try {
      const res = await fetch(`https://aura-backend-982983046376.us-west1.run.app${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (!isLogin) {
          setFeedback({ message: "Account created successfully! Please log in.", type: 'success' });
          setIsLogin(true); // Switch to login after signup
          setPassword(''); // Clear password field for security
        } else {
          setFeedback({ message: "Login successful!", type: 'success' });
          const userData = await res.json();
          localStorage.setItem('user', JSON.stringify(userData)); 
          
          // Slight delay so the user actually sees the success message before the redirect
          setTimeout(() => {
            setUser(userData); 
          }, 800);
        }
      } else {
        // Try to get a specific error from FastAPI (e.g., "Email already registered")
        const errorData = await res.json().catch(() => ({}));
        setFeedback({ 
          message: errorData.detail || "Authentication failed. Please check your credentials.", 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error("Network Error:", error);
      // This catches the exact scenario where the FastAPI server is turned off
      setFeedback({ 
        message: "Unable to connect to the server. Please ensure the backend is running.", 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to toggle between login and signup modes
  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setFeedback({ message: '', type: '' }); // Clear errors when switching tabs
  };

  return (
    <div className="m-auto w-full max-w-md p-8 bg-gray-900 rounded-3xl shadow-2xl border border-gray-800">
      <h2 className="text-3xl font-bold mb-6 text-center text-white">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
      
      {/* 🛠️ NEW: Dynamic Feedback Banner */}
      {feedback.message && (
        <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 ${
          feedback.type === 'success' 
            ? 'bg-green-950/40 border border-green-900/50 text-green-400' 
            : 'bg-red-950/40 border border-red-900/50 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
          <p>{feedback.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <input 
            type="text" 
            placeholder="Full Name (e.g., Olusola Somorin)" 
            required 
            disabled={isLoading}
            className="w-full p-3.5 rounded-xl bg-gray-800 text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 transition-all" 
            onChange={e => setFullname(e.target.value)} 
          />
        )}

        <input 
          type="email" 
          placeholder="Email address" 
          required 
          disabled={isLoading}
          className="w-full p-3.5 rounded-xl bg-gray-800 text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 transition-all" 
          onChange={e => setEmail(e.target.value)} 
        />
        <input 
          type="password" 
          placeholder="Password" 
          required 
          value={password}
          disabled={isLoading}
          className="w-full p-3.5 rounded-xl bg-gray-800 text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 transition-all" 
          onChange={e => setPassword(e.target.value)} 
        />
        
        {!isLogin && (
          <div className="bg-gray-800/50 border border-gray-700/50 p-4 rounded-xl text-sm text-gray-300 flex gap-3">
            <input 
              type="checkbox" 
              id="disclaimer" 
              disabled={isLoading}
              onChange={e => setAcceptedDisclaimer(e.target.checked)} 
              className="mt-1 w-4 h-4 accent-purple-500 rounded cursor-pointer" 
            />
            <label htmlFor="disclaimer" className="cursor-pointer leading-relaxed">
              <strong>Disclaimer:</strong> Aura is an AI prototype intended for the hackathon. It is NOT a replacement for licensed psychiatric help.
            </label>
          </div>
        )}
        
        {/* 🛠️ NEW: Dynamic Button State */}
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/50 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all disabled:cursor-not-allowed mt-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {isLogin ? 'Logging in...' : 'Creating account...'}
            </>
          ) : (
            isLogin ? 'Login' : 'Sign Up'
          )}
        </button>
      </form>

      <button 
        onClick={handleToggleMode} 
        disabled={isLoading}
        className="w-full mt-6 text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
      >
        {isLogin ? "Need an account? Sign up" : "Already have an account? Login"}
      </button>
    </div>
  );
}