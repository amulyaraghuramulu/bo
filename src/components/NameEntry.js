import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function NameEntry() {
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { roomId } = useParams();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      navigate(`/meeting/${roomId}`, { state: { userName: name } });
    }
  };

  return (
    <div className="name-entry-wrapper">
      <form onSubmit={handleSubmit} className="name-form">
        <h2>Enter your name to join the meeting</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
        />
        <button type="submit">Join Room</button>
      </form>
    </div>
  );
}

export default NameEntry;
