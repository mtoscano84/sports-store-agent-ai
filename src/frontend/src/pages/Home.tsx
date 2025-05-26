import React, { useState, useEffect, useRef } from 'react';
import backgroundImage from '../images/background.jpeg';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import  StoreMap  from '../components/StoreMap';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Add this after your imports to fix the marker icon issue
// You'll need to download the marker icon images or use a CDN
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Home = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Add a ref for the messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add scroll to bottom effect
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]); // This will trigger whenever messages array changes

  useEffect(() => {
    if (isChatOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: "Welcome to GenAI Sports! I'm Finn, your AI Sport Shopping Assistant. How can I help you today?"
        }
      ]);
    }
  }, [isChatOpen, messages.length]);

  const formatMessage = (text: string) => {
    if (text.includes('Here are some products:')) {
      const lines = text.split('\n').filter(line => line.trim());
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {lines.map((line, index) => {
            if (line.includes('Here are some products:')) {
              return <div key={index} style={{ 
                fontSize: '24px',
                fontWeight: '600'
              }}>{line}</div>;
            }
            
            if (line.startsWith('• Product:')) {
              const productName = line.split('Product:')[1].trim();
              const nextLine = lines[index + 1];
              const imageName = nextLine?.startsWith('Image:') 
                ? nextLine.split('Image:')[1].trim()
                : productName;
              
              const description = lines[index + 2] && !lines[index + 2].startsWith('• ') 
                ? lines[index + 2] 
                : '';
              
              const imageUrl = `/images/${encodeURIComponent(imageName)}.png`;
            
              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  gap: '32px',
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px solid #eee'
                }}>
                  <img 
                    src={imageUrl}
                    alt={productName}
                    onClick={() => setSelectedImage(imageUrl)}
                    style={{ 
                      width: '300px',
                      height: '300px',
                      objectFit: 'contain',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      padding: '8px'
                    }}
                  />
                  <div style={{ 
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    <div style={{ 
                      fontSize: '28px',
                      fontWeight: '600',
                      color: '#111827'
                    }}>
                      {productName}
                    </div>
                    {description && (
                      <div style={{ 
                        fontSize: '20px',
                        lineHeight: '1.5',
                        color: '#4b5563'
                      }}>
                        {description}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          }).filter(Boolean)}
        </div>
      );
    }
    
    // Check if the message contains store locations
    if (text.includes('USER|')) {
      const lines = text.trim().split('\n');
      const stores: Array<{name: string, latitude: number, longitude: number, distance: number}> = [];
      let userLocation: {lat: number, lng: number} | null = null;

      lines.forEach(line => {
        try {
          const [name, coordinates] = line.split('|');
          if (!coordinates) return;

          // Now coordinates is always in format: distance,longitude,latitude
          const [distance, longitude, latitude] = coordinates.split(',').map(Number);

          if (isNaN(latitude) || isNaN(longitude)) {
            console.error('Invalid coordinates:', { latitude, longitude });
            return;
          }

          if (name.trim() === 'USER') {
            userLocation = {
              lat: latitude,
              lng: longitude
            };
            console.log('User location parsed:', userLocation);
          } else {
            stores.push({
              name: name.trim(),
              distance,
              latitude,
              longitude
            });
            console.log('Store added:', { name: name.trim(), distance, latitude, longitude });
          }
        } catch (err) {
          console.error('Error processing line:', line, err);
        }
      });

      console.log('Final parsed data:', { stores, userLocation });

      return (
        <div className="map-container" style={{ height: '400px', width: '100%', margin: '10px 0' }}>
          <StoreMap 
            stores={stores}
            userLocation={userLocation}
          />
        </div>
      );
    }
    
    return <span style={{ whiteSpace: 'pre-line' }}>{text}</span>;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const ImageModal = ({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) => (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        cursor: 'pointer'
      }}
      onClick={onClose}
    >
      <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
        <img 
          src={imageUrl}
          alt="Large product view"
          style={{
            maxWidth: '100%',
            maxHeight: '90vh',
            objectFit: 'contain',
            borderRadius: '8px',
            backgroundColor: 'white',
            padding: '10px'
          }}
        />
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '30px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      backgroundColor: 'white',
      display: 'flex',
      justifyContent: 'center',
      height: 'calc(100vh - 80px)', // Subtract header height
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}>
        <img 
          src={backgroundImage}
          alt="Hiking adventure"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'relative'
          }}
        />
        
        {/* Main Text Overlay - Centered */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '100%',
          maxWidth: '800px',
          padding: '0 2rem',
          zIndex: 2
        }}>
          <h1 style={{
            fontSize: '4rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '1.5rem'
          }}>
            Run with purpose. Run with power.
          </h1>
          <p style={{
            fontSize: '1.5rem',
            color: 'white',
            marginBottom: '2rem'
          }}>
            Spring Running Collection — Elevate your performance with our newest running essentials. 
            Experience the thrill of every challenge.
          </p>
          <button 
            onClick={() => setIsChatOpen(true)}
            style={{
              backgroundColor: 'white',
              color: 'black',
              padding: '1rem 2rem',
              borderRadius: '0.25rem',
              border: 'none',
                    cursor: 'pointer',
              fontSize: '1.25rem',
                                                      fontWeight: '500'
            }}
          >
            Shop Now
                  </button>
        </div>

        {/* Updated bottom text overlay */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          color: 'white',
          fontSize: '0.9rem',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '8px 12px',
          borderRadius: '4px',
          zIndex: 2
        }}>
          Built on <span style={{ 
            textDecoration: 'underline',
            fontWeight: 'bold'
          }}>AlloyDB</span> using a Synthetic Dataset
        </div>

        {/* Centered Chat Overlay */}
        {isChatOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              width: '1536px',
              height: '80vh',
              backgroundColor: 'white',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Updated Chat Header with larger, bolder text */}
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8f9fa'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span className="material-icons" style={{ 
                    color: '#2563eb',
                    fontSize: '28px'  // Larger icon
                  }}>
                    directions_run
                  </span>
                  <h3 style={{ 
                    margin: 0,
                    fontWeight: '700',  // Bolder text
                    fontSize: '1.5rem', // Larger text
                    color: '#1f2937'
                  }}>
                    Finn - Your Sport Shopping Assistant
                  </h3>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '1.8rem',  // Larger close button
                    color: '#6b7280'
                  }}
                >
                  ×
                </button>
              </div>
              
              {/* Chat Content - Add ref for scrolling */}
              <div style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    style={{
                      alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '70%',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      backgroundColor: message.role === 'user' ? '#2563eb' : '#f3f4f6',
                      color: message.role === 'user' ? 'white' : 'black',
                      fontSize: '24px'
                    }}
                  >
                    {message.role === 'user' ? (
                      message.content
                    ) : (
                      <div>
                        {(() => {
                          try {
                            // Handle shopping list format
                            if (message.content.includes('shopping list:')) {
                              const lines = message.content.split('\n');
                              const items = lines.reduce((acc: any[], line, index) => {
                                if (line.includes('• Product:')) {
                                  const item: any = {};
                                  // Get the product name
                                  item.name = line.substring(line.indexOf('• Product:') + '• Product:'.length).trim();
                                  
                                  // Look ahead for details until next product or end
                                  let currentIndex = index + 1;
                                  while (currentIndex < lines.length && !lines[currentIndex].includes('• Product:')) {
                                    const detailLine = lines[currentIndex].trim();
                                    if (detailLine) {
                                      const [key, ...valueParts] = detailLine.split(':').map(s => s.trim());
                                      const value = valueParts.join(':').trim(); // Rejoin in case value contains colons
                                      if (key && value) {
                                        const cleanKey = key.toLowerCase();
                                        item[cleanKey] = value;
                                      }
                                    }
                                    currentIndex++;
                                  }
                                  acc.push(item);
                                }
                                return acc;
                              }, []);

                              return (
                                <div style={{
                                  backgroundColor: 'white',
                                  borderRadius: '8px',
                                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                  overflow: 'hidden'
                                }}>
                                  {/* Shopping List Header */}
                                  <div style={{
                                    padding: '16px',
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: '#f8fafc'
                                  }}>
                                    <h2 style={{
                                      fontSize: '24px',
                                      fontWeight: '600',
                                      color: '#111827',
                                      margin: 0
                                    }}>
                                      Your Shopping List
                                    </h2>
                                  </div>

                                  {/* Shopping List Items */}
                                  <div>
                                    {items.map((item, index) => (
                                      <div key={index} style={{
                                        padding: '24px',
                                        borderBottom: index < items.length - 1 ? '1px solid #e5e7eb' : 'none',
                                        display: 'flex',
                                        gap: '32px',
                                        alignItems: 'flex-start'
                                      }}>
                                        {/* Product Image */}
                                        <div style={{
                                          width: '300px',
                                          height: '300px',
                                          flexShrink: 0,
                                          backgroundColor: 'white',
                                          borderRadius: '4px',
                                          padding: '8px',
                                          border: '1px solid #e5e7eb'
                                        }}>
                                          <img
                                            src={`/images/${encodeURIComponent(item.name)}.png`}
                                            alt={item.name}
                                            onClick={() => setSelectedImage(`/images/${encodeURIComponent(item.name)}.png`)}
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'contain',
                                              cursor: 'pointer'
                                            }}
                                          />
                                        </div>

                                        {/* Product Details */}
                                        <div style={{
                                          flex: 1,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '16px'
                                        }}>
                                          <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start'
                                          }}>
                                            <div>
                                              <h3 style={{
                                                fontSize: '24px',
                                                fontWeight: '600',
                                                color: '#111827',
                                                margin: 0,
                                                marginBottom: '4px'
                                              }}>
                                                {item.name}
                                              </h3>
                                              <p style={{
                                                fontSize: '18px',
                                                color: '#6b7280',
                                                margin: 0
                                              }}>
                                                {item.brand}
                                              </p>
                                            </div>
                                            <div style={{
                                              fontSize: '24px',
                                              fontWeight: '600',
                                              color: '#2563eb'
                                            }}>
                                              {item.price}
                                            </div>
                                          </div>

                                          <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                            gap: '16px',
                                            fontSize: '16px',
                                            color: '#4b5563'
                                          }}>
                                            <div>
                                              <span style={{ fontWeight: '500' }}>Category: </span>
                                              {item.category}
                                            </div>
                                            <div>
                                              <span style={{ fontWeight: '500' }}>Size: </span>
                                              {item.size}
                                            </div>
                                            <div>
                                              <span style={{ fontWeight: '500' }}>Color: </span>
                                              {item.color}
                                            </div>
                                            <div>
                                              <span style={{ fontWeight: '500' }}>Quantity: </span>
                                              {item.quantity}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Shopping List Footer */}
                                  <div style={{
                                    padding: '24px',
                                    borderTop: '1px solid #e5e7eb',
                                    backgroundColor: '#f8fafc',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <div style={{
                                      fontSize: '16px',
                                      color: '#6b7280'
                                    }}>
                                      {items.length} {items.length === 1 ? 'item' : 'items'} in your list
                                    </div>
                                    <div style={{
                                      fontSize: '24px',
                                      fontWeight: '600',
                                      color: '#111827'
                                    }}>
                                      Total: <span style={{ color: '#059669' }}>{
                                        items.reduce((sum, item) => {
                                          const price = parseFloat(item.price.replace('€', ''));
                                          const quantity = parseInt(item.quantity);
                                          return sum + (price * quantity);
                                        }, 0).toLocaleString('en-US', { style: 'currency', currency: 'EUR' })
                                      }</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Handle product details format
                            if (message.content.includes('• Product Name:')) {
                              const lines = message.content.split('\n');
                              const details: Record<string, string> = {};
                              
                              // Parse product details
                              for (const line of lines) {
                                if (line.startsWith('•')) {
                                  const [key, value] = line.substring(1).split(':').map(s => s.trim());
                                  if (key && value) {
                                    details[key] = value;
                                  }
                                }
                              }

                              return (
                                <div style={{
                                  backgroundColor: 'white',
                                  borderRadius: '8px',
                                  padding: '24px',
                                  margin: '8px 0'
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    gap: '32px',
                                    alignItems: 'flex-start'
                                  }}>
                                    {/* Left side - Product Image */}
                                    <img 
                                      src={`/images/${encodeURIComponent(details['Product Name'])}.png`}
                                      alt={details['Product Name']}
                                      onClick={() => setSelectedImage(`/images/${encodeURIComponent(details['Product Name'])}.png`)}
                                      style={{
                                        width: '300px',    // Increased size
                                        height: '300px',   // Increased size
                                        objectFit: 'contain',
                                        cursor: 'pointer',
                                        backgroundColor: 'white',
                                        borderRadius: '4px',
                                        padding: '8px'
                                      }}
                                    />

                                    {/* Right side - Product Details */}
                                    <div style={{ 
                                      flex: 1,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '16px'
                                    }}>
                                        <h3 style={{
                                        fontSize: '24px',
                                        fontWeight: '600',
                                        margin: '0'
                                        }}>{details['Product Name']}</h3>

                                        <div style={{
                                        fontSize: '24px',
                                          color: '#2563eb',
                                          fontWeight: '600'
                                        }}>{details['Price']}</div>

                                      <div style={{ 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                      }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <div style={{ width: '100px', fontWeight: '500' }}>Brand:</div>
                                        <div>{details['Brand']}</div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <div style={{ width: '100px', fontWeight: '500' }}>Category:</div>
                                        <div>{details['Category']}</div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontWeight: '500' }}>Sizes:</div>
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                          {details['Sizes'].split(',').map(size => (
                                            <span key={size} style={{
                                                padding: '8px 16px',
                                              backgroundColor: '#f3f4f6',
                                              borderRadius: '4px',
                                                fontSize: '16px'
                                            }}>
                                              {size.trim()}
                                            </span>
                                          ))}
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontWeight: '500' }}>Colors:</div>
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                          {details['Colors'].split(',').map(color => (
                                            <span key={color} style={{
                                                padding: '8px 16px',
                                              backgroundColor: '#f3f4f6',
                                              borderRadius: '4px',
                                                fontSize: '16px'
                                            }}>
                                              {color.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ fontWeight: '500' }}>Description:</div>
                                        <div style={{
                                            fontSize: '16px',
                                          lineHeight: '1.5',
                                          color: '#4b5563'
                                        }}>
                                          {details['Description']}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Handle product list format
                            if (message.content.includes('Here are some products:')) {
                              const lines = message.content.split('\n').filter(line => line.trim());
                              
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                  {lines.map((line, index) => {
                                    if (line.includes('Here are some products:')) {
                                      return <div key={index} style={{ 
                                        fontSize: '24px',
                                        fontWeight: '600'
                                      }}>{line}</div>;
                                    }
                                    
                                    if (line.startsWith('• Product:')) {
                                      const productName = line.split('Product:')[1].trim();
                                      const nextLine = lines[index + 1];
                                      const imageName = nextLine?.startsWith('Image:') 
                                        ? nextLine.split('Image:')[1].trim()
                                        : productName;
                                      
                                      const description = lines[index + 2] && !lines[index + 2].startsWith('• ') 
                                        ? lines[index + 2] 
                                        : '';
                                      
                                      const imageUrl = `/images/${encodeURIComponent(imageName)}.png`;
                                      
                                      return (
                                        <div key={index} style={{ 
                                          display: 'flex', 
                                          alignItems: 'flex-start',
                                          gap: '32px',
                                          backgroundColor: 'white',
                                          padding: '24px',
                                          borderRadius: '8px',
                                          border: '1px solid #eee'
                                        }}>
                                          <img 
                                            src={imageUrl}
                                            alt={productName}
                                            onClick={() => setSelectedImage(imageUrl)}
                                            style={{ 
                                              width: '300px',
                                              height: '300px',
                                              objectFit: 'contain',
                                              cursor: 'pointer',
                                              backgroundColor: 'white',
                                              borderRadius: '4px',
                                              padding: '8px'
                                            }}
                                          />
                                          <div style={{ 
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px'
                                          }}>
                                            <div style={{ 
                                              fontSize: '28px',
                                              fontWeight: '600',
                                              color: '#111827'
                                            }}>
                                              {productName}
                                            </div>
                                            {description && (
                                              <div style={{ 
                                                fontSize: '20px',
                                                lineHeight: '1.5',
                                                color: '#4b5563'
                                              }}>
                                                {description}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }).filter(Boolean)}
                                </div>
                              );
                            }

                            // Handle delivery methods format
                            if (message.content.includes('• ') && message.content.includes('Description:') && message.content.includes('Cost:')) {
                              const methods = message.content.split('\n\n').filter(method => method.trim());
                              
                            return (
                                <div style={{
                                  backgroundColor: 'white',
                                  borderRadius: '8px',
                                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                  overflow: 'hidden'
                                }}>
                              <div style={{
                                padding: '16px',
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: '#f8fafc'
                                  }}>
                                    <h2 style={{
                                      fontSize: '18px',
                                      fontWeight: '600',
                                      color: '#111827',
                                      margin: 0
                                    }}>
                                      Available Delivery Methods
                                    </h2>
                                  </div>
                                  
                                  <div style={{
                                    padding: '16px'
                                  }}>
                                    <div style={{
                                      display: 'grid',
                                      gap: '12px'
                                    }}>
                                      {methods.map((method, index) => {
                                        const lines = method.split('\n');
                                        const name = lines[0].substring(2); // Remove bullet point
                                        const description = lines[1].split('Description:')[1].trim();
                                        const cost = lines[2].split('Cost:')[1].trim();
                                        const estimatedTime = lines[3].split('Estimated Delivery Time:')[1].trim();
                                        
                                        return (
                                          <div key={index} style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            overflow: 'hidden'
                                          }}>
                                            <div style={{
                                              padding: '12px 16px',
                                              backgroundColor: '#f8fafc',
                                              borderBottom: '1px solid #e5e7eb'
                                            }}>
                                              <div style={{
                                                fontSize: '16px',
                                                fontWeight: '600',
                                                color: '#111827'
                                              }}>
                                                {name}
                                              </div>
                                            </div>
                                            
                                            <div style={{
                                              padding: '12px 16px'
                                            }}>
                                              <table style={{
                                                width: '100%',
                                                borderCollapse: 'collapse'
                                              }}>
                                                <tbody>
                                                  <tr>
                                                    <td style={{
                                                      padding: '8px 0',
                                                      color: '#4b5563',
                                                      width: '40%',
                                                      fontWeight: '500'
                                                    }}>
                                                      Description:
                                                    </td>
                                                    <td style={{
                                                      padding: '8px 0',
                                                      color: '#111827'
                                                    }}>
                                                      {description}
                                                    </td>
                                                  </tr>
                                                  <tr>
                                                    <td style={{
                                                      padding: '8px 0',
                                                      color: '#4b5563',
                                                      fontWeight: '500'
                                                    }}>
                                                      Cost:
                                                    </td>
                                                    <td style={{
                                                      padding: '8px 0',
                                                      color: '#059669',
                                                      fontWeight: '500'
                                                    }}>
                                                      {cost}
                                                    </td>
                                                  </tr>
                                                  <tr>
                                                    <td style={{
                                                      padding: '8px 0',
                                                      color: '#4b5563',
                                                      fontWeight: '500'
                                                    }}>
                                                      Estimated Time:
                                                    </td>
                                                    <td style={{
                                                      padding: '8px 0',
                                                      color: '#111827'
                                                    }}>
                                                      {estimatedTime}
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Handle order format
                            if (message.content.includes('Order:')) {
                              const lines = message.content.split('\n');
                              const orderDetails: Record<string, string> = {};
                              const items: any[] = [];
                              
                              lines.forEach(line => {
                                if (line.startsWith('• Order:')) {
                                  orderDetails.number = line.substring(8).trim();
                                } else if (line.startsWith('Store:')) {
                                  orderDetails.store = line.substring(6).trim();
                                } else if (line.startsWith('Total Amount:')) {
                                  orderDetails.totalAmount = line.substring(13).trim();
                                } else if (line.startsWith('Status:')) {
                                  orderDetails.status = line.substring(7).trim();
                                } else if (line.startsWith('Shipping Address:')) {
                                  orderDetails.shippingAddress = line.substring(17).trim();
                                } else if (line.startsWith('Delivery Method:')) {
                                  orderDetails.deliveryMethod = line.substring(16).trim();
                                } else if (line.startsWith('-')) {
                                  const itemLine = line.substring(1).trim();
                                  items.push(itemLine);
                                }
                              });

                              return (
                                <div style={{
                                  backgroundColor: 'white',
                                borderRadius: '8px',
                                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                  overflow: 'hidden'
                                }}>
                                  {/* Order Header */}
                                  <div style={{
                                    padding: '16px',
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: '#f8fafc',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <h2 style={{
                                      fontSize: '22px',
                                      fontWeight: '600',
                                      color: '#111827',
                                      margin: 0
                                    }}>
                                      Order {orderDetails.number}
                                    </h2>
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '14px',
                                      backgroundColor: orderDetails.status.toLowerCase() === 'pending' ? '#fef3c7' : '#d1fae5',
                                      color: orderDetails.status.toLowerCase() === 'pending' ? '#92400e' : '#065f46'
                                    }}>
                                      {orderDetails.status}
                                    </span>
                                  </div>

                                  {/* Order Details */}
                                  <div style={{ padding: '16px' }}>
                                    <div style={{
                                      display: 'grid',
                                      gap: '16px'
                                    }}>
                                      {/* Store with same format as shipping and delivery */}
                                      <div style={{
                                        fontSize: '18px',
                                        color: '#4b5563'
                                      }}>
                                        <span style={{ 
                                          fontWeight: '600',
                                          color: '#111827'
                                        }}>
                                          Store:
                                        </span>
                                        {' '}{orderDetails.store}
                                      </div>

                                      {/* Shipping Address with bold label */}
                                      <div style={{
                                        fontSize: '18px',
                                        color: '#4b5563'
                                      }}>
                                        <span style={{ 
                                          fontWeight: '600',
                                          color: '#111827'
                                        }}>
                                          Shipping Address:
                                        </span>
                                        {' '}{orderDetails.shippingAddress}
                                      </div>

                                      {/* Delivery Method with bold label */}
                                      <div style={{
                                        fontSize: '18px',
                                        color: '#4b5563'
                                      }}>
                                        <span style={{ 
                                          fontWeight: '600',
                                          color: '#111827'
                                        }}>
                                          Delivery Method:
                                        </span>
                                        {' '}{orderDetails.deliveryMethod}
                                      </div>

                                      {/* Items Section */}
                                      <div>
                                        <h3 style={{
                                          fontSize: '16px',
                                          fontWeight: '600',
                                          color: '#111827',
                                          marginBottom: '12px'
                                        }}>
                                          Items
                                        </h3>
                                        <div style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '8px'
                                        }}>
                                          {items.map((item, index) => (
                                            <div key={index} style={{
                                              padding: '12px',
                                              backgroundColor: '#f9fafb',
                                              borderRadius: '6px',
                                              fontSize: '18px',
                                              color: '#374151'
                                            }}>
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Total Amount at the bottom with bold black label and green amount */}
                                      <div style={{
                                        borderTop: '1px solid #e5e7eb',
                                        paddingTop: '16px',
                                        marginTop: '8px',
                                        fontSize: '18px',
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}>
                                        <span style={{ 
                                          fontWeight: '600',
                                          color: '#111827'  // Black color for the label
                                        }}>
                                          Total Amount:
                                        </span>
                                        <span style={{
                                          marginLeft: '8px',
                                          color: '#059669',  // Green color for the amount
                                          fontWeight: '600'
                                        }}>
                                          {orderDetails.totalAmount}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                              </div>
                            );
                            }

                            // Handle store locations format
                            if (message.content.includes('|') && message.content.includes(',')) {
                              try {
                                console.log('Raw message:', message.content);

                                const locations = message.content.split('\n').filter(line => line.trim());
                                const stores: Array<{
                                  name: string;
                                  distance: number;
                                  latitude: number;
                                  longitude: number;
                                }> = [];
                                
                                let userLocation: { latitude: number; longitude: number } | null = null;

                                locations.forEach(location => {
                                  try {
                                    const [name, coords] = location.split('|');
                                    if (!coords) return;

                                    const [distance, lat, lon] = coords.split(',');
                                    
                                    // Ensure we have valid numbers
                                    const parsedLat = parseFloat(lat);
                                    const parsedLon = parseFloat(lon);
                                    const parsedDistance = parseFloat(distance);

                                    if (isNaN(parsedLat) || isNaN(parsedLon)) {
                                      console.error('Invalid coordinates:', { lat, lon });
                                      return;
                                    }

                                    if (name.startsWith('USER')) {
                                      userLocation = {
                                        latitude: parsedLat,
                                        longitude: parsedLon
                                      };
                                      console.log('User location set:', userLocation);
                                    } else {
                                      if (!isNaN(parsedDistance)) {
                                        stores.push({
                                          name: name.trim(),
                                          distance: parsedDistance,
                                          latitude: parsedLat,
                                          longitude: parsedLon
                                        });
                                        console.log('Store added:', stores[stores.length - 1]);
                                      }
                                    }
                                  } catch (err) {
                                    console.error('Error processing location:', location, err);
                                  }
                                });

                                console.log('Final data:', { stores, userLocation });

                                // Only render map if we have valid data
                                if (stores.length === 0) {
                                  return <div>No stores found</div>;
                                }

                                // Default center (Barcelona) if no user location
                                const defaultCenter: [number, number] = [41.3851, 2.1734];
                                const mapCenter = userLocation 
                                  ? [userLocation.latitude, userLocation.longitude] as [number, number]
                                  : defaultCenter;

                                return (
                                  <div style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                    margin: '8px 0',
                                    width: '300%',
                                    marginLeft: '-100%',
                                    transform: 'translateX(33%)',
                                    backgroundColor: 'white'
                                  }}>
                                    <div style={{
                                      padding: '24px',
                                      borderBottom: '1px solid #e5e7eb'
                                    }}>
                                      <h2 style={{
                                        fontSize: '28px',
                                        fontWeight: '600',
                                        color: '#111827',
                                        margin: 0
                                      }}>
                                        Nearby Stores
                                      </h2>
                                    </div>

                                    {/* Flex container for side-by-side layout */}
                                    <div style={{
                                      display: 'flex',
                                      width: '100%',
                                      backgroundColor: 'white'
                                    }}>
                                      {/* First column - Map */}
                                      <div style={{ 
                                        width: '70%',
                                        height: '600px',
                                        borderRight: '1px solid #e5e7eb',
                                        backgroundColor: 'white'
                                      }}>
                                        <MapContainer
                                          key={`map-${stores.length}`}
                                          center={mapCenter}
                                          zoom={13}
                                          style={{ 
                                            height: '100%',
                                            width: '100%',
                                            zIndex: 1
                                          }}
                                        >
                                          <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                          />

                                          {userLocation && (
                                            <Marker 
                                              position={[userLocation.latitude, userLocation.longitude]}
                                              icon={new L.Icon({
                                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                                                iconSize: [25, 41],
                                                iconAnchor: [12, 41],
                                                popupAnchor: [1, -34],
                                              })}
                                            >
                                              <Popup>Your Location</Popup>
                                            </Marker>
                                          )}

                                          {stores.map((store, index) => (
                                            <Marker 
                                              key={`store-${index}`}
                                              position={[store.latitude, store.longitude]}
                                              icon={new L.Icon({
                                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                                                iconSize: [25, 41],
                                                iconAnchor: [12, 41],
                                                popupAnchor: [1, -34],
                                              })}
                                            >
                                              <Popup>
                                                <div style={{ fontWeight: 500 }}>{store.name}</div>
                                                <div style={{ fontSize: '18px', color: '#6b7280' }}>
                                                  {(store.distance / 1000).toFixed(1)}km away
                                                </div>
                                              </Popup>
                                            </Marker>
                                          ))}
                                        </MapContainer>
                                      </div>

                                      {/* Second column - Store list */}
                                      <div style={{ 
                                        width: '30%',
                                        padding: '24px',
                                        backgroundColor: '#f9fafb'
                                      }}>
                                        {stores.map((store, index) => (
                                          <div
                                            key={index}
                                            style={{
                                              padding: '20px',
                                              backgroundColor: 'white',
                                              borderRadius: '8px',
                                              marginBottom: '16px',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s ease'
                                            }}
                                          >
                                            <div style={{ 
                                              fontSize: '18px',
                                              fontWeight: '600',
                                              color: '#111827',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}>
                                              {store.name}
                                            </div>
                                            <div style={{ 
                                              fontSize: '16px',
                                              color: '#6b7280',
                                              marginTop: '4px'
                                            }}>
                                              {(store.distance / 1000).toFixed(1)}km away
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              } catch (error) {
                                console.error('Error rendering map:', error);
                                return (
                                  <div style={{
                                    padding: '16px',
                                    backgroundColor: 'white',
                                    borderRadius: '8px'
                                  }}>
                                    <p>Error loading store locations. Please try again.</p>
                                  </div>
                                );
                              }
                            }

                            // Handle other message types
                            return message.content.split('\n').map((line, i) => (
                              <div key={i}>{line}</div>
                            ));
                          } catch (error) {
                            console.error('Error processing message:', error);
                            return <div>Error displaying message</div>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Add invisible div at the bottom */}
                <div ref={messagesEndRef} />
                
                {isLoading && (
                  <div style={{
                    alignSelf: 'flex-start',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    color: 'black',
                    fontSize: '24px'
                  }}>
                    Typing...
                  </div>
                )}
              </div>
              
              {/* Updated Input Section with white background */}
              <div style={{
                padding: '16px',
                borderTop: '1px solid #eee',
                backgroundColor: 'white'  // Changed from #f8f9fa to white
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <input 
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '24px',
                      border: '1px solid #ddd',
                      fontSize: '24px',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    style={{
                      backgroundColor: isLoading || !inputMessage.trim() ? '#93c5fd' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>
                      send
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add the image modal */}
        {selectedImage && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
            }}
            onClick={() => setSelectedImage(null)}
          >
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSelectedImage(null)}
                style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '30px',
                  cursor: 'pointer',
                  padding: '10px',
                  zIndex: 10000
                }}
              >
                ×
              </button>
              <img 
                src={selectedImage}
                alt="Enlarged view"
                style={{
                  maxWidth: '90%',
                  maxHeight: '90%',
                  objectFit: 'contain',
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px'
                }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home; 