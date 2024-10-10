import os
import time
import mimetypes
import urllib.parse
import jwt
import requests 
from flask import Flask, request, jsonify
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from base64 import urlsafe_b64decode
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
import tiktoken
import openai

from core.messagebuilder import MessageBuilder

from dotenv import load_dotenv

from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from azure.storage.blob import BlobServiceClient
from approaches.chatlogging import get_user_name, write_error
from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from approaches.chatread import ChatReadApproach
from approaches.chatlogging import select_user_conversations, select_conversation_content, delete_conversation_content

from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry.instrumentation.flask import FlaskInstrumentor

# .envファイルの内容を読み込見込む
load_dotenv()

# Replace these with your own values, either in environment variables or directly here
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER")

AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX")

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "vector"
KB_FIELDS_CATEGORY = os.environ.get("KB_FIELDS_CATEGORY") or "chunk"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "title"
SEMANTIC_CONFIGURATION_NAME = os.environ.get("SEMANTIC_CONFIGURATION_NAME")

AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION")

AZURE_OPENAI_GPT_35_TURBO_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_35_TURBO_DEPLOYMENT")
AZURE_OPENAI_GPT_35_TURBO_16K_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_35_TURBO_16K_DEPLOYMENT")
AZURE_OPENAI_GPT_4_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_4_DEPLOYMENT")
AZURE_OPENAI_GPT_4_32K_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_4_32K_DEPLOYMENT")

gpt_models = {
    "gpt-3.5-turbo": {
        "deployment": AZURE_OPENAI_GPT_35_TURBO_DEPLOYMENT,
        "max_tokens": 4096,
        "encoding": tiktoken.encoding_for_model("gpt-3.5-turbo")
    },
    "gpt-3.5-turbo-16k": {
        "deployment": AZURE_OPENAI_GPT_35_TURBO_16K_DEPLOYMENT,
        "max_tokens": 16384,
        "encoding": tiktoken.encoding_for_model("gpt-3.5-turbo")
    },
    "gpt-4": {
        "deployment": AZURE_OPENAI_GPT_4_DEPLOYMENT,
        "max_tokens": 8192,
        "encoding": tiktoken.encoding_for_model("gpt-4")
    },
    "gpt-4-32k": {
        "deployment": AZURE_OPENAI_GPT_4_32K_DEPLOYMENT,
        "max_tokens": 32768,
        "encoding": tiktoken.encoding_for_model("gpt-4-32k")
    }
}

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed, 
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the 
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential()

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = AZURE_OPENAI_API_VERSION

# Comment these two lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
openai.api_type = "azure_ad"
openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = openai_token.token
# openai.api_key = os.environ.get("AZURE_OPENAI_KEY")

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_credential)
blob_client = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net", 
    credential=azure_credential)
blob_container = blob_client.get_container_client(AZURE_STORAGE_CONTAINER)

chat_approaches = {
    "rrr": ChatReadRetrieveReadApproach(
        search_client, 
        KB_FIELDS_SOURCEPAGE, 
        KB_FIELDS_CONTENT,
        SEMANTIC_CONFIGURATION_NAME
    ),
    "r": ChatReadApproach()
}

configure_azure_monitor()

app = Flask(__name__)
FlaskInstrumentor().instrument_app(app)
AUTHORITY = "https://login.microsoftonline.com/"
CLIENT_ID = ""

def convert_jwk_to_rsa_key(jwk):
    """
    Convert a JWK (JSON Web Key) to an RSA public key
    """
    # Base64URL decode n and e
    n = int.from_bytes(urlsafe_b64decode(jwk['n'] + '=='), 'big')  # Add padding for base64 decoding
    e = int.from_bytes(urlsafe_b64decode(jwk['e'] + '=='), 'big')  # Add padding for base64 decoding
    print(f"n: {n}")
    print(f"e: {e}")
    # nとeからRSA公開鍵を作成する
    public_numbers = rsa.RSAPublicNumbers(e, n)
    public_key = public_numbers.public_key(backend=default_backend())
    
    return public_key


