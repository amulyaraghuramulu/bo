import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaVideo, FaArrowRight } from 'react-icons/fa';
import { MdSecurity, MdLink } from 'react-icons/md';
import bocklogo from '../assets/Chain.svg';

const Home = () => {
  const [meetingId, setMeetingId] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createMeeting = () => {
    const newMeetingId = Math.random().toString(36).substring(2, 10);
    navigate(`/meeting/${newMeetingId}`);
  };

  const joinMeeting = () => {
    const trimmedId = meetingId.trim();
    if (trimmedId) {
      navigate(`/meeting/${trimmedId}`);
    } else {
      setError('Please enter a valid meeting ID');
    }
  };

  return (
    <div className="home-container">
      <header className="home-header-bar">
        <img src={bocklogo} alt="BOCK Logo" className="bock-logo" />
        <h1 className="home-title">BOCK</h1>
      </header>
      <main className="home-content">
        <section className="home-header">
          <h1>Premium video meetings. Now free for everyone.</h1>
          <p>
            We re-engineered the service we built for high-security business meetings, Google Meet, to make it free and available for all.
          </p>
        </section>
        <section className="meeting-actions">
          <div className="action-buttons">
            <button className="new-meeting-btn" onClick={createMeeting}>
              <FaVideo /> New meeting
            </button>
            <div className="join-meeting">
              <input
                type="text"
                placeholder="Enter a code or link"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
              />
              <button onClick={joinMeeting}>
                Join <FaArrowRight />
              </button>
              {error && <p style={{ color: 'red' }}>{error}</p>}
            </div>
          </div>
        </section>
        <section className="meeting-info">
          <div className="info-card">
            <div className="info-icon">
              <MdLink />
            </div>
            <div className="info-text">
              <h3>Get a link you can share</h3>
              <p>
                Click “New meeting” to get a link you can send to people you want to meet with.
              </p>
            </div>
          </div>
          <div className="info-card">
            <div className="info-icon">
              <MdSecurity />
            </div>
            <div className="info-text">
              <h3>Your meeting is safe</h3>
              <p>No one can join a meeting unless invited or admitted by the host.</p>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};

export default Home;
