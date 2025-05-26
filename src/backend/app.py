from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import sys
import os
import logging
import traceback
from google.cloud import storage
import io

# Configure logging to output to console with debug level
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# import the chat function
from finn_agent import process_message as finn_chat

# Initialize GCS client
storage_client = storage.Client()
BUCKET_NAME = "sport-store-agent-ai-bck01"
bucket = storage_client.bucket(BUCKET_NAME)

app = Flask(__name__)
CORS(app)

# Add a test endpoint to verify the server is running
@app.route('/test', methods=['GET'])
def test():
    return jsonify({'status': 'ok', 'message': 'Backend is running'})

@app.route('/chat', methods=['POST'])
def chat():
    try:
        # Log the raw request
        logger.debug(f"Raw request data: {request.data}")
        
        data = request.json
        logger.debug(f"Parsed request data: {data}")
        
        if not data:
            raise ValueError("No JSON data received")
        
        message = data.get('message')
        if not message:
            raise ValueError("No message field in request")
            
        history = data.get('history', [])
        
        logger.debug(f"Processing message: '{message}'")
        logger.debug(f"With history: {history}")
        
        # Try to get response
        try:
            response = finn_chat(message, history)
            logger.debug(f"Got response: {response}")
            # Add this line to see the exact response structure
            logger.debug(f"Response type: {type(response)}")
        except Exception as e:
            logger.error("Error in finn_chat:", exc_info=True)
            raise
        
        return jsonify({'response': response})
    
    except Exception as e:
        error_msg = f"Error in chat endpoint: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/test-image')
def test_image():
    print("Test image route hit!")
    return "Test route working"

@app.route('/images/<filename>')
def serve_image(filename):
    """Serve images from GCS instead of local folder"""
    try:
        blob = bucket.blob(f"images/{filename}")
        
        # Get the image data from GCS
        image_data = blob.download_as_bytes()
        
        # Return the image with proper content type
        return send_file(
            io.BytesIO(image_data),
            mimetype='image/png'  # Adjust if you have different image types
        )
    except Exception as e:
        logger.error(f"Error serving image {filename}: {str(e)}")
        return "Image not found", 404

if __name__ == '__main__':
    app.run(debug=True, port=8001) 