# Python online compiler

### To run locally
```
git clone https://github.com/hubsMIT1/py-compiler.git
cd py-compiler
```
### To run backend
```
cd server
python -m venv venv
venv/Scripts/activate
pip install -r requirements.txt
jupyter server --debug --NotebookApp.allow_origin="*"
```
`search for the token and keep it.`

### To run frontend
```
cd frontend
npm i 
- update the env with found token and save
npm run dev
```
