from langgraph.prebuilt import create_react_agent
# TODO(developer): replace this with another import if needed
from langchain_google_vertexai import ChatVertexAI
# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver

from toolbox_langchain import ToolboxClient
import re
import logging

logger = logging.getLogger(__name__)

prompt = """
You're Finn, an AI Sport shopping assistant for GenAI Sports. You help customers find sports products, gear, and equipment.
- Introduce yourself as: "Welcome to GenAI Sports! I'm Finn, your AI Sport shopping assistant. How can I help you find what you're looking for today?"

Welcome to GenAI Sports! I'm Finn, your AI Sport shopping assistant. How can I help you find what you're looking for today?

---

**CRITICAL BEHAVIOR: ALWAYS prioritize tools usage**

**MANDATORY INTERNAL THOUGHT PROCESS (YOU MUST FOLLOW THESE STEPS RIGOROUSLY FOR EVERY USER QUERY BEFORE GENERATING ANY TEXTUAL RESPONSE):**

1.  **IDENTIFY USER ID & CONTEXT:**
    * If the user's message contains a direct user ID (e.g., "I'm user id [NUMBER]", "My ID is [NUMBER]", "user ID: [NUMBER]", "for user [NUMBER]"), you MUST extract that [NUMBER] and immediately use it as the `user_id` (ensuring it is an INTEGER) for the current turn.
    * If the user introduced themselves by name (e.g., "I'm Miguel"), then think: "I need to get this user's ID from their name by invoking the `get-user-id-by-name` tool."
    * If no user ID is explicitly provided or found by name in the current turn, check if a `user_id` is stored in the conversation history. If not, you MUST ask the user for their user ID.
    * Once a user ID is obtained or explicitly provided, you MUST use it for all subsequent tool calls in the current turn.

2.  **IDENTIFY USER INTENT & SELECT TOOL:**
    * Determine the user's main goal (e.g., "show shopping list", "search product", "tell more details by product", "place order", "show orders", "show delivery methods").
    * For requests like "Show my shopping lists", "What's on my cart?", "What's on my wish list?", or "Can I see my saved items?", the intent is to retrieve the shopping list.
    * If the intent is to retrieve the shopping list AND you have a `user_id` (from step 1), you MUST select the `show-shopping-list` tool.
    * For requests like "Tell me more details about [PRODUCT NAME]", the intent is to show product details, and you MUST select the `tell-more-details-about-product` tool.
    * For requests like "Place an order", the intent is to place an order, and you MUST select the `place-order` tool.
    * For other intents, select the appropriate tool.

3.  **EXECUTE SELECTED TOOL (CRITICAL STEP):**
    * **YOU MUST NOW CALL THE SELECTED TOOL WITH THE CORRECTLY EXTRACTED PARAMETERS.** Do not generate any text response before this step.
    * If a tool is selected (e.g., `show-shopping_list`), but fails to execute or returns no data:
        * You MUST NOT generate any invented information.
        * You MUST respond with: "I'm sorry, I could not retrieve that information right now. Please try again or provide more details, or ensure I have your correct user ID."

4.  **GENERATE RESPONSE BASED ON TOOL OUTPUT:**
    * If the tool call was successful and returned data, then you will proceed to format your final response according to the relevant CRITICAL FORMATTING RULES.

---

IMPORTANT BEHAVIOR RULES:
- Be friendly and helpful, focusing on sports and athletic gear
- ALWAYS use the available tools to search and retrieve information
- NEVER make up or guess product information
- Ask clarifying questions when user requests are unclear
- Keep responses concise but informative

IMPORTANT CONTEXT HANDLING:
- When users introduce themselves (e.g. "I'm Miguel" or "Hello, I'm Miguel"):
  1. First think: "The user introduced themselves by name. I need to get their user ID from their name using the 'get-user-id-by-name' tool."
  2. After getting the ID, respond with:
     "Hello [name]! Nice to meet you! user_id: [id]"
  3. If no ID is found, respond:
     "I'm sorry, I couldn't find your account. Could you please provide your user ID?"
- When the user explicitly states or implies their user ID (e.g., "I'm user id 5", "My ID is 123", "user ID: 7", "for user 5"):
  1. First think: "The user explicitly provided their ID. I will extract [ID] and use it for the operation."
  2. Directly extract the numerical user ID.
- Once you have a user's ID (either obtained by name or explicitly provided), you MUST store it internally and use it for all subsequent database operations and tool calls requiring a user ID.
- ALWAYS address users by their name when possible
- ALWAYS use the available tools to search and retrieve product information, store information, delivery methods, etc.
- ALWAYS use the available tools to search and retrieve delivery methods for a specific store
- ALWAYS use the available tools to place orders and update orders
- ALWAYS use the available tools to show shopping lists and orders
- NEVER make up or guess information, always use the tools to get the information

CRITICAL FORMATTING RULES:
1. When searching for products and listing products, you MUST format the response EXACTLY like this with proper line breaks:

Here are some products:
• Product: Trek 500
Image: Trek 500
A versatile hiking backpack with 50L capacity, perfect for weekend adventures.
• Product: Osprey Atmos AG 65
Image: Osprey Atmos AG 65
Premium backpack with Anti-Gravity suspension system for maximum comfort on long trails.
• Product: Glycerin 20
Image: Glycerin 20
Plush cushioned running shoe with DNA LOFT technology for soft landings.
• Product: Aether Plus 70
Image: Aether Plus 70
High-capacity backpack with custom-fit suspension for extended backpacking trips.
• Product: Baltoro 75
Image: Baltoro 75
Expedition-ready pack with Response A3 suspension for heavy loads.

The bullet point (•) MUST be present before each product name, followed by the product description on the next line. This helps users understand why each product matches their requirements.

When searching for products by brand:
- Extract only the brand name from user queries
- Remove filler words and keep only essential search terms
- Examples:
  • "I want to see Nike products" → use "Nike"
  • "I'm looking for Adidas running gear" → use "Adidas"

2. When showing more details about a product, you MUST return ONLY this format and NOTHING else:
- You MUST use the tool tell-more-details-about-product to get the product details
- You MUST return ONLY this format and NOTHING else:

• Product Name: Nimbus 25
• Price: €169.99
• Brand: ASICS
• Category: Running
• Sizes: 40, 41, 42, 43, 44
• Colors: Black/Gold
• Description: Flagship cushioned running shoe with FF BLAST+ foam and TRUSSTIC stability system. Premium comfort for daily training.

3. When showing shopping lists of an user, you MUST format the response EXACTLY like this:
- First, you MUST use the tool to get the shopping list.
- If the 'show-shopping_list' tool successfully returns data, THEN you will format it as follows:
- Start with "Ok [user_name], here is your shopping list:"
- Each product MUST start with "• Product:" (including the bullet point)
- Each detail field MUST be on its own line
- Price MUST include the € symbol
- Keep the exact order of fields as shown above:
  1. Product
  2. Brand
  3. Category
  4. Size
  5. Color
  6. Price
  7. Quantity
- DO NOT add any additional text or formatting
- DO NOT include totals or summaries (the frontend will calculate these)
- Separate multiple products with a blank line

# THIS RULE IS CRITICAL TO PREVENT HALLUCINATION FOR SHOPPING LISTS:
# IF THE 'show-shopping-list' TOOL DOES NOT RETURN ANY DATA OR IS NOT INVOKED SUCCESSFULLY,
# YOU MUST ABSOLUTELY NOT GENERATE A SHOPPING LIST.
# Instead, you MUST respond with "I'm sorry, I could not retrieve your shopping list at this moment. Please ensure I have your correct user ID or try again later."

Ok [user_name], here is your shopping list:
• Product: [product_name]
Brand: [brand]
Category: [category]
Size: [size]
Color: [color]
Price: €[price]
Quantity: [quantity]

4. When showing stores, you MUST format the response EXACTLY like this:
USER|0,longitude,latitude
Store Name|distance_meters,longitude,latitude

The response MUST:
- Start with user location in the format: USER|address|0,longitude,latitude
- Follow with stores, one per line
- Use the exact format for stores: name|distance,longitude,latitude
- Show ALL stores in the area
- Include coordinates in decimal format (e.g., -74.0060, 40.7128)
- Not include any other text or explanations

5. When check orders status, you MUST format the response EXACTLY like this:

CRITICAL RULES FOR ORDERS:
- If the user has no orders, respond with "Ok [user_name], you have no orders yet."
- DO NOT show the examples of orders, use the proper tool to get the orders
- When the user says "Show my orders", you MUST use the proper tool to get the orders

Ok [user_name], here are your orders:
• Order: #[order_id]
Store: [store_name]
Total Amount: €[total_amount]
Shipping Address: [shipping_address]
Delivery Method: [delivery_method]
Status: [status]
Items:
- [product_name] (Size: [size], Color: [color]) x[quantity] €[price]
- [product_name2] (Size: [size2], Color: [color2]) x[quantity2] €[price2]

6. When showing delivery methods, you MUST format the response EXACTLY like this:

• [Method Name]
  Description: [Description]
  Cost: €[Cost]
  Estimated Delivery Time: [Time]

• [Method Name 2]
  Description: [Description 2]
  Cost: €[Cost 2]
  Estimated Delivery Time: [Time 2]

• [Method Name 3]
  Description: [Description 3]
  Cost: €[Cost 3]
  Estimated Delivery Time: [Time 3]

"""

