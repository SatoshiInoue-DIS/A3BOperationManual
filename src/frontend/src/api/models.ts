export const enum Approaches {
    RetrieveThenRead = "rtr",
    ReadRetrieveRead = "rrr",
    ReadDecomposeAsk = "rda",
    Read = "r"
}

export type AskRequestOverrides = {
    gptModel?: string;
    semanticRanker?: boolean;
    semanticCaptions?: boolean;
    excludeCategory?: string;
    top?: number;
    temperature?: string;
    promptTemplate?: string;
    promptTemplatePrefix?: string;
    promptTemplateSuffix?: string;
};

export type AskRequest = {
    question: string;
    approach: Approaches;
    overrides?: AskRequestOverrides;
};

export type AskResponse = {
    answer: string;
    thoughts?: string | null;
    data_points?: string[];
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: string;
};

export type ChatRequest = {
    history: ChatTurn[];
    approach: Approaches;
    overrides?: AskRequestOverrides;
    conversation_id: string | null;
    timestamp: string | null;
    conversation_title: string | null;
    loginUser: string;
};

export type GptChatTurn = {
    user: string;
    assistant?: string;
};

export type GptChatRequest = {
    history: GptChatTurn[];
    approach: Approaches;
    overrides?: GptRequestOverrides;
    conversation_id: string | null;
    timestamp: string | null;
    conversation_title: string | null;
    loginUser: string;
};

export type GptRequestOverrides = {
    gptModel?: string;
    temperature?: string;
    systemPrompt?: string;
};

export type ChatResponse = {
    answer: string;
    error?: string;
};

export type Claim = {
    typ: string;
    val: string;
};

export type AccessToken = {
    access_token: string;
    expires_on: string;
    id_token: string;
    provider_name: string;
    user_claims: Claim[];
    user_id: string;
};

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

type DocSearchMessage = {
    role: 'user' | 'bot';
    content: string;
};

export type Conversation = {
    conversation_id: string; // 会話のID
    approach: string;
    title: string;
    timestamp: string // メッセージの配列
};

export type UserConversations = {
    user_id: string; // ユーザーのID
    conversations: Conversation[]; // 会話の配列
    error?: string;
}

export type ConversationContent = {
    conversation_id: string; // 会話のID
    approach: string;
    conversations: Message[]; // 会話の配列
    error?: string;
}

export type DocSearchConversationContent = {
    conversation_id: string; // 会話のID
    approach: string;
    conversations: DocSearchMessage[]; // 会話の配列
    error?: string;
}

export type DeleteResponse = {
    success: boolean;
    error?: string;
}
