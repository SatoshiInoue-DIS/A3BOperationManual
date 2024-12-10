import { DecodedToken, AskRequest, AskResponse, GptChatRequest, ChatRequest, ChatResponse, UserConversations, ConversationContent, DeleteResponse } from "./models";

export async function askApi(options: AskRequest): Promise<AskResponse> {
    const response = await fetch("/ask", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            question: options.question,
            approach: options.approach,
            overrides: options.overrides
        })
    });

    const parsedResponse: AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}
 
export async function getLoginInfo(accessToken: string): Promise<DecodedToken> {
    const response = await fetch("/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const userInfo: DecodedToken = await response.json();
    return userInfo;
}

export async function searchdocApi(options: ChatRequest, onStreamUpdate: (content: string) => void): Promise<AskResponse> {
    try {
        const response = await fetch("/docsearch", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                history: options.history,
                approach: options.approach,
                overrides: options.overrides,
                conversationId: options.conversation_id,
                timestamp: options.timestamp,
                conversation_title: options.conversation_title,
                loginUser: options.loginUser,
            })
        });

        // レスポンスが正しくない場合はエラーを投げる
        if (response.status > 299 || !response.ok) {
            const errorResponse = await response.json();
            throw Error(errorResponse.error || "Unknown error");
        }
        // レスポンスのボディがnullでないことを確認
        if (!response.body) {
            throw new Error("レスポンスのボディがありません。");
        }
        // ストリームされたデータを処理
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            // ストリームが閉じられると処理を抜ける
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // ストリーミング終了マーカーの検知
            if (chunk.includes("\n[END OF RESPONSE]")) {
                // ストリームの終了を検知したら特別な処理を行う
                onStreamUpdate("\n[END OF RESPONSE]");
                break;
            }
            // 受信したデータをhandleStreamUpdateに渡す
            // 通常の応答は逐次表示
            onStreamUpdate(chunk);
            result += chunk;
        }
        if (result.includes("\n[InvalidRequestError]")) {
            const textOfInvalidRequestError = "トークンが最大に達しました。新しいチャットを作成するか、モデルを変更してください。"
            const parsedResponse: string = await JSON.stringify({answer: textOfInvalidRequestError});
            // 最終的な結果をJSON形式で解析
            return JSON.parse(parsedResponse);
        } else if(result.includes("\n[ERROR]")){
            const textOfError = "エラーが発生してしまいました。申し訳ないですが、新しいチャットで再開してください"
            const parsedResponse: string = await JSON.stringify({answer: textOfError});
            // 最終的な結果をJSON形式で解析
            return JSON.parse(parsedResponse);
        } else {
            const parsedResponse: string = await JSON.stringify({answer: result});
            // 最終的な結果をJSON形式で解析
            return JSON.parse(parsedResponse);
        }
    } catch (error: any) {
        onStreamUpdate("");
        return JSON.parse(await JSON.stringify({ answer: "エラーが発生しました。:" + error }));
    }
}

export async function chatApi(options: GptChatRequest, onStreamUpdate: (content: string) => void): Promise<ChatResponse> {
    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                history: options.history,
                approach: options.approach,
                overrides: options.overrides,
                conversationId: options.conversation_id,
                timestamp: options.timestamp,
                conversation_title: options.conversation_title,
                loginUser: options.loginUser,
            })
        });

        // レスポンスが正しくない場合はエラーを投げる
        if (response.status > 299 || !response.ok) {
            const errorResponse = await response.json();
            throw Error(errorResponse.error || "Unknown error");
        }
        // レスポンスのボディがnullでないことを確認
        if (!response.body) {
            throw new Error("レスポンスのボディがありません。");
        }
        // ストリームされたデータを処理
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let result = '';
    
        while (true) {
            const { done, value } = await reader.read();
            // ストリームが閉じられると処理を抜ける
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // ストリーミング終了マーカーの検知
            if (chunk.includes("\n[END OF RESPONSE]")) {
                // ストリームの終了を検知したら特別な処理を行う
                onStreamUpdate("\n[END OF RESPONSE]");
                break;
            }
            // 受信したデータをhandleStreamUpdateに渡す
            onStreamUpdate(chunk);
            result += chunk;
        }
        if (result.includes("\n[InvalidRequestError]")) {
            const textOfInvalidRequestError = "トークンが最大に達しました。新しいチャットを作成するか、モデルを変更してください。"
            const parsedResponse: string = await JSON.stringify({answer: textOfInvalidRequestError});
            // 最終的な結果をJSON形式で解析
            return JSON.parse(parsedResponse);
        } else if(result.includes("\n[ERROR]")){
            const textOfError = "エラーが発生してしまいました。申し訳ないですが、新しいチャットで再開してください"
            const parsedResponse: string = await JSON.stringify({answer: textOfError});
            // 最終的な結果をJSON形式で解析
            return JSON.parse(parsedResponse);
        } else {
            const parsedResponse: string = await JSON.stringify({answer: result});
            // 最終的な結果をJSON形式で解析
            return JSON.parse(parsedResponse);
        }
    } catch (error: any) {
        onStreamUpdate("");
        return JSON.parse(await JSON.stringify({ answer: "エラーが発生しました。:" + error }));
    }
}

export function getCitationFilePath(citation: string): string {
    return `/content/${citation}`;
}

export async function getConversationsHistoryApi(loginUser: string): Promise<UserConversations> {
    const response = await fetch("/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body:  JSON.stringify({
            loginUser: loginUser
        })
    });
    // レスポンスが成功していない場合にエラーをスローする
    if (!response.ok) {
        const errorText = await response.text();  // HTMLエラーページかもしれないのでtextで取得
        throw new Error(`Request failed with status ${response.status}: ${errorText}`);
    }
    const parsedResponse: UserConversations = await response.json();
    return parsedResponse;
}

export async function getConversationContentApi(conversation_id: string, approach: string): Promise<ConversationContent> {
    const response = await fetch("/conversationcontent", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            conversation_id: conversation_id,
            approach: approach
        })
    });
    const parsedResponse: ConversationContent = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function deleteConersationApi(conversation_id: string): Promise<DeleteResponse> {
    const response = await fetch("/delete", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            conversation_id: conversation_id
        })
    });
    const parsedResponse: DeleteResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export const createJSTTimeStamp = () => {
    const currentTime = new Date();
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0'); // 月は0から始まるため1を足す
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const seconds = String(currentTime.getSeconds()).padStart(2, '0');
    const JSTTimeStamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
    return JSTTimeStamp
}