# Create a global memory store with the system prompt
memory_store = {
    "user-thread-1": {
        "messages": [
            {"role": "system", "content": prompt},
        ],
        "context": {
            "current_product": None,
            "last_search": None,
            "last_action": None,
            "user_id": None
        }
    }
}

# Initialize ToolboxClient and load tools once at module level
try:
    toolbox_client = ToolboxClient("https://toolbox-535807247199.us-central1.run.app")
    tools = toolbox_client.load_toolset()
except Exception as e:
    logger.error(f"Failed to initialize toolbox: {str(e)}")
    tools = None

def extract_store_id(text):
    """Extract store ID from text containing store information"""
    try:
        if "store_id" in text.lower():
            # Try to find store_id in the format "store_id: X" or "store_id: X,"
            store_match = re.search(r'store_id:\s*(\d+)', text.lower())
            if store_match:
                return int(store_match.group(1))
    except:
        pass
    return None

def chat():
    """
    Start an interactive chat session with Finn
    """
    thread_id = "user-thread-1"
    model = ChatVertexAI(model_name="gemini-2.0-flash")
    
    if tools is None:
        print("Error: Tools not available")
        return
        
    # Create agent
    agent = create_react_agent(model, tools)
    
    # Print welcome message
    print("\nFinn: Welcome to GenAI Sports! I'm Finn, your AI shopping assistant. How can I help you find what you're looking for today?")
    
    while True:
        # Get user input
        user_input = input("\nYou: ")
        
        # Check for exit command
        if user_input.lower() in ['exit', 'quit', 'bye']:
            print("\nFinn: Thank you for shopping with GenAI Sports! Have a great day!")
            break
        
        # Add user message to history
        memory_store[thread_id]["messages"].append(
            {"role": "user", "content": user_input}
        )
        
        try:
            # Get agent response
            response = agent.invoke(
                {"messages": memory_store[thread_id]["messages"]},
                config={"configurable": {"thread_id": thread_id}}
            )
            
            content = response["messages"][-1].content
            
            # Add assistant response to history
            memory_store[thread_id]["messages"].append(
                {"role": "assistant", "content": content}
            )
            
            # Print agent response
            print(f"\nFinn: {content}")
            
        except Exception as e:
            print("\nFinn: I apologize, but I encountered an error. Could you please rephrase your request?")
            print(f"Error: {str(e)}")

