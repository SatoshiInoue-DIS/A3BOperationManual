from text import nonewlines

import openai
from approaches.getcontent import generate_embeddings
from azure.search.documents import SearchClient
from azure.search.documents.models import QueryType
from approaches.approach import Approach
from approaches.chatlogging import write_chatlog, ApproachType
from core.messagebuilder import MessageBuilder
from core.modelhelper import get_gpt_model, get_max_token_from_messages
import tiktoken
import json

# Cognitive Search と OpenAI API を直接使用する、取得してから読み取るシンプルな実装。
# まず検索から上位のドキュメントを取得し、それらを使用してプロンプトを作成し、
# 次に OpenAI を使用してそのプロンプトで補完 (回答) を生成します。
class ChatReadRetrieveReadApproach(Approach):
    # Chat roles
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

    """
    Simple retrieve-then-read implementation, using the Cognitive Search and OpenAI APIs directly. It first retrieves
    top documents from search, then constructs a prompt with them, and then uses OpenAI to generate an completion
    (answer) with that prompt.
    """
    system_message_chat_conversation = """Assistant helps the customer questions. keep your answers concise and in Japanese.
Answer ONLY with the facts listed in the list of sources below. If there isn't enough information below, say you don't know. Do not generate answers that don't use the sources below. If asking a clarifying question to the user would help, ask the question.
For tabular information, return it as Markdown, not HTML. 
If a word with multiple meanings is used, ask which meaning the word should be, if necessary.
If you have other suggestions or options that are not included in the information sources below, please use the phrase "in the following information sources."
Each source has a name followed by colon and the actual information, always include the source name for each fact you use in the response. Use square brackets to reference the source, e.g. [info1.txt]. Don't combine sources, list each source separately, e.g. [info1.txt][info2.pdf].
"""
    query_prompt_template = """Below is a history of the conversation so far, and a new question asked by the user that needs to be answered by searching in a knowledge base.
Generate a search query based on the conversation and the new question.
Do not include cited source filenames and document names e.g info.txt or doc.pdf in the search query terms.
Do not include any text inside [] or <<>> in the search query terms.
Do not include any special characters like '+'.
The language of the search query is generated in the language of the string described in the source question.
If you cannot generate a search query, return just the number 0.

source quesion: {user_question}
"""
    query_prompt_few_shots = [
        {'role' : USER, 'content' : 'What are my health plans?' },
        {'role' : ASSISTANT, 'content' : 'Show available health plans' },
        {'role' : USER, 'content' : 'does my plan cover cardio?' },
        {'role' : ASSISTANT, 'content' : 'Health plan cardio coverage' }
    ]

    def __init__(self, search_client: SearchClient, sourcepage_field: str, content_field: str, semantic_conf_name: str):
        self.search_client = search_client
        self.sourcepage_field = sourcepage_field
        self.content_field = content_field
        self.semantic_conf_name = semantic_conf_name
    
    def run(self, user_name: str, history: list[dict], overrides: dict, conversationId: str, timestamp: str, title: str) -> any:
        chat_model = overrides.get("gptModel")
        chat_gpt_model = get_gpt_model(chat_model)
        chat_deployment = chat_gpt_model.get("deployment")

        # ステップ 1: チャット履歴と最後の質問に基づいて、最適化されたキーワード検索クエリを生成します
        user_q = 'Generate search query for: ' + history[-1]["user"]
        query_prompt = self.query_prompt_template.format(user_question=history[-1]["user"])
        message_builder = MessageBuilder(query_prompt)
        messages = message_builder.get_messages_from_history(
            history,
            user_q,
            self.query_prompt_few_shots
            )

        max_tokens =  get_max_token_from_messages(messages, chat_model)

        # クエリ生成
        chat_completion = openai.ChatCompletion.create(
            engine=chat_deployment, 
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
            n=1)
        # クエリ取り出し
        query_text = chat_completion.choices[0].message.content
        if query_text.strip() == "0":
            query_text = history[-1]["user"] # より良いクエリを生成できなかった場合は、最後のユーザー入力を使用します

        total_tokens = chat_completion.usage.total_tokens

        # 質問文のベクトルを算出
        query_vector = generate_embeddings(history[-1]["user"]) # ベクトルクエリ

        # ステップ 2: GPT 最適化クエリを使用して検索インデックスから関連ドキュメントを取得する
        use_semantic_captions = True if overrides.get("semanticCaptions") else False
        top = overrides.get("top")
        exclude_category = overrides.get("excludeCategory") or None
        #インデックスで設定したtitleフィールドの中で除外するものを選ぶ（本来ならドキュメントをカテゴリごとに仕分けしてそれを指定するようにする）
        #neは演算子<>の意味でオペランドが等しくない場合に真、またeqは＝でオペランドが等しい場合に真という意味かも知れない
        filter = "title ne '{}'".format(exclude_category.replace("'", "''")) if exclude_category else None
        semantic_ranker = overrides.get("semanticRanker")

        if semantic_ranker:
            r = self.search_client.search(query_text,
                                          filter=filter,
                                          query_type=QueryType.SEMANTIC,
                                          query_language="en-us",
                                          query_speller="lexicon",
                                          semantic_configuration_name=self.semantic_conf_name,
                                          query_answer='extractive',
                                          top=top,
                                          query_caption="extractive|highlight-false" if use_semantic_captions else None,
                                          vector=query_vector,
                                          top_k=5,      #上から5つのデータ
                                          vector_fields=self.content_field
                                          )
        else:
            r = self.search_client.search(query_text,
                                          filter=filter,
                                          top=top
                                          )
            
        # 検索結果をtopの件数取得してresultsに入れる
        if use_semantic_captions:
            #@search.captions.textにクエリのコンテキストに応じた要約が入っている
            results = [doc[self.sourcepage_field] + ": " + nonewlines(" . ".join([c.text for c in doc['@search.captions']])) for doc in r]
        else:
            results = [doc[self.sourcepage_field] + ": " + nonewlines(doc[self.content_field]) for doc in r]
        content = "\n".join(results)

        # STEP 3: 検索結果とチャット履歴を使用して、コンテキストとコンテンツに応じた回答を生成します。
        completion_model = chat_model

        completion_gpt_model = get_gpt_model(completion_model)
        completion_deployment = completion_gpt_model.get("deployment")

        message_builder = MessageBuilder(self.system_message_chat_conversation)
        messages = message_builder.get_messages_from_history(
            history,
            history[-1]["user"]+ "\n\nSources:\n" + content[:1024], # モデルは長いシステム メッセージを適切に処理しません。ソースを最新のユーザー会話に移動して、フォローアップの質問プロンプトを解決します。
            )

        temaperature = float(overrides.get("temperature"))
        max_tokens = get_max_token_from_messages(messages, completion_model)

        # 回答生成
        response = openai.ChatCompletion.create(
            engine=completion_deployment, 
            messages=messages,
            temperature=temaperature, 
            max_tokens=1024,
            n=1,
            stream=True
        )
        # 返答を受け取り、逐次yield
        response_text = ""
        for chunk in response:
            if chunk:
                content = chunk['choices'][0]['delta'].get('content')
                if content:
                    response_text += content
                    yield content # 各チャンクをフロントに送信

        # トークン数を推定（レスポンスの文字数から算出しているだけあまり意味はない）
        # 新しいバージョンのopenaiならストリームでも最後にトークン数を出してくれるみたい
        encoding_name = tiktoken.encoding_for_model(chat_model).name
        encoding = tiktoken.get_encoding(encoding_name)
        total_tokens = len(encoding.encode(response_text))
        # logging
        # Azure Cosmos DBのコンテナーにプロンプトを登録
        input_text = history[-1]["user"]
        write_chatlog(ApproachType.DocSearch, user_name, total_tokens, input_text, response_text, conversationId, timestamp, title, query_text)
        msg_to_display = '\n\n'.join([str(message) for message in messages])
        # マークダウン形式の水平線を入れ込む
        response_text += "***"
        yield json.dumps({
            "data_points": results,  # 検索結果など
            "answer": response_text,  # 最終的な応答
            "thoughts": f"Searched for:<br>{query_text}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>')
        })

        yield "\n[END OF RESPONSE]"

