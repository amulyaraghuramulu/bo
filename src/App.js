import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Room from './components/Room';
import NameEntry from './components/NameEntry';


function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/name/:roomId" element={<NameEntry />} />
          <Route path="/meeting/:roomId" element={<Room />} />
        </Routes>
      </div>
    </Router>
  );
}
console.log('Socket URL:', process.env.REACT_APP_SOCKET_URL);


export default App;
