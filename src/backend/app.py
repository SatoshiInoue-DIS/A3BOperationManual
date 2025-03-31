import os
import time
import mimetypes
import urllib.parse
import jwt
import jwt.algorithms
import requests 
from flask import Flask, request, jsonify, session, redirect

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
# load_dotenv(dotenv_path=("C:/inetpub/wwwroot/Test/.azure/OperationManual/.env"))

# これらを環境変数または直接ここにある独自の値に置き換えてください。
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
AZURE_OPENAI_GPT_4O_MINI_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_4O_MINI_DEPLOYMENT")
AZURE_OPENAI_GPT_4O_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_4O_DEPLOYMENT")

AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")

# 現在のユーザー ID を使用して、Azure OpenAI、Cognitive Search、Blob Storage で認証します (シークレットは不要です。
# ローカルでは 'az login' を使用し、Azure にデプロイする場合はマネージド ID を使用します)。
# キーを使用する必要がある場合は、各サービスのキーを持つ個別の AzureKeyCredential インスタンスを使用します。
# DefaultAzureCredntial 解決中にブロッキング エラーが発生した場合は、パラメーターを使用して問題のある資格情報を除外できます
# (例: exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential()

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = AZURE_OPENAI_API_VERSION

# キーを使用する場合は、これらの2行をコメントアウトし、代わりにOPENAI_API_KEY環境変数にAPIキーを設定します。
openai.api_type = "azure_ad"
openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = openai_token.token
# openai.api_key = os.environ.get("AZURE_OPENAI_KEY")

# Cognitive SearchとStorageのクライアントを設定する
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

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

def validate_token(token):
    try:
        # 1.公開鍵の一覧を取得
        key_url = requests.get("https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration").json()["jwks_uri"]
        keys = requests.get(key_url).json()["keys"]
        # 2.IDトークンの署名を検証する公開鍵を抽出
        header = jwt.get_unverified_header(token)
        for key in keys:
            # kidが一致している公開鍵を抽出
            if key["kid"] == header["kid"]:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break
        # 3.IDトークンを検証
        decoded_token = jwt.decode(
            token,
            public_key,
            audience=AZURE_CLIENT_ID,
            algorithms=["RS256"]
        )
        return decoded_token
    # 検証に失敗した場合
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

@app.route("/logout", methods=["GET"])
def logout():
    # セッションをクリア
    session.clear()
    
    # # Azure ADのサインアウトURLへリダイレクト
    # return redirect("https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=http://localhost:1234")



# 例を自己完結型に保つために、アプリ内から BLOB ストレージからコンテンツ ファイルを提供します。
# *** 注意 *** これは、コンテンツ ファイルが公開されているか、少なくともアプリのすべてのユーザーが
# すべてのファイルにアクセスできることを前提としています。これもまた遅く、メモリを大量に消費します。
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
    user_name = request.json.get("loginUser", "anonymous")
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
    user_name = request.json.get("loginUser", "anonymous")
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

# get Conversation History
@app.route("/", methods=["POST"])
def get_conversation_history():
    user_name = request.json.get("loginUser", "anonymous")
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
        n=1)
    title = conversation_title.choices[0]["message"]["content"]
    return title

# delete Conversation Content
@app.route("/delete", methods=["POST"])
def delete_conversation():
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
    port = int(os.environ.get('HTTP_PLATFORM_PORT', 5000))
    app.run(debug=True, port=port)
