'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';

interface Session {
  _id: string;
  title: string;
  description?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  type: 'INVITE' | 'OPEN';
  inviteToken?: string;
  aiSummary?: string;
  scheduledAt: string;
  instructorId: {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  courseId: {
    title: string;
  };
}

interface ChatUser {
  id: string;
  name: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  avatarUrl?: string;
}

interface ChatMessage {
  id: string;
  message: string;
  sentAt: string;
  user: ChatUser;
}

export default function LiveRoom() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { user } = useAuthStore();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Media states
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  // Summarization modal after ending
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [liveKitToken, setLiveKitToken] = useState<string>('');

  // Refs for media/websockets
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isInstructor = 
    user?.role === 'ADMIN' || 
    (user?.role === 'INSTRUCTOR' && session?.instructorId._id === user?.id);

  // 1. Fetch Session Details
  useEffect(() => {
    fetchSessionDetails();
    fetchChatHistory();

    return () => {
      // Cleanups
      stopMediaStream();
      closeWebSocket();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionId]);

  // 2. Initialize timer and WebSockets once session details are loaded
  useEffect(() => {
    if (!session) return;

    if (session.status === 'LIVE') {
      startSessionTimer();
      initializeWebSocket();
    } else {
      if (isInstructor) {
        toast('Webinar is currently scheduled. You must click "Start Broadcast" to stream live.', { icon: '🗓️' });
      } else {
        toast('Webinar is scheduled. Waiting for the instructor to start...', { icon: '⌛' });
      }
    }
  }, [session]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/sessions/${sessionId}`);
      setSession(data.session);
      if (data.joinToken) {
        setLiveKitToken(data.joinToken);
      }
      if (data.session?.status === 'ENDED' && data.session?.aiSummary) {
        setAiSummaryText(data.session.aiSummary);
        setShowSummaryModal(true);
      }
    } catch (err: any) {
      toast.error('Forbidden or failed to access webinar room.');
      router.push(user?.role === 'STUDENT' ? '/student' : '/instructor/sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const { data } = await api.get(`/sessions/${sessionId}/chat/history`);
      setChatMessages(data.messages || []);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load chat history', err);
    }
  };

  // 3. WebSocket Handler
  const initializeWebSocket = () => {
    if (wsRef.current) return;

    const token = localStorage.getItem('accessToken');
    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const wsUrl = `${wsBaseUrl}/api/v1/sessions/${sessionId}/chat?token=${token}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
      setParticipantCount((prev) => Math.max(prev, 2)); // Simulate other peers
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'CHAT') {
          setChatMessages((prev) => [...prev, payload.message]);
          scrollToBottom();
        } else if (payload.type === 'SYSTEM') {
          if (payload.content === 'SESSION_ENDED' || payload.content === 'SESSION_TERMINATED') {
            toast.error('The webinar broadcast has been shut down.');
            fetchSessionDetails(); // Reload state
          }
        }
      } catch (err) {
        console.error('Error parsing websocket payload', err);
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
    };

    socket.onerror = () => {
      setWsConnected(false);
      toast.error('Live chat server connection error.');
    };
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // 4. Session Status Handlers
  const handleStartBroadcast = async () => {
    try {
      await api.post(`/sessions/${sessionId}/start`);
      toast.success('Live broadcast is ACTIVE!');
      fetchSessionDetails();
    } catch (err) {
      toast.error('Failed to activate broadcast stream.');
    }
  };

  const handleEndBroadcast = async () => {
    try {
      const { data } = await api.get(`/sessions/${sessionId}`);
      if (data.session?.status === 'ENDED') return;

      await api.post(`/sessions/${sessionId}/end`);
      toast.success('Live Stream terminated successfully.');
      stopMediaStream();
      
      // Reload and display summary
      const res = await api.get(`/sessions/${sessionId}`);
      setSession(res.data.session);
      if (res.data.session?.aiSummary) {
        setAiSummaryText(res.data.session.aiSummary);
        setShowSummaryModal(true);
      }
    } catch (err) {
      toast.error('Failed to shut down broadcast feed.');
    }
  };

