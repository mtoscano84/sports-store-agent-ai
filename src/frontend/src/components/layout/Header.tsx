import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../../images/logo.png';

const Header = () => {
  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      padding: '1rem',
      backgroundColor: 'white',
      alignItems: 'center',
      gap: '2rem'
    }}>
      {/* Left: Categories */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: 'black' }}>Hike & Camp</Link>
        <Link to="/" style={{ color: 'black' }}>Cycling</Link>
        <Link to="/" style={{ color: 'black' }}>Running</Link>
        <Link to="/" style={{ color: 'black' }}>Women</Link>
        <Link to="/" style={{ color: 'black' }}>Men</Link>
        <Link to="/" style={{ color: 'black' }}>Kids</Link>
      </div>

      {/* Center: Logo */}
      <img 
        src={logo} 
        alt="Decathlon" 
        style={{ height: '2rem' }}
      />

      {/* Right: Icons */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem',
        justifyContent: 'flex-end'
      }}>
        <button style={{
          backgroundColor: 'black',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <span className="material-icons" style={{ color: 'white' }}>search</span>
        </button>
        <button style={{
          backgroundColor: 'black',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <span className="material-icons" style={{ color: 'white' }}>person_outline</span>
        </button>
        <button style={{
          backgroundColor: 'black',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <span className="material-icons" style={{ color: 'white' }}>shopping_bag</span>
        </button>
      </div>
    </div>
  );
};

export default Header; 