def validate_token(token):
    try:
        print("Token:", token)
        header = jwt.get_unverified_header(token)
        print("Token header:", header)
        jwks_url = f"{AUTHORITY}/discovery/v2.0/keys"
        jwks = requests.get(jwks_url).json()
        rsa_key = None

        for key in jwks["keys"]:
            if key["kid"] == header["kid"]:
                # JWKをRSA公開鍵に変換
                rsa_key = convert_jwk_to_rsa_key(key)
                break
        
        if rsa_key is None:
            raise ValueError("Public key not found in JWKs")
        print("RSA Key:", rsa_key)
        print("RSA Key type:", type(rsa_key))
        # アクセストークンの検証
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=[
                # CLIENT_ID, # カスタムAPI用のクライアントID
                "00000003-0000-0000-c000-000000000000" # Microsoft Graphのaud
            ]
            # options={"verify_signature": True, "verify_aud": True}
        )
        return payload
    except jwt.ExpiredSignatureError:
        print('トークンの有効期限切れ')
    except jwt.InvalidTokenError:
        print('無効なトークン')
    except Exception as e:
        print(f"Token validation error: {e}")
        return None

@app.route("/userinfo", methods=["GET"])  
def userinfo():
    auth_header = request.headers.get("Authorization")  
    if auth_header:  
        token = auth_header.split(" ")[1]  
        user_info = validate_token(token)  
        if user_info:  
            return jsonify(user_info)  
    return jsonify({"error": "Invalid token"}), 401

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

# Serve content files from blob storage from within the app to keep the example self-contained. 
# *** NOTE *** this assumes that the content files are public, or at least that all users of the app
# can access all the files. This is also slow and memory hungry.
@app.route("/content/<path>")
def content_file(path):
    try:
        path = path.strip()

        blob = blob_client.get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=path)
        properties = blob.get_blob_properties()

        if properties.size < 2 * 1024 * 1024: # 2MB
            blob = blob_container.get_blob_client(path).download_blob()

            mime_type = blob.properties["content_settings"]["content_type"]
            if mime_type == "application/octet-stream":
                mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"

            _, ext = os.path.splitext(path)
            ext = ext[1:].lower()
            extensions = ["doc", "docs", "xls", "xlsx", "ppt", "pptx"]
            if ext in extensions:
                # ダウンロードすべき
                mode = "attachment"
            else:
                # ページの一部として表示可能
                mode = "inline"
            
            return blob.readall(), 200, {"Content-Type": mime_type, "Content-Disposition": f"{mode}; filename={urllib.parse.quote(path)}"}
        else:
            html = f"<!DOCTYPE html><html><head><title>oversize file</title></head><body><p>Subject file cannot be previewed due to the size limit, {properties.size} bytes. See [Supporting content] tab.</p></body></html>"
            return html, 403, {"Content-Type": "text/html"}

    except Exception as e:
        user_name = get_user_name(request)
        write_error("content", user_name, str(e))
        return jsonify({"error": str(e)}), 500

# Chat
@app.route("/chat", methods=["POST"])
def chat():
    ensure_openai_token()
    approach = request.json["approach"]
    # user_name = get_user_name(request)
    try:
        user_name = request.json["loginUser"]
    except Exception:
        user_name = "anonymous"
    overrides = request.json.get("overrides")
    conversationId = request.json.get("conversationId")
    timestamp = request.json.get("timestamp")
    conversation_title = request.json["conversation_title"]
    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(user_name, request.json["history"], overrides, conversationId, timestamp, conversation_title)
        return jsonify(r)
    except Exception as e:
        write_error("chat", user_name, str(e))
        return jsonify({"error": str(e)}), 500

# Document Search
@app.route("/docsearch", methods=["POST"])
def docsearch():
    ensure_openai_token()
    approach = request.json["approach"]
    # user_name = get_user_name(request)
    try:
        user_name = request.json["loginUser"]
    except Exception:
        user_name = "anonymous"
    overrides = request.json.get("overrides")
    conversationId = request.json.get("conversationId")
    timestamp = request.json.get("timestamp")
    conversation_title = request.json["conversation_title"]

    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(user_name, request.json["history"], overrides, conversationId, timestamp, conversation_title)
        return jsonify(r)
    except Exception as e:
        write_error("docsearch", user_name, str(e))
        return jsonify({"error": str(e)}), 500

def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token
    # openai.api_key = os.environ.get("AZURE_OPENAI_KEY")

