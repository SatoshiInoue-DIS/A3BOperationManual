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
 
export async function getLoginInfo(accessToken: string): Promise<DecodedToken | null> {
    const response = await fetch("/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    
    const userInfo: DecodedToken = await response.json();
    // rolesが存在しない場合にデフォルト値を追加（オプション）
    if (!userInfo.roles) {
        userInfo.roles = "none";
        return null; // ユーザー情報を返さない
    }
    return userInfo;
}

export async function LogOut() {
    const response = await fetch("/logout", {
        method: "GET",
        credentials: "include"
    });
}


export async function searchdocApi(options: ChatRequest): Promise<AskResponse> {
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
        const parsedResponse: AskResponse = await response.json();
        // レスポンスが正しくない場合はエラーを投げる
        if (response.status > 299 || !response.ok) {
            throw Error(parsedResponse.error || "Unknown error");
        }
        // レスポンスのボディがnullでないことを確認
        if (!response.body) {
            throw new Error("レスポンスのボディがありません。");
        }
        return parsedResponse;
    } catch (error: any) {
        return JSON.parse(await JSON.stringify({ answer: "エラーが発生しました。:" + error }));
    }
}

export async function chatApi(options: GptChatRequest): Promise<ChatResponse> {
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

        const parsedResponse: AskResponse = await response.json();

        // レスポンスが正しくない場合はエラーを投げる
        if (response.status > 299 || !response.ok) {
            throw Error(parsedResponse.error || "Unknown error");
        }
        // レスポンスのボディがnullでないことを確認
        if (!response.body) {
            throw new Error(parsedResponse.error || "レスポンスのボディがありません。");
        }
        return parsedResponse;
    } catch (error: any) {
        return JSON.parse(await JSON.stringify({ answer: "エラーが発生しました。:" + error }));
    }
}

export function getCitationFilePath(citation: string): string {
    // PDFビュアーのカスタマイズ
    const queryParameters = "#view=FitV&pagemode=none&toolbar=0"
    return `/content/${citation}${queryParameters}`;
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