import psycopg2
from psycopg2 import Error
import pandas as pd
import numpy as np
from pathlib import Path
from google import genai
from google.genai import types
from google.genai.types import HttpOptions
from tqdm import tqdm
import sys
import os
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel
import csv
import re

#GOOGLE_CLOUD_PROJECT="mtoscano-dev-sandbox"
#GOOGLE_CLOUD_LOCATION="us-central1"
#GOOGLE_GENAI_USE_VERTEXAI="True"

#client = genai.Client("True", "freddo-project", "us-central1")
client = genai.Client(vertexai=True, project="mtoscano-dev-sandbox", location="us-central1")
#client = genai.Client(http_options=HttpOptions(api_version="v1"))

def load_db_config():
    """Load database configuration from db_config.params file"""
    db_params = {}
    try:
        with open('db_config.params', 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=')
                    db_params[key.strip()] = value.strip()
        return db_params
    except FileNotFoundError:
        print("Error: db_config.params file not found")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading config file: {e}")
        sys.exit(1)


def create_database_schema(db_params):
    """
    Creates the database schema for the products and store management system.
    
    Args:
        db_params (dict): Database connection parameters containing:
            - host
            - database
            - user
            - password
            - port
    """
    try:
        # Establish connection
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()

        # Drop existing tables
        cursor.execute("DROP TABLE IF EXISTS products_variants CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS products CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS stores CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS users CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS delivery_methods CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS orders CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS order_items CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS shopping_lists CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS shopping_list_items CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS inventory CASCADE;")   

        # Create extensions if they don't exist
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS alloydb_scann;")
        connection.commit()

        # Create tables
        create_tables_query = """
        -- Products Table
        CREATE TABLE products (
            product_id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT, -- Key attributes should be included here for FTS & embedding
            category varchar(255), -- Eg: Hick and Camp, Running 
            Brand varchar(255),  -- Eg: Nike, Brooks, Quechua, Simon
            image_url VARCHAR(512),

            -- For keyword search (Full-Text Search)
--            search_vector TSVECTOR, -- TSVECTOR column for precomputed search terms

            -- For vector search (semantic search, recommendations)
--            embedding VECTOR(768),

            -- Additional fields for re-ranking
            popularity_score FLOAT DEFAULT 0.0
        );

        -- Products variants Table
        CREATE TABLE products_variants (
            variant_id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(product_id),
            size VARCHAR(255) NOT NULL,
            color VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL
        );

        -- Stores Table
        CREATE TABLE stores (
            store_id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            address VARCHAR(255),
            city VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(50) DEFAULT 'Spain', -- Default if most stores are in Spain
            popularity_score FLOAT DEFAULT 0.0
        );

        -- Users Table
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            Address VARCHAR(255),
            city VARCHAR(100),
    	    postal_code VARCHAR(20)
        );

        -- Shopping Lists Table
        CREATE TABLE shopping_lists (
            list_id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(user_id) ON DELETE CASCADE
        );

        -- Shopping List Items Table
        CREATE TABLE shopping_list_items (
            item_id SERIAL PRIMARY KEY,
            list_id INT REFERENCES shopping_lists(list_id) ON DELETE CASCADE,
            product_id INT REFERENCES products(product_id) ON DELETE CASCADE,
            variant_id INT REFERENCES products_variants(variant_id) ON DELETE CASCADE,
            quantity INT NOT NULL
        );

        -- Inventory Table
        CREATE TABLE inventory (
            inventory_id SERIAL PRIMARY KEY,
            variant_id INT NOT NULL REFERENCES products_variants(variant_id) ON DELETE CASCADE,
            store_id INT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
            quantity INT NOT NULL DEFAULT 0
        );

        -- Delivery Methods Table
        CREATE TABLE delivery_methods (
            delivery_method_id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            base_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
            estimated_delivery_time VARCHAR(100),
            store_id INTEGER REFERENCES stores(store_id)
        );
        -- Orders Table
        CREATE TABLE IF NOT EXISTS orders (
            order_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            store_id INTEGER REFERENCES Stores(store_id),
	        order_status VARCHAR(50) NOT NULL DEFAULT 'pending',
            shipping_address VARCHAR(255),
            delivery_method_id INT REFERENCES delivery_methods(delivery_method_id),
	        shipping_cost NUMERIC(10, 2) DEFAULT 0.00,
	        total_amount NUMERIC(12, 2) NOT NULL
        );

        -- Orders Items Table
        CREATE TABLE order_items (
            order_item_id SERIAL PRIMARY KEY,
            order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
            variant_id INT NOT NULL REFERENCES products_variants(variant_id),
            quantity INT NOT NULL CHECK (quantity > 0),
            price_at_purchase NUMERIC(10, 2) NOT NULL, -- Price of one unit of the variant at purchase
            product_name_at_purchase VARCHAR(255) NOT NULL,
            variant_details_at_purchase TEXT, -- e.g., "Size: 43, Color: Blue"
            subtotal_line_item NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * price_at_purchase) STORED
        );  
        """
        
        # Execute the query
        cursor.execute(create_tables_query)
        print("Database schema created successfully")
        # Commit the changes
        connection.commit()

    except (Exception, Error) as error:
        print(f"Error while creating database schema: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

def create_indexes(db_params):
    """
    Creates database indexes to optimize query performance.
    
    Args:
        db_params (dict): Database connection parameters
    """
    try:
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()

        # Create indexes
        cursor.execute("""
            -- Products table indexes
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
            CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
            
            -- Create SCANN index for fast approximate nearest neighbor search on embeddings
            CREATE INDEX IF NOT EXISTS idx_products_embedding_scann 
            ON products USING scann (embedding cosine) 
            WITH (
                num_leaves=10,          -- Adjusted for ~100 products
                max_num_levels=2
            );
            
            -- Product variants index
            CREATE INDEX IF NOT EXISTS idx_variants_product_id ON products_variants(product_id);
            
            -- Inventory indexes
            CREATE INDEX IF NOT EXISTS idx_inventory_variant_id ON inventory(variant_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON inventory(store_id);
            
            -- Orders indexes
            CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
            CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
            
            -- Order items indexes
            CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
            CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
            
            -- Stores spatial index
            CREATE INDEX IF NOT EXISTS idx_stores_location ON stores USING GIST(location);
            
            -- Users spatial index  
            CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
        """)

        connection.commit()
        print("Database indexes created successfully")

    except (Exception, Error) as error:
        print(f"Error while creating indexes: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")


def generate_product_embeddings(db_params):
    """
    Generate embeddings for product descriptions directly from the products table
    and update the embedding column
    """
    # Load database configuration
    db_params = load_db_config()
    
    try:
        # Establish connection
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()
        
        # Get all products without embeddings
        cursor.execute("SELECT product_id, description FROM products ORDER BY product_id")
        products = cursor.fetchall()
        
        # Generate embeddings for each description
        for product_id, description in tqdm(products):
            try:
                response = client.models.embed_content(model="text-embedding-005", contents=description)
                embedding = response.embeddings[0].values  # Access values of first embedding
                # Add embedding column if it doesn't exist
                cursor.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding VECTOR(768);")
                connection.commit()
                # Update the embedding in the database
                cursor.execute(
                    "UPDATE products SET embedding = %s WHERE product_id = %s",
                    (embedding, product_id)
                )
                connection.commit()  # Commit after each update
                
            except Exception as e:
                print(f"Error generating embedding for product {product_id}: {e}")
                connection.rollback()
        
        print("Embeddings generated and stored in database")
        
    except (Exception, Error) as error:
        print(f"Error while generating embeddings: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

def add_location_columns(db_params):
    """
    Add location columns to stores and users tables and populate with coordinates
    """
    try:
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()

        # Add location columns
        cursor.execute("ALTER TABLE stores ADD COLUMN IF NOT EXISTS location geography(Point, 4326);")
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS location geography(Point, 4326);")

        # Update store locations
        store_locations = {
            1: (41.3791088, 2.1284526),
            2: (41.3847956, 2.1314569),
            3: (41.3851542, 2.1519072),
            4: (41.3827734, 2.1228843),
            5: (41.4015078, 2.1991344),
            6: (41.4248298, 2.1930161)
        }

        for store_id, coords in store_locations.items():
            cursor.execute(
                "UPDATE stores SET location = ST_MakePoint(%s, %s)::geography WHERE store_id = %s",
                (coords[0], coords[1], store_id)
            )

        # Update user locations
        user_locations = {
            1: (41.385273, 2.161236),
            2: (41.381694, 2.136222),
            3: (41.399485, 2.157001),
            4: (41.405514, 2.175198),
            5: (41.384529, 2.183633)
        }

        for user_id, coords in user_locations.items():
            cursor.execute(
                "UPDATE users SET location = ST_MakePoint(%s, %s)::geography WHERE user_id = %s",
                (coords[0], coords[1], user_id)
            )

        connection.commit()
        print("Location columns added and populated successfully")

    except (Exception, Error) as error:
        print(f"Error while adding location columns: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

def load_data_from_csv(db_params):
    """Load data from CSV files into database tables"""
    try:
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()
        
        # Define CSV files and corresponding table names in the correct loading order
        csv_files = {
            'stores.csv': 'stores',  # Load stores first
            'products.csv': 'products',  # Then products
            'products_variants.csv': 'products_variants',  # Then variants
            'users.csv': 'users',  # Then users
            'delivery_methods.csv': 'delivery_methods',  # Then delivery methods
            'inventory.csv': 'inventory'  # Finally inventory (depends on stores and variants)
        }

        # Load each CSV file into its table
        for csv_file, table_name in csv_files.items():
            try:
                with open(f'../../../data/{csv_file}', 'r') as f:
                    # Skip the header row
                    next(f)
                    # Use copy_expert with CSV format to handle escaped commas
                    copy_sql = f"""
                        COPY {table_name} FROM STDIN WITH 
                        CSV 
                        DELIMITER ',' 
                        NULL '' 
                        QUOTE '"'
                    """
                    cursor.copy_expert(sql=copy_sql, file=f)
                print(f"Data loaded successfully from {csv_file} into {table_name} table")
                connection.commit()
                
            except Exception as e:
                print(f"Error loading {csv_file}: {e}")
                connection.rollback()

    except (Exception, Error) as error:
        print(f"Error while connecting to PostgreSQL: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

def generate_product_images(db_params):
    """Generate images for each product using Vertex AI Image Generation"""
    try:
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()
        
        # Get product names, descriptions, and brands from the database
        cursor.execute("SELECT name, description, brand FROM products")
        products = cursor.fetchall()

        # Initialize Vertex AI
        vertexai.init(project="mtoscano-dev-sandbox", location="us-central1")
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-002")

        # Create images directory if it doesn't exist
        image_dir = Path('../../../images')
        image_dir.mkdir(parents=True, exist_ok=True)

        # Generate image for each product
        for product in tqdm(products, desc="Generating product images"):
            name, description, brand = product
            # Create a refined prompt focusing only on the product image, including brand
            prompt = f"A professional product photo of {brand} {name}, {description}. The image should show only the product against a clean background, no text or labels, photorealistic style, high quality product photography"
            output_file = image_dir / f"{name}.png"

            # Skip if image already exists
            if output_file.exists():
                continue

            try:
                with tqdm(total=1, desc=f"Generating image for {name}", leave=False) as pbar:
                    images = model.generate_images(
                        prompt=prompt,
                        number_of_images=1,
                        language="en",
                        aspect_ratio="1:1",
                        safety_filter_level="block_some",
                    )
                    pbar.update(1)
                
                with tqdm(total=1, desc=f"Saving image for {name}", leave=False) as pbar:
                    images[0].save(location=str(output_file), include_generation_parameters=False)
                    pbar.update(1)
                
            except Exception as e:
                print(f"Error generating image for {name}: {e}")

    except (Exception, Error) as error:
        print(f"Error while connecting to PostgreSQL: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

def update_product_picture_urls(db_params):
    """
    Updates the picture_url column in the products table with the path to generated images.
    
    Args:
        db_params (dict): Database connection parameters
    """
    try:
        # Establish connection
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()

        # Update picture_url for all products
        cursor.execute("""
            UPDATE products 
            SET image_url = CONCAT('images/', name, '.png')
        """)
        
        # Commit the transaction
        connection.commit()
        print("Successfully updated picture URLs for all products")

    except (Exception, Error) as error:
        print(f"Error while updating picture URLs: {error}")
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

def create_search_vector(db_params):
    """
    Creates and populates the search_vector column in the products table
    for full-text search capabilities
    """
    try:
        # Establish connection
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor()
        
        # Create the search_vector column with appropriate weights
        cursor.execute("""
            -- Drop existing column if it exists
            ALTER TABLE products DROP COLUMN IF EXISTS search_vector;
            
            -- Add the search_vector column as a generated column
            ALTER TABLE products ADD COLUMN search_vector TSVECTOR
            GENERATED ALWAYS AS (
                setweight(to_tsvector('english', COALESCE(name, '')), 'A') || ' ' ||
                setweight(to_tsvector('english', COALESCE(brand, '')), 'A') || ' ' ||
                setweight(to_tsvector('english', COALESCE(category, '')), 'B') || ' ' ||
                setweight(to_tsvector('english', COALESCE(description, '')), 'D')
            ) STORED;
            
            -- Create GIN index on the search_vector for faster searching
            CREATE INDEX IF NOT EXISTS idx_products_search_vector 
            ON products USING GIN(search_vector);
        """)
        
        # Commit the changes
        connection.commit()
        print("Search vector column created and indexed successfully")
        
    except (Exception, Error) as error:
        print(f"Error while creating search vector: {error}")
        connection.rollback()
    
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection closed")

if __name__ == "__main__":
    db_params = load_db_config()    
    create_database_schema(db_params)
    load_data_from_csv(db_params)
    generate_product_embeddings(db_params)
    add_location_columns(db_params)
    create_search_vector(db_params)
    update_product_picture_urls(db_params)
    create_indexes(db_params)
#    generate_product_images(db_params)