# get Conversation History
@app.route("/", methods=["POST"])
def get_conversation_history():
    # ensure_openai_token()
    # user_name = get_user_name(request)
    try:
        user_name = request.json["loginUser"]
    except Exception:
        user_name = "anonymous"
    try:
        # ユーザーの会話履歴をクエリ
        conversation_data = select_user_conversations(user_name)
        if conversation_data is None:
            return jsonify(None)
        else:
            conversations = []
            for conv in conversation_data:
                # "messages" キーが存在するかどうか
                if "conversation_id" in conv:
                    conversation = {
                        "conversation_id": conv["conversation_id"],
                        "approach":conv["approach"],
                        # "title": conv["messages"][0]["content"] if conv["messages"] else "No Title",
                        "title": conv["conversation_title"] if "conversation_title" in conv and conv["conversation_title"] is not None else "No Title",
                        "timestamp": conv["timestamp"]
                    }
                    conversations.append(conversation)
            response_data = {
                "user_id": user_name,
                "conversations": conversations
            }
            return jsonify(response_data)
    except Exception as e:
        print(f"Error in get_conversation_history: {str(e)}")
        return jsonify({"error": str(e)}), 500

# get Conversation Content
@app.route("/conversationcontent", methods=["POST"])
def get_conversation_content():
    # ensure_openai_token()
    # user_name = get_user_name(request)
    conversation_id = request.json.get("conversation_id")
    approach = request.json.get("approach")
    content = {}
    try:
        # ユーザーの会話内容をクエリ
        content_data = select_conversation_content(conversation_id, approach)
        if content_data is None:
            return jsonify(None)
        # "messages" キーが存在するかどうか
        if "messages" in content_data[0]:
            content = {
                "conversation_id": content_data[0]["conversation_id"],
                "approach":content_data[0]["approach"],
                "conversations":[
                    {
                        "role": msg["role"],
                        "content": msg["content"]
                    }
                    for msg in content_data[0]["messages"]
                ]
            }
            return jsonify(content)
        else:
            # "messages" キーがない、または空の場合
            return jsonify(None)
    except Exception as e:
        print(f"Error in get_conversation_content: {str(e)}")
        return jsonify({"error": str(e)}), 500

# get DocSearch Conversation Content
@app.route("/conversationcontent/docsearch", methods=["POST"])
def get_docsearch_conversation_content():
    # ensure_openai_token()
    # user_name = get_user_name(request)
    conversation_id = request.json.get("conversation_id")
    approach = request.json.get("approach")
    content = {}
    try:
        # ユーザーの会話内容をクエリ
        content_data = select_conversation_content(conversation_id, approach)
        if content_data is None:
            return jsonify(None)
        # "messages" キーが存在するかどうか
        if "messages" in content_data[0]:
            content = {
                "conversation_id": content_data[0]["conversation_id"],
                "approach":content_data[0]["approach"],
                "conversations":[
                    {
                        "role": msg["role"],
                        "content": msg["content"]
                    }
                    for msg in content_data[0]["messages"]
                ]
            }
            return jsonify(content)
        else:
            # "messages" キーがない、または空の場合
            return jsonify(None)
    except Exception as e:
        print(f"Error in get_docsearch_conversation_content: {str(e)}")
        return jsonify({"error": str(e)}), 500

def creat_title(input):
    system_prompt_for_title = """Your assistant will come up with a title for your question.
                Answer in the customer's language.
                Titles should be easy to understand and no more than 20 characters.
                Please use the words you have used as much as possible.
                Don't end your sentences with a "?"."""
    prompt = input
    message_builder_for_title = MessageBuilder(system_prompt_for_title)
    messages_for_title = message_builder_for_title.get_messages_from_history(
        [], 
        prompt
        )
    conversation_title = openai.ChatCompletion.create(
        engine=AZURE_OPENAI_GPT_35_TURBO_DEPLOYMENT, 
        messages=messages_for_title,
        temperature=0.5, 
        # max_tokens=max_tokens,
        n=1)
    title = conversation_title.choices[0]["message"]["content"]
    return title

# delete Conversation Content
@app.route("/delete", methods=["POST"])
def delete_conversation():
    # ensure_openai_token()
    # user_name = get_user_name(request)
    conversation_id = request.json.get("conversation_id")
    content = {}
    try:
        # ユーザーの会話内容をクエリ
        isSuccess = delete_conversation_content(conversation_id)
        content = {"success": isSuccess}
        return jsonify(content)
    except Exception as e:
        print(f"Error in delete_conversation: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5000, host='0.0.0.0')