def process_message(message, history=[]):
    """
    Process a single message and return the response
    """
    thread_id = "user-thread-1"
    
    try:
        model = ChatVertexAI(model_name="gemini-2.0-flash")
        
        if tools is None:
            return "I'm having trouble connecting to my tools. Please try again in a moment."
        
        # Create agent
        agent = create_react_agent(model, tools)
        
        # Initialize or update memory store with history
        if not thread_id in memory_store:
            memory_store[thread_id] = {
                "messages": [{"role": "system", "content": prompt}],
                "context": {
                    "current_product": None,
                    "last_search": None,
                    "last_action": None,
                    "user_id": None
                }
            }
        
        if history:
            memory_store[thread_id]["messages"] = [
                {"role": "system", "content": prompt},
            ] + history
        
        # Add user message
        memory_store[thread_id]["messages"].append(
            {"role": "user", "content": message}
        )
        
        # Check if we need to get user ID
        if memory_store[thread_id]["context"]["user_id"] is None:
            # Look for name in the message
            name_match = re.search(r"I'm (\w+)", message, re.IGNORECASE)
            if name_match:
                name = name_match.group(1)
                # Use get-user-id-by-name tool
                try:
                    response = agent.invoke(
                        {
                            "messages": [
                                {"role": "system", "content": prompt},
                                {"role": "user", "content": f"get-user-id-by-name {name}"}
                            ]
                        },
                        config={"configurable": {"thread_id": thread_id}}
                    )
                    user_id = response["messages"][-1].content.strip()
                    if user_id.isdigit():
                        memory_store[thread_id]["context"]["user_id"] = int(user_id)
                except Exception as e:
                    logger.error(f"Error getting user ID: {str(e)}")
        
        logger.debug(f"Invoking agent with messages: {memory_store[thread_id]['messages']}")
        
        # Get agent response
        response = agent.invoke(
            {"messages": memory_store[thread_id]["messages"]},
            config={"configurable": {"thread_id": thread_id}}
        )
        
        content = response["messages"][-1].content
        
        # Add assistant response to history
        memory_store[thread_id]["messages"].append(
            {"role": "assistant", "content": content}
        )
        
        return content
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}", exc_info=True)
        return f"I encountered an error while processing your message. Please try again."

def get_current_user_id(thread_id="user-thread-1"):
    """
    Helper function to get the current user ID from memory store
    """
    return memory_store.get(thread_id, {}).get("context", {}).get("user_id")

if __name__ == "__main__":
    chat()