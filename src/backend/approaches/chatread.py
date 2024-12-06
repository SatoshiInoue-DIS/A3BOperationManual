from typing import Any

import openai
# To uncomment when enabling asynchronous support.
# from azure.cosmos.aio import ContainerProxy
from approaches.approach import Approach
from approaches.chatlogging import write_chatlog, ApproachType
from core.messagebuilder import MessageBuilder
from core.modelhelper import get_gpt_model, get_max_token_from_messages
import tiktoken
# Simple read implementation, using the OpenAI APIs directly. It uses OpenAI to generate an completion 
# (answer) with that prompt.
class ChatReadApproach(Approach):
    system_message_chat_conversation = """If someone asks you to write a report or a daily report, don't write it. Instead, tell them in Japanese that you can't do it.
"""
    def run(self, user_name: str, history: list[dict[str, str]], overrides: dict[str, Any], conversationId: str, timestamp: str, title: str) -> Any:
        chat_model = overrides.get("gptModel")
        chat_gpt_model = get_gpt_model(chat_model)
        chat_deployment = chat_gpt_model.get("deployment")

        systemPrompt =  overrides.get("systemPrompt")
        concatenatedSystemPrompt = self.system_message_chat_conversation + systemPrompt
        temaperature = float(overrides.get("temperature"))

        user_q = history[-1]["user"]
        message_builder = MessageBuilder(concatenatedSystemPrompt)
        messages = message_builder.get_messages_from_history(
            history, 
            user_q
            )

        max_tokens = get_max_token_from_messages(messages, chat_model)

        chat_completion = openai.ChatCompletion.create(
            engine=chat_deployment, 
            messages=messages,
            temperature=temaperature, 
            max_tokens=max_tokens,
            n=1,
            stream=True
        )
        # 返答を受け取り、逐次yield
        response_text = ""
        for chunk in chat_completion:
            if chunk:
                content = chunk['choices'][0]['delta'].get('content')
                if content:
                    response_text += content
                    yield content

        # トークン数を推定（レスポンスの文字数から算出しているだけあまり意味はない）
        # 新しいバージョンのopenaiならストリームでも最後にトークン数を出してくれるみたい
        encoding_name = tiktoken.encoding_for_model(chat_model).name
        encoding = tiktoken.get_encoding(encoding_name)
        total_tokens = len(encoding.encode(response_text))
        # logging
        input_text = history[-1]["user"]
        write_chatlog(ApproachType.Chat, user_name, total_tokens, input_text, response_text, conversationId, timestamp, title)

        yield "\n[END OF RESPONSE]"