  // 5. Media Stream Handlers (Camera & Screen Capture)
  const toggleCamera = async () => {
    if (!isInstructor) return;

    if (cameraActive) {
      stopCameraTrack();
      setCameraActive(false);
    } else {
      try {
        setScreenSharing(false); // Stop screen share first
        const constraints = { video: true, audio: micActive };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
        toast.success('Webcam initialized successfully.');
      } catch (err) {
        toast.error('Camera permissions blocked or camera unavailable.');
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isInstructor) return;

    if (screenSharing) {
      stopMediaStream();
      setScreenSharing(false);
      setCameraActive(false);
    } else {
      try {
        setCameraActive(false); // Stop camera first
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setScreenSharing(true);
        toast.success('Screen broadcast source selected.');

        // Listen for screen share close events
        stream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          toast('Screen share stopped.', { icon: '🖥️' });
        };
      } catch (err) {
        toast.error('Screen capture sharing denied.');
      }
    }
  };

  const toggleMicrophone = async () => {
    if (!isInstructor) return;

    if (micActive) {
      setMicActive(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
      }
    } else {
      setMicActive(true);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
      } else {
        toast.success('Microphone unmuted.');
      }
    }
  };

  const stopCameraTrack = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(track => {
        track.stop();
        mediaStreamRef.current?.removeTrack(track);
      });
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 6. Active Duration Timer
  const startSessionTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    const started = session?.scheduledAt ? new Date(session.scheduledAt).getTime() : Date.now();

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, now - started);
      
      const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      
      setElapsedTime(`${hours}:${minutes}:${seconds}`);
    }, 1000);
  };

  // 7. Chat Actions
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== 1) return;

    wsRef.current.send(JSON.stringify({
      type: 'CHAT',
      content: inputText.trim()
    }));
    setInputText('');
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const formatMessageTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: '#0b0f19', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '3px solid #006eff', borderTopColor: 'transparent', width: 48, height: 48, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8' }}>Resolving WebRTC Broadcaster Node...</p>
        </div>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#090d16', color: '#f8fafc', overflow: 'hidden', fontFamily: 'var(--font-family)' }}>
      
      {/* 1. Header Toolbar */}
      <header style={{ height: 64, borderBottom: '1px solid #1e293b', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href={user?.role === 'STUDENT' ? '/student' : '/instructor/sessions'} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>
            <i className="fa-solid fa-angle-left" /> Exit Live Room
          </Link>
          <div style={{ width: 1, height: 20, background: '#334155' }} />
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{session.title}</h1>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Syllabus: {session.courseId?.title} • Instructor: {session.instructorId.name}
            </span>
          </div>
        </div>

        {/* Live Badges and Timers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {session.status === 'LIVE' ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 99, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                LIVE
              </span>
              <span style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: '#e2e8f0', background: '#1e293b', padding: '4px 8px', borderRadius: 6 }}>
                {elapsedTime}
              </span>
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-users" style={{ color: '#006eff' }} /> {participantCount} Active
              </span>
            </>
          ) : session.status === 'ENDED' ? (
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8', background: '#334155', padding: '4px 10px', borderRadius: 99, fontWeight: 700 }}>
              BROADCAST ARCHIVED
            </span>
          ) : (
            <span style={{ fontSize: '0.8125rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 99, fontWeight: 700 }}>
              SCHEDULED (INACTIVE)
            </span>
          )}
        </div>
      </header>

      {/* 2. Main 50-50 Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Side: Video Broadcaster Screen */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#090d16', position: 'relative', overflow: 'hidden', padding: 24, justifyContent: 'center' }}>
          
          {/* Main Feed Container */}
          <div style={{ 
            flex: 1, 
            background: '#0b0f19', 
            borderRadius: 24, 
            border: '1px solid #1e293b', 
            position: 'relative', 
            overflow: 'hidden', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
          }}>
            
            {session.status === 'LIVE' ? (
              liveKitToken ? (
                <LiveKitRoom
                  serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://lms-livekit-mock.livekit.cloud'}
                  token={liveKitToken}
                  connect={true}
                  data-lk-theme="default"
                  style={{ width: '100%', height: '100%', borderRadius: 24, overflow: 'hidden' }}
                >
                  <VideoConference />
                  <RoomAudioRenderer />
                </LiveKitRoom>
              ) : (
                /* Premium Broadcaster Simulated screen overlay */
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 8, height: 24, background: '#006eff', animation: 'barGlow 1.2s infinite ease-in-out' }} />
                    <div style={{ width: 8, height: 36, background: '#7c3aed', animation: 'barGlow 1.2s infinite ease-in-out', animationDelay: '0.2s' }} />
                    <div style={{ width: 8, height: 28, background: '#006eff', animation: 'barGlow 1.2s infinite ease-in-out', animationDelay: '0.4s' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                    {isInstructor ? 'Broadcaster Binds Active' : 'Live Broadcaster Node Connected'}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: 8, maxWidth: 420 }}>
                    {isInstructor 
                      ? 'Select video input sources from the toolbar below to publish high-definition WebRTC video feeds.' 
                      : 'Webcast stream is initializing. The instructor has not enabled the webcam feed yet.'}
                  </p>
                </div>
              )
            ) : session.status === 'ENDED' ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 20px' }}>
                  <i className="fa-solid fa-video-slash" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>This session has ended</h3>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: 8, maxWidth: 360, marginInline: 'auto' }}>
                  The instructor shut down this live broadcast classroom. Feel free to view the generated AI notes highlight summary details.
                </p>
                {session.aiSummary && (
                  <button className="btn btn-primary" onClick={() => setShowSummaryModal(true)} style={{ marginTop: 24 }}>
                    <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }} /> View AI Highlights
                  </button>
                )}
              </div>
            ) : (
              /* Scheduled Room */
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ width: 64, height: 64, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 20px' }}>
                  <i className="fa-regular fa-clock" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>Webinar Scheduled</h3>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: 8, maxWidth: 420, marginInline: 'auto' }}>
                  {isInstructor 
                    ? 'Click the "Start Broadcast Feed" control in the bottom menu bar to initiate WebSocket endpoints and authorize participants.' 
                    : 'The live stream channel is waiting to be started by the classroom instructor. Hang tight!'}
                </p>
                {isInstructor && (
                  <button className="btn btn-primary" onClick={handleStartBroadcast} style={{ marginTop: 24, background: '#10b981', borderColor: '#10b981' }}>
                    <i className="fa-solid fa-circle-play" style={{ marginRight: 8 }} /> Start Broadcast Feed
                  </button>
                )}
              </div>
            )}

            {/* Anti-Piracy overlay watermark for students */}
            {session.status === 'LIVE' && !isInstructor && user && (
              <div style={{
                position: 'absolute',
                top: '15%',
                left: '10%',
                pointerEvents: 'none',
                opacity: 0.18,
                fontSize: '0.875rem',
                color: '#fff',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                zIndex: 5,
                background: 'rgba(0,0,0,0.4)',
                padding: '8px 12px',
                borderRadius: 8,
              }}>
                <span>RoboAIAPaths Anti-Piracy Shield</span>
                <span>User: {user.name}</span>
                <span>Mobile: {user.mobile}</span>
                <span>Stream Token Bind Active</span>
              </div>
            )}
          </div>

          {/* Bottom Broadcast Toolbar Controls (Replaced by LiveKit UI) */}
          {session.status === 'LIVE' && isInstructor && !liveKitToken && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, background: '#0f172a', padding: '16px 28px', borderRadius: 20, border: '1px solid #1e293b' }}>
              
              {/* Media Controls */}
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Camera Toggle */}
                <button 
                  onClick={toggleCamera} 
                  className="btn btn-icon" 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 12, 
                    background: cameraActive ? '#006eff' : '#1e293b', 
                    color: '#fff', 
                    fontSize: '1.125rem' 
                  }}
                  title={cameraActive ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  <i className={`fa-solid ${cameraActive ? 'fa-video' : 'fa-video-slash'}`} />
                </button>

                {/* Mic Toggle */}
                <button 
                  onClick={toggleMicrophone} 
                  className="btn btn-icon" 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 12, 
                    background: micActive ? '#006eff' : '#1e293b', 
                    color: '#fff', 
                    fontSize: '1.125rem' 
                  }}
                  title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  <i className={`fa-solid ${micActive ? 'fa-microphone' : 'fa-microphone-slash'}`} />
                </button>

                {/* Screen Share Toggle */}
                <button 
                  onClick={toggleScreenShare} 
                  className="btn btn-icon" 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 12, 
                    background: screenSharing ? '#10b981' : '#1e293b', 
                    color: '#fff', 
                    fontSize: '1.125rem' 
                  }}
                  title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                  <i className="fa-solid fa-desktop" />
                </button>
              </div>

              {/* End Webinar Trigger */}
              <button 
                onClick={handleEndBroadcast} 
                className="btn" 
                style={{ 
                  background: '#ef4444', 
                  color: '#fff', 
                  borderRadius: 12, 
                  padding: '12px 24px', 
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <i className="fa-solid fa-power-off" /> Shut Down Broadcast
              </button>

            </div>
          )}

        </div>

        {/* Right Side: Chat Container */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0b0f19', borderLeft: '1px solid #1e293b', overflow: 'hidden' }}>
          
          {/* Chat Header */}
          <div style={{ height: 60, borderBottom: '1px solid #1e293b', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f8fafc' }}>
              Live Q&A Chat Feed
            </span>
            <span style={{ fontSize: '0.75rem', color: wsConnected ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, background: wsConnected ? '#10b981' : '#ef4444', borderRadius: '50%', display: 'inline-block' }} />
              {wsConnected ? 'LIVE CHAT SYNC' : 'OFFLINE'}
            </span>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {chatMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                <i className="fa-regular fa-comments" style={{ fontSize: '2rem', color: '#334155', marginBottom: 12 }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Welcome to the Live Room!</h4>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, maxWidth: 240 }}>
                  Ask questions, review calibrations, and sync discussions with the course instructor in real-time.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isMsgInstructor = msg.user.role === 'INSTRUCTOR' || msg.user.role === 'ADMIN';
                const isMe = msg.user.id === user?.id;

                return (
                  <div key={msg.id || index} style={{ display: 'flex', gap: 10, alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    {!isMe && (
                      <div 
                        style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: '50%', 
                          background: msg.user.avatarUrl || 'linear-gradient(135deg, #006eff 0%, #7c3aed 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {msg.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div>
                      {/* Name Header */}
                      {!isMe && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
                            {msg.user.name}
                          </span>
                          <span 
                            style={{ 
                              fontSize: '0.625rem', 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              fontWeight: 700,
                              background: isMsgInstructor ? 'rgba(0,110,255,0.15)' : 'rgba(16,185,129,0.15)',
                              color: isMsgInstructor ? '#006eff' : '#10b981'
                            }}
                          >
                            {msg.user.role}
                          </span>
                        </div>
                      )}

                      {/* Bubble */}
                      <div style={{ 
                        background: isMe ? '#006eff' : '#1e293b', 
                        color: '#f8fafc',
                        padding: '10px 14px', 
                        borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                        fontSize: '0.8125rem',
                        lineHeight: 1.4,
                        boxShadow: 'var(--shadow-xs)'
                      }}>
                        {msg.message}
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
                        {formatMessageTime(msg.sentAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input form */}
          <form onSubmit={handleSendChat} style={{ height: 72, borderTop: '1px solid #1e293b', background: '#0f172a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={session.status === 'LIVE' ? "Type message and press Enter..." : "Webinar chat inactive"}
              disabled={session.status !== 'LIVE' || !wsConnected}
              style={{ 
                flex: 1, 
                background: '#090d16', 
                border: '1px solid #1e293b', 
                borderRadius: 12, 
                padding: '12px 16px', 
                color: '#fff', 
                fontSize: '0.875rem' 
              }}
            />
            <button 
              type="submit" 
              disabled={session.status !== 'LIVE' || !wsConnected || !inputText.trim()}
              style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 12, 
                background: inputText.trim() ? '#006eff' : '#1e293b', 
                color: '#fff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <i className="fa-solid fa-paper-plane" />
            </button>
          </form>

        </div>

      </div>

      {/* Post-Session Summary Modal overlay */}
      {showSummaryModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(9,13,22,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 24,
            width: '100%',
            maxWidth: 680,
            padding: 36,
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,110,255,0.1)', color: '#006eff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>AI Post-Session Digest</h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Generated automatically from chat dialogue and calibrations</span>
                </div>
              </div>
              <button 
                onClick={() => setShowSummaryModal(false)}
                style={{ background: '#1e293b', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              background: '#090d16', 
              padding: 24, 
              borderRadius: 16, 
              fontSize: '0.875rem', 
              color: '#cbd5e1', 
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              border: '1px solid #1e293b'
            }}>
              {aiSummaryText || "Summarizing highlights..."}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                className="btn" 
                onClick={() => setShowSummaryModal(false)}
                style={{ background: '#006eff', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: 700 }}
              >
                Acknowledge Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes barGlow {
          0%, 100% { transform: scaleY(1); opacity: 0.5; }
          50% { transform: scaleY(1.4); opacity: 1; filter: drop-shadow(0 0 8px #006eff); }
        }
      `}</style>

    </div>
  );
}
