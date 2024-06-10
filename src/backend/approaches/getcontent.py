import os
import openai


AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT = os.environ.get("AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT")

# ベクトル変換
def generate_embeddings(text):
    response = openai.Embedding.create(
        input=text,
        engine=AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT  # text-embedding-ada-002 のデプロイ名
    )
    embeddings = response['data'][0]['embedding']
    return embeddings
   