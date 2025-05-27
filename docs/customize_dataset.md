## 1. Update the Dataset

Go to the '/data' folder and edit the following CSV files:

* **stores.csv**
    * Update these fields: 'Name', 'Address', 'City', 'postal_code', 'country'
* **users.csv**
    * Add your specific user to the list, following the existing structure.
* **delivery_methods.csv**
    * Review the 'description' field to match your store names and city.

## 2. Update Locations for the Stores and the Users

To update the locations, you'll first need the latitude and longitude for your new spots.

1.  Go to Google Maps: [https://www.google.es/maps](https://www.google.es/maps)
2.  Search for your desired new location (e.g., "Decathlon in Madrid").
3.  Click on the location and then check the URL in the navigation bar for the latitude and longitude.
    * *Example URL segment:* `@40.4167,-3.7038` (where 40.4167 is latitude, -3.7038 is longitude)
4.  Save these new latitude and longitude values for your stores and users.
5.  Then, open 'src/backend/setup/load_data.py', find the 'add_location_columns' function, and update it with the latitude and longitude you just saved.

## 3. Update the Name of the imaginary store (GenAI Sports)

The demo uses an imaginary store called "GenAI Sports." If you want to customize its name, follow these steps:

1.  Go to 'src/backend/finn_agent.py'.
2.  Search for "GenAI Sports" and replace it with your new store name.
3.  Go to 'src/frontend/src/pages/Home.jsx'.
4.  Search for "GenAI Sports" and replace it with your new store name.

## 4. Update the Logo of Your GenAI Store

1.  Upload your new logo image to 'src/frontend/src/images'.
2.  Go to 'src/frontend/src/components/layout/Header.jsx'.
3.  Update the logo import statement to reference your new image file.
