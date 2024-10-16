# TODO:CosmosDB化
import os
import json
import jwt
import logging
import traceback
from flask import request
from opencensus.ext.azure.log_exporter import AzureLogHandler

from enum import Enum
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from azure.identity import DefaultAzureCredential

from dotenv import load_dotenv
# .envファイルの内容を読み込見込む
load_dotenv()

# CosmosDB
endpoint = os.environ.get("AZURE_COSMOSDB_ENDPOINT")
key = os.environ.get("COSMOSDB_KEY")
database_name = os.environ.get("AZURE_COSMOSDB_DATABASE")
container_name = os.environ.get("AZURE_COSMOSDB_CONTAINER")
# CosmosDB Initialization
credential = DefaultAzureCredential()
database = CosmosClient(endpoint, credential).get_database_client(database_name)
container = database.get_container_client(container_name)

A3B_FAQ_BOT_NAME = os.environ.get("A3B_FAQ_BOT_NAME")

logger = logging.getLogger(__name__)
logger.addHandler(AzureLogHandler(connection_string=os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")))
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
logger.addHandler(console_handler)
logger.setLevel(logging.INFO)

class ApproachType(Enum):
    Chat = "chat"
    DocSearch = "docsearch"
    Ask = "ask"

def get_user_name(req: request):
    user_name = ""

    try:
        token = req.headers["X-MS-TOKEN-AAD-ID-TOKEN"]
        claim = jwt.decode(jwt=token, options={"verify_signature": False})
        user_name = claim["preferred_username"]
        write_chatlog(ApproachType.Chat, user_name, 0, "claim", json.dumps(claim))
    except Exception:
        user_name = "anonymous"

    return user_name

# 特定のconversation_idを持つドキュメントを取得する
def get_conversation(conversation_id):
    try:
        query = "SELECT * FROM c WHERE c.conversation_id = @conversation_id"
        parameters = [{"name": "@conversation_id", "value": conversation_id}]
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        if items:
            return items[0]  # 最初の1件を返す
        else:
            return None
    except Exception as e:  
        print(f"Error in get_conversation: {str(e)}")  
        return None  

def write_chatlog(approach: ApproachType, user_name: str, total_tokens: int, input: str, response: str, conversationId: str, timestamp: str, conversation_title: str, query: str=""):
    # 既存の会話データを取得
    conversation = get_conversation(conversationId)
    # 既存の会話があればmessagesに追加
    if conversation:
        # 新しいメッセージを作成
        new_message = [
            {
                "role" : "user",
                "content" : input
            }, 
            {
                "role" : "assistant" if approach.value == "chat" else "bot",
                "content" : response
            }
        ]
        
        # 既存のmessagesリストに新しいメッセージを追加
        if "messages" in conversation:  
            conversation["messages"].extend(new_message)  
        else:  
            print("No 'messages' field found in the conversation document.")  
            return  
          
        # データベースにドキュメントを更新  
        try:  
            container.upsert_item(conversation)  
        except Exception as e:  
            print(f"Error in upsert_item: {str(e)}")  
        
        # データベースにドキュメントを更新
        container.upsert_item(conversation)
    # 初めての会話なら全体を保存
    else:
        from app import creat_title
        title = ""
        if conversation_title is None :
            title = creat_title(input)
        else:
            title = conversation_title

        properties = {
            "approach" : approach.value,
            "user" : user_name, 
            "tokens" : total_tokens,
            "conversation_id" : conversationId,
            "timestamp" : timestamp,
            "conversation_title": title,
            "bot_name": A3B_FAQ_BOT_NAME,
            "messages" : [
                {
                    "role" : "user",
                    "content" : input
                },
                {
                    "role" : "assistant" if approach.value == "chat" else "bot",
                    "content" : response
                }
            ]
        }

        if query != "":
            properties["query"] = query
        try:  
            container.create_item(body=properties, enable_automatic_id_generation=True)  
        except Exception as e:  
            print(f"Error in create_item: {str(e)}")  
    

def write_error(category: str, user_name: str, error: str):
    properties = {
        "category" : category, # "chat", "docsearch", "content"
        "user" : user_name,
        "bot_name" : A3B_FAQ_BOT_NAME,
        "error" : error
    }

    log_data = json.dumps(properties).encode('utf-8').decode('unicode-escape')
    traceback.print_exc()
    logger.error(log_data)

def select_user_conversations(user_name: str):
    try: 
        query = """
            SELECT c.approach, c.user, c.tokens, c.conversation_id, c.timestamp, c.conversation_title
            FROM c
            WHERE c.user = @user
            AND c.bot_name = @bot_name
        """
        parameters = [
            {
                "name": "@user", "value": user_name
            }, {
                "name": "@bot_name", "value": A3B_FAQ_BOT_NAME
            }
        ]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        return items
    except Exception as e:  
        print(f"Error in select_user_conversations: {str(e)}")
        return None
    
def select_conversation_content(conversation_id: str, approach: str):
    try: 
        query = """
            SELECT c.approach, c.user, c.tokens, c.conversation_id, c.messages
            FROM c
            WHERE c.conversation_id = @conversation_id
            AND c.approach = @approach
            AND c.bot_name = @bot_name
        """
        parameters = [
            {
                "name": "@conversation_id", "value": conversation_id
            }, {
                "name": "@approach", "value": approach
            }, {
                "name": "@bot_name", "value": A3B_FAQ_BOT_NAME
            }
        ]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        return items
    except Exception as e:  
        print(f"Error in select_conversation_content: {str(e)}")
        return None
    
def delete_conversation_content(conversation_id: str):
    try: 
        query = """
            SELECT *
            FROM c
            WHERE c.conversation_id = @conversation_id
            AND c.bot_name = @bot_name
        """
        parameters = [
            {
                "name": "@conversation_id", "value": conversation_id
            }, {
                "name": "@bot_name", "value": A3B_FAQ_BOT_NAME
            }
        ]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        if not items:
            print(f"No items found for conversation_id: {conversation_id}")
            return False
        for item in items:
            container.delete_item(item['id'], partition_key=item['id'])
        return True
    except Exception as e:  
        print(f"Error in delete_conversation_content: {str(e)}")
        return False
    
