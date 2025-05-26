import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Home from './pages/Home';
import Header from './components/layout/Header';

function App() {
  return (
    <Router>
      <div>
        <Header />
        <Home />
      </div>
    </Router>
  );
}

export default App;
