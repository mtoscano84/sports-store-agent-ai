#!/bin/bash

python3 -m venv local_env
source local_env/bin/activate
pip3 install -r requirements.txt
python3 load_data.py
deactivate