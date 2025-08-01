// Room.js
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Peer from 'simple-peer';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaComments, FaCopy, FaPhoneSlash, FaDesktop, FaUsers
} from 'react-icons/fa';
import socket from '../socket';

function Room() {
  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantList, setParticipantList] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const userVideo = useRef();
  const screenVideo = useRef();
  const peersRef = useRef(new Map());
  const screenTrackRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const originalAudioTrackRef = useRef(null);
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const createPeer = (userToSignal, callerID, stream) => {
    console.log('Creating peer for:', userToSignal, 'with stream:', !!stream);
    const peer = new Peer({ 
      initiator: true, 
      trickle: false, 
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', signal => {
      console.log('Sending signal to:', userToSignal);
      socket.emit('sending-signal', { userToSignal, callerID, signal, roomId });
    });

    peer.on('stream', remoteStream => {
      console.log('Received remote stream from peer:', userToSignal, 'stream tracks:', remoteStream.getTracks().length);
    });

    peer.on('connect', () => {
      console.log('Peer connected:', userToSignal);
    });

    peer.on('error', err => {
      console.error(`Peer error [initiator=true]:`, err);
      // Clean up failed peer
      peer.destroy();
      peersRef.current.delete(userToSignal);
      setPeers(prev => prev.filter(p => p.peer !== peer));
    });

    peer.on('close', () => {
      console.log('Peer connection closed:', userToSignal);
      peer.destroy();
      peersRef.current.delete(userToSignal);
      setPeers(prev => prev.filter(p => p.peer !== peer));
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    console.log('Adding peer for:', callerID, 'with signal:', !!incomingSignal, 'stream:', !!stream);
    const peer = new Peer({ 
      initiator: false, 
      trickle: false, 
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', signal => {
      console.log('Returning signal to:', callerID);
      socket.emit('returning-signal', { signal, callerID });
    });

    peer.on('stream', remoteStream => {
      console.log('Received remote stream from peer:', callerID, 'stream tracks:', remoteStream.getTracks().length);
    });

    peer.on('connect', () => {
      console.log('Peer connected:', callerID);
    });

    peer.on('error', err => {
      console.error(`Peer error [initiator=false]:`, err);
      // Clean up failed peer
      peer.destroy();
      peersRef.current.delete(callerID);
      setPeers(prev => prev.filter(p => p.peer !== peer));
    });

    peer.on('close', () => {
      console.log('Peer connection closed:', callerID);
      peer.destroy();
      peersRef.current.delete(callerID);
      setPeers(prev => prev.filter(p => p.peer !== peer));
    });

    // Signal the peer with the incoming signal
    if (incomingSignal) {
      try {
        console.log('Signaling peer with incoming signal');
        peer.signal(incomingSignal);
      } catch (err) {
        console.error("Error during peer.signal() in addPeer:", err);
      }
    }

    return peer;
  };

  useEffect(() => {
    const name = location.state?.userName;
    if (!name) {
      navigate(`/name/${roomId}`);
      return;
    }
    setUserName(name);

    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock?.request?.('screen');
      } catch (e) {
        console.warn('Wake Lock not available', e);
      }
    };
    requestWakeLock();

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(currentStream => {
        setStream(currentStream);
        userVideo.current.srcObject = currentStream;
        originalVideoTrackRef.current = currentStream.getVideoTracks()[0];
        originalAudioTrackRef.current = currentStream.getAudioTracks()[0];

        socket.emit('join-room', { roomId, userName: name });

        socket.on('all-users', users => {
          console.log('Received all-users:', users);
          const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
          setParticipantCount(uniqueUsers.length);
          setParticipantList(uniqueUsers);

          // Clean up existing peers
          Array.from(peersRef.current.values()).forEach(({ peer }) => {
            try {
              peer.destroy();
            } catch (err) {
              console.error('Error destroying peer:', err);
            }
          });
          peersRef.current.clear();
          setPeers([]);

          // Create new peer connections for all users except self
          const newPeers = [];
          uniqueUsers.forEach(user => {
            if (user.id !== socket.id) {
              console.log('Creating peer for user:', user.userName, user.id, 'with stream:', !!currentStream);
              try {
                const peer = createPeer(user.id, socket.id, currentStream);
                peersRef.current.set(user.id, { peer, userName: user.userName });
                newPeers.push({ peer, userName: user.userName });
              } catch (err) {
                console.error('Error creating peer for user:', user.userName, err);
              }
            }
          });
          setPeers(newPeers);
        });

        socket.on('user-joined', payload => {
          console.log('User joined:', payload);
          if (!peersRef.current.has(payload.callerID)) {
            console.log('Adding peer for new user:', payload.userName, payload.callerID, 'with stream:', !!currentStream);
            try {
              const peer = addPeer(payload.signal, payload.callerID, currentStream);
              peersRef.current.set(payload.callerID, { peer, userName: payload.userName });
              setPeers(prev => [...prev, { peer, userName: payload.userName }]);
              setParticipantList(prev => [...prev, { id: payload.callerID, userName: payload.userName }]);
              setParticipantCount(prev => prev + 1);
            } catch (err) {
              console.error('Error adding peer for new user:', payload.userName, err);
            }
          }
        });

        socket.on('receiving-returned-signal', payload => {
          console.log('Receiving returned signal from:', payload.id, 'signal:', !!payload.signal);
          const item = peersRef.current.get(payload.id);
          if (item?.peer) {
            try {
              console.log('Signaling peer with returned signal');
              item.peer.signal(payload.signal);
            } catch (err) {
              console.error('Error during peer.signal():', err);
            }
          } else {
            console.log('Peer not found for returned signal:', payload.id);
          }
        });

        socket.on('user-left', id => {
          console.log('User left:', id);
          setParticipantCount(count => Math.max(count - 1, 0));
          setParticipantList(prev => prev.filter(user => user.id !== id));
          const peerObj = peersRef.current.get(id);
          if (peerObj) {
            peerObj.peer.destroy();
            peersRef.current.delete(id);
            setPeers(users => users.filter(p => p.peer !== peerObj.peer));
          }
        });

        socket.on('chat-message', message => {
          setMessages(prev => {
            if (prev.find(m => m.sender === message.sender && m.time === message.time && m.text === message.text)) {
              return prev;
            }
            return [...prev, message];
          });
        });
      })
      .catch(err => {
        console.error('Error accessing media devices:', err);
        alert('Please allow camera and microphone access.');
      });

    return () => {
      socket.emit('leave-room', roomId);
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('user-left');
      socket.off('chat-message');

      userVideo.current?.srcObject?.getTracks()?.forEach(track => track.stop());
      screenTrackRef.current?.stop();
      screenStream?.getTracks()?.forEach(track => track.stop());
      Array.from(peersRef.current.values()).forEach(({ peer }) => peer.destroy());
      peersRef.current.clear();

      if (wakeLock?.release) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [roomId, location.state, navigate]);

  useEffect(() => {
    if (screenStream && screenVideo.current) {
      screenVideo.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const toggleAudio = () => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = stream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        sender: userName,
        text: newMessage,
        time: new Date().toLocaleTimeString()
      };
      socket.emit('chat-message', { roomId, ...message });
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  const leaveMeeting = () => {
    navigate('/');
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStreamLocal = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        setScreenStream(screenStreamLocal);
        setIsScreenSharing(true);

        // Replace video track in each peer connection
        peersRef.current.forEach(({ peer }) => {
          const senders = peer.getSenders();
          const videoSender = senders.find(sender => sender.track?.kind === 'video');
          
          if (videoSender && screenStreamLocal.getVideoTracks()[0]) {
            videoSender.replaceTrack(screenStreamLocal.getVideoTracks()[0]);
          }
        });

        // Handle when user stops sharing via browser UI
        screenStreamLocal.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };

      } catch (err) {
        console.error("Error starting screen share:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }

    // Replace screen track with original camera track
    peersRef.current.forEach(({ peer }) => {
      const senders = peer.getSenders();
      const videoSender = senders.find(sender => sender.track?.kind === 'video');
      
      if (videoSender && originalVideoTrackRef.current) {
        videoSender.replaceTrack(originalVideoTrackRef.current);
      }
    });

    setIsScreenSharing(false);
    setScreenStream(null);
  };

  return (
    <div className="room-wrapper">
      <div className="room-container">
        {/* HEADER */}
        <div className="meeting-info-bar">
          <div className="meeting-details">
            <h3>Meeting ID: {roomId}</h3>
            <button className="copy-btn" onClick={copyMeetingLink}>
              <FaCopy /> {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
          <div className="meeting-time">{new Date().toLocaleTimeString()}</div>
        </div>
        
        {/* DEBUG INFO */}
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          padding: '10px', 
          borderRadius: '5px', 
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div>Peers: {peers.length}</div>
          <div>Participants: {participantCount}</div>
          <div>Socket ID: {socket.id}</div>
        </div>

        {/* VIDEO GRID */}
        <div className="video-grid">
          <div className="video-container">
            <video ref={userVideo} autoPlay muted playsInline />
            <div className="video-label">{userName} (You)</div>
          </div>

          {isScreenSharing && screenStream && (
            <div className="video-container">
              <video ref={screenVideo} autoPlay muted playsInline />
              <div className="video-label">{userName}'s Screen</div>
            </div>
          )}

          {peers.map((peerObj, index) => {
            console.log('Rendering peer:', peerObj.userName, 'peer object:', !!peerObj.peer);
            return (
              <Video key={`${peerObj.userName}-${index}`} peer={peerObj.peer} userName={peerObj.userName} />
            );
          })}
        </div>

        {/* CONTROLS */}
        <div className="controls">
          <button className={`control-btn ${isAudioMuted ? 'active' : ''}`} onClick={toggleAudio}>
            {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          <button className={`control-btn ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo}>
            {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
          <button className="control-btn" onClick={() => setShowChat(!showChat)}>
            <FaComments />
          </button>
          <button className="control-btn" onClick={toggleScreenShare}>
            <FaDesktop />
          </button>
          <button className="control-btn" onClick={() => setShowParticipants(!showParticipants)}>
            <div style={{ position: 'relative' }}>
              <FaUsers />
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-10px',
                backgroundColor: 'red',
                color: 'white',
                borderRadius: '50%',
                padding: '2px 6px',
                fontSize: '0.75rem',
              }}>
                {participantCount}
              </span>
            </div>
          </button>
          <button className="control-btn leave" onClick={leaveMeeting}>
            <FaPhoneSlash />
          </button>
        </div>

        {/* CHAT PANEL */}
        {showChat && (
          <div className="chat-panel">
            <div className="messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.sender === userName ? 'own' : ''}`}>
                  <strong>{msg.sender}:</strong> {msg.text}
                  <span className="timestamp">{msg.time}</span>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}

        {/* PARTICIPANT LIST */}
        {showParticipants && (
          <div className="participants-panel">
            <input
              type="text"
              placeholder="Search participants"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <ul>
              <li key="you" className="participant-item you">
                <span className="participant-name">{userName} (You)</span>
                <span className="status-icons">
                  {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                  {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
                </span>
              </li>
              {participantList
                .filter(p => p.userName.toLowerCase().includes(searchTerm.toLowerCase()) && p.id !== socket.id)
                .map(p => (
                  <li key={p.id} className="participant-item">
                    <span className="participant-name">{p.userName}</span>
                    <span className="status-icons">
                      <FaMicrophone />
                      <FaVideo />
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const Video = ({ peer, userName }) => {
  const ref = useRef();

  useEffect(() => {
    if (!peer) {
      console.log('No peer provided for Video component:', userName);
      return;
    }

    console.log('Setting up Video component for:', userName, 'peer:', !!peer);

    const handleStream = (stream) => {
      console.log('Video component received stream for:', userName, 'stream tracks:', stream.getTracks().length);
      if (ref.current) {
        ref.current.srcObject = stream;
        // Force video to play
        ref.current.play().catch(err => console.error('Error playing video:', err));
      }
    };

    // Check if peer already has a stream
    if (peer.streams && peer.streams[0]) {
      console.log('Peer already has stream for:', userName);
      handleStream(peer.streams[0]);
    }

    // Listen for new streams
    peer.on('stream', handleStream);

    return () => {
      console.log('Cleaning up Video component for:', userName);
      peer.removeListener('stream', handleStream);
    };
  }, [peer, userName]);

  return (
    <div className="video-container">
      <video 
        playsInline 
        autoPlay 
        ref={ref}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div className="video-label">{userName}</div>
    </div>
  );
};

export default Room;
