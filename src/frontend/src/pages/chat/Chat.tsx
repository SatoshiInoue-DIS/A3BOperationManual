import React, { useRef, useState, useEffect, useCallback } from "react";
import { TextField, Panel, DefaultButton } from "@fluentui/react";
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";
import { useOutletContext, useLocation } from 'react-router-dom';

import styles from "./Chat.module.css";
import { UserConversations } from '../../api/models';
import { chatApi, Approaches, ChatResponse, GptChatRequest, GptChatTurn, getConversationsHistoryApi, createJSTTimeStamp, getConversationContentApi } from "../../api";
import { AnswerChat, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { SettingsButton } from "../../components/SettingsButton";

const Chat = () => {
    const { conversationId, onClearChat, conversationContent, updateReupdateResult, loginUser, handleConversationClick } = useOutletContext<{
        conversationId: string | null,
        onClearChat: (clearFunc: () => void) => void,
        conversationContent: [user: string, response: ChatResponse][],
        updateReupdateResult: (result: UserConversations) => void,
        loginUser: string,
        handleConversationClick: (id: string) => void;
    }>();
    const location = useLocation();

    const clickedHistoryConversationId = location.state?.conversationId;
    const clickedHistoryApproach = location.state?.approach;
    useEffect(() => {
        if (clickedHistoryConversationId) {
            makeApiRequestForConversationContent(clickedHistoryConversationId, clickedHistoryApproach);  // ページ遷移後にAPIリクエスト
        }
    }, [clickedHistoryConversationId, clickedHistoryApproach]);

    const [clickedConversationId, setClickedConversationId] = useState<string | null>(null);

    const makeApiRequestForConversationContent = async (conversation_id: string, approach: string) => {
        setClickedConversationId(conversation_id);
        try {
            const result = await getConversationContentApi(conversation_id, approach)
            const content: [user: string, response: ChatResponse][] = [];
            const messages = result.conversations
            // ユーザーとアシスタントの会話ペアを抽出
            for (let i = 0; i < messages.length; i += 2) {
                const userMessage = messages[i];
                const assistantMessage = messages[i + 1];
                if (userMessage && assistantMessage && userMessage.role === 'user' && assistantMessage.role === 'assistant') {
                    // contentにペアを追加
                    content.push([
                        userMessage.content,  // ユーザーのメッセージ内容
                        { answer: assistantMessage.content } // アシスタントの回答 (ChatResponse型)
                    ] as [user: string, response: ChatResponse]);
                }
            }
            setAnswers(content);
            handleConversationClick(conversation_id);  
            localStorage.setItem('selectedConversationId', conversation_id);  // ローカルストレージに保存
        } catch (error) {
            console.error('Error in makeApiRequestForConversationContent:', error);
        }
    }

    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

    const [gptModel, setGptModel] = useState<string>("gpt-4o-mini");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [temperature, setTemperature] = useState<string>("0.0");

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: ChatResponse][]>([]);

    const [conversationTitle, setConversationTitle] = useState<string | null>(null);
    const [] = useState<UserConversations>();

    const gpt_models: IDropdownOption[] = [
        { key: "gpt-3.5-turbo", text: "gpt-3.5-turbo" },
        { key: "gpt-3.5-turbo-16k", text: "gpt-3.5-turbo-16k" },
        { key: "gpt-4", text: "gpt-4" },
        { key: "gpt-4-32k", text: "gpt-4-32k" },
        { key: "gpt-4o-mini", text: "gpt-4o-mini" }
    ];

    const temperatures: IDropdownOption[] = Array.from({ length: 11 }, (_, i) => ({ key: (i / 10).toFixed(1), text: (i / 10).toFixed(1) }));
    const [timestamp, setTimestamp] = useState<string | null>(null);
    // conversationIdが更新されたときにtimestampをリセット
    useEffect(() => {
        setTimestamp(null);
    }, [conversationId]);

    const [streamResponse, setStreamResponse] = useState<string>("");  // 途中の応答を保持

    // ストリームから部分的な応答を受け取り、蓄積
    const handleStreamUpdate = (chunk: string) => {
        if (chunk === "\n[END OF RESPONSE]") {
            return;
        }
        // 通常のレスポンス処理
        setStreamResponse(prev => prev + chunk);
    };

    const makeApiRequest = async (question: string) => {
        // 初回のリクエスト時にtimestampを設定
        let japanTimeStamp = timestamp === null ? createJSTTimeStamp() : timestamp;
        setTimestamp(japanTimeStamp);
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);

        try {
            setStreamResponse("");  // 新しいリクエストのためにリセット
            const history: GptChatTurn[] = answers.map(a => ({ user: a[0], assistant: a[1].answer }));
            const request: GptChatRequest = {
                history: [...history, { user: question, assistant: undefined }],
                approach: Approaches.Read,
                overrides: {
                    gptModel: gptModel,
                    temperature: temperature,
                    systemPrompt: systemPrompt,
                },
                conversation_id: conversationId,
                timestamp: japanTimeStamp,
                conversation_title: conversationTitle,
                loginUser: loginUser,
            };
            // ストリーミングの途中の更新を受け取りつつ、最終結果も得る
            const result = await chatApi(request, handleStreamUpdate);
            // 最終的な応答をanswersに追加
            setAnswers(prevAnswers => [
                ...prevAnswers,
                [question, result] // 最終結果を利用
            ]);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
            const reupdate_result: UserConversations = await getConversationsHistoryApi(loginUser);
            updateReupdateResult(reupdate_result);
        }
    };

    // error が何であってもエラー状態をリセットする
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        setError(undefined);
        setAnswers([]);
    }, []);

    // Chat コンポーネントがマウントされた時に clearChat 関数を親に渡す
    useEffect(() => {
        onClearChat(clearChat);
    }, [clearChat, onClearChat]);

    useEffect(() => {
        if (conversationContent) {
            setAnswers(conversationContent); // conversationContent が更新されたら answers にセット
        }
    }, [conversationContent]);

    useEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" })
    }, [answers, isLoading, streamResponse]);

    const onGptModelChange = (_ev?: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option !== undefined) {
            setGptModel(option.key as string);
        }
    };

    const onSystemPromptChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setSystemPrompt(newValue || "");
    };

    const onTempertureChange = (_ev?: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option !== undefined) {
            setTemperature(option.key as string);
        }
    };

    useEffect(() => {
        onClearChat
        handleConversationClick("clearID")
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <SettingsButton className={styles.commandButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    <div className={styles.chatMessageStream}>
                        {answers.map((answer, index) => (
                            <div key={index}>
                                <UserChatMessage message={answer[0]} />
                                <div className={styles.chatMessageGpt}>
                                    <div className={styles.botThumbnailContainer}>
                                        <img src="./companylogo.png" width={20} height={20} alt="botthumbnail" />
                                    </div>
                                    <AnswerChat key={index} answer={answer[1]} isSelected={selectedAnswer === index} />
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className={styles.chatMessageGptMinWidth}>
                                    <div className={styles.botThumbnailContainer}>
                                        <img src="./companylogo.png" width={20} height={20} alt="botthumbnail" />
                                    </div>
                                    <AnswerLoading streamResponse={streamResponse}/>
                                </div>
                            </>
                        )}
                        {error ? (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className={styles.chatMessageGptMinWidth}>
                                    <div className={styles.botThumbnailContainer}>
                                        <img src="./companylogo.png" width={20} height={20} alt="botthumbnail" />
                                    </div>
                                    <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                </div>
                            </>
                        ) : null}
                        <div ref={chatMessageStreamEnd} />
                    </div>

                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder="ChatGPTと会話を始めましょう。（例：ChatGPTについて教えて下さい）"
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                        />
                        <div className={styles.notesAnswerContainer}>
                            <p className={styles.notesAnswer}>回答は必ずしも正解ではないことに気を付けましょう。</p>
                        </div>
                    </div>
                </div>
                <Panel
                    headerText="設定"
                    isOpen={isConfigPanelOpen}
                    isBlocking={false}
                    onDismiss={() => setIsConfigPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>閉じる</DefaultButton>}
                    isFooterAtBottom={true}
                >
                    <Dropdown
                        className={styles.chatSettingsSeparator}
                        defaultSelectedKeys={[gptModel]}
                        selectedKey={gptModel}
                        label="GPTモデル:"
                        options={gpt_models}
                        onChange={onGptModelChange}
                    />
                    <TextField
                        className={styles.chatSettingsSeparator}
                        value={systemPrompt}
                        label="システムプロンプト:"
                        multiline
                        autoAdjustHeight
                        onChange={onSystemPromptChange}
                    />
                    <Dropdown
                        className={styles.chatSettingsSeparator}
                        defaultSelectedKeys={[temperature]}
                        selectedKey={temperature}
                        label="テンプラチャー:"
                        options={temperatures}
                        onChange={onTempertureChange}
                    />
                </Panel>
            </div>
        </div>
    );
};

export default Chat;
