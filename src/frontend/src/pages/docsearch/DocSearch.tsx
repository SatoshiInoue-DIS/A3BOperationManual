import { useRef, useState, useEffect, useCallback } from "react";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton } from "@fluentui/react";
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';

import styles from "./DocSearch.module.css";
import { UserConversations } from '../../api/models';
import { searchdocApi, Approaches, ChatResponse, AskResponse, ChatRequest, ChatTurn, createJSTTimeStamp, getConversationsHistoryApi, getDocSearchConversationContentApi } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { HowToUseList } from "../../components/HowToUse";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { SettingsButton } from "../../components/SettingsButton";
import { ClearChatButton } from "../../components/ClearChatButton";

const DocSearch = () => {
    const { conversationId, onClearChat, conversationContent, updateReupdateResult, loginUser, handleConversationClick } = useOutletContext<{
        conversationId: string | null,
        onClearChat: (clearFunc: () => void) => void,
        conversationContent: [user: string, response: AskResponse][],
        updateReupdateResult: (result: UserConversations) => void,
        loginUser: string,
        handleConversationClick: (id: string) => void;
    }>();
    const location = useLocation();

    const clickedHistoryConversationId = location.state?.conversationId;
    const clickedHistoryApproach = location.state?.approach;
    useEffect(() => {
        if (clickedHistoryConversationId) {
            makeApiRequestForDocSearchConversationContent(clickedHistoryConversationId, clickedHistoryApproach);  // ページ遷移後にAPIリクエスト
        }
    }, [clickedHistoryConversationId]);

    const [clickedConversationId, setClickedConversationId] = useState<string | null>(null);
    
    const makeApiRequestForDocSearchConversationContent = async (conversation_id: string, approach: string) => {
        setClickedConversationId(conversation_id);
        try {
            const result = await getDocSearchConversationContentApi(conversation_id, approach)
            const content: [user: string, response: AskResponse][] = [];
            const messages = result.conversations
            // ユーザーとアシスタントの会話ペアを抽出
            for (let i = 0; i < messages.length; i += 2) {
                const userMessage = messages[i];
                const assistantMessage = messages[i + 1];
                if (userMessage && assistantMessage && userMessage.role === 'user' && assistantMessage.role === 'bot') {
                    // contentにペアを追加
                    content.push([
                        userMessage.content,  // ユーザーのメッセージ内容
                        { answer: assistantMessage.content } // アシスタントの回答 (AskResponse型)
                    ] as [user: string, response: AskResponse]);
                }
            }
            setAnswers(content);
            handleConversationClick(conversation_id);
            lastQuestionRef.current = "kokokok";
            localStorage.setItem('selectedConversationId', conversation_id);  // ローカルストレージに保存
        } catch (error) {
            console.error('Error in makeApiRequestForDocSearchConversationContent:', error);
        }
    }
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

    const [gptModel, setGptModel] = useState<string>("gpt-3.5-turbo");
    const [temperature, setTemperature] = useState<string>("0.0");

    const [retrieveCount, setRetrieveCount] = useState<number>(5);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(true);
    const [excludeCategory, setExcludeCategory] = useState<string>("");

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const [conversationTitle, setConversationTitle] = useState<string | null>(null);
    const [] = useState<UserConversations>();

    const gpt_models: IDropdownOption[] = [
        { key: "gpt-3.5-turbo", text: "gpt-3.5-turbo" },
        { key: "gpt-3.5-turbo-16k", text: "gpt-3.5-turbo-16k" },
        { key: "gpt-4", text: "gpt-4" },
        { key: "gpt-4-32k", text: "gpt-4-32k" }
    ];

    const temperatures: IDropdownOption[] = Array.from({ length: 11 }, (_, i) => ({ key: (i / 10).toFixed(1), text: (i / 10).toFixed(1) }));
    const [timestamp, setTimestamp] = useState<string | null>(null);
    // conversationIdが更新されたときにtimestampをリセット
    useEffect(() => {
        setTimestamp(null);
    }, [conversationId]);

    const makeApiRequest = async (question: string) => {
        // 初回のリクエスト時にtimestampを設定
        let japanTimeStamp = timestamp === null ? createJSTTimeStamp() : timestamp;
        setTimestamp(japanTimeStamp);
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                approach: Approaches.ReadRetrieveRead,
                overrides: {
                    gptModel: gptModel,
                    temperature: temperature,
                    top: retrieveCount,
                    excludeCategory: excludeCategory.length === 0 ? undefined : excludeCategory,
                    semanticRanker: useSemanticRanker,
                    semanticCaptions: useSemanticCaptions
                },
                conversation_id: conversationId,
                timestamp: japanTimeStamp,
                conversation_title: conversationTitle,
                loginUser: loginUser,
            };
            const result = await searchdocApi(request);
            setAnswers([...answers, [question, result]]);
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
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
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
    }, [answers, isLoading]);

    const onGptModelChange = (_ev?: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option !== undefined) {
            setGptModel(option.key as string);
        }
    };

    const onTempertureChange = (_ev?: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option !== undefined) {
            setTemperature(option.key as string);
        }
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "5"));
    };

    const onUseSemanticRankerChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticRanker(!!checked);
    };

    const onUseSemanticCaptionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticCaptions(!!checked);
    };

    const onExcludeCategoryChanged = (_ev?: React.FormEvent, newValue?: string) => {
        setExcludeCategory(newValue || "");
    };

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }

        setSelectedAnswer(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setSelectedAnswer(index);
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
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <img className={styles.companylogo} src="./companylogo.png" alt="company-logo" />
                            <h1 className={styles.chatEmptyStateTitle}>研修テキスト内FAQ</h1>
                            <HowToUseList/>
                        </div>
                    ) : (
                        <div className={styles.chatMessageStream}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <UserChatMessage message={answer[0]} />
                                    <div className={styles.chatMessageGpt}>
                                        <div className={styles.botThumbnailContainer}>
                                            <img src="./companylogo.png" width={20} height={20} alt="botthumbnail" />
                                        </div>
                                        <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                            onCitationClicked={c => onShowCitation(c, index)}
                                            // onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                            // onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                            // onFollowupQuestionClicked={q => makeApiRequest(q)}
                                            // showFollowupQuestions={false}
                                        />
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
                                        <AnswerLoading />
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
                    )}

                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder="ChatGPTがテキスト内検索をお手伝いします。何について知りたいですか？"
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                        />
                        <div className={styles.notesAnswerContainer}>
                            <p className={styles.notesAnswer}>回答は必ずしも正解ではないことに気を付けましょう。</p>
                        </div>
                    </div>
                </div>

                {answers.length > 0 && activeAnalysisPanelTab && (
                    <AnalysisPanel
                        className={styles.chatAnalysisPanel}
                        activeCitation={activeCitation}
                        onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                        citationHeight="810px"
                        answer={answers[selectedAnswer][1]}
                        activeTab={activeAnalysisPanelTab}
                    />
                )}

                <Panel
                    headerText="回答生成のための詳細設定"
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
                    <Dropdown
                        className={styles.chatSettingsSeparator}
                        defaultSelectedKeys={[temperature]}
                        selectedKey={temperature}
                        label="テンプラチャー:"
                        options={temperatures}
                        onChange={onTempertureChange}
                    />
                    <SpinButton
                        className={styles.chatSettingsSeparator}
                        label="検索結果から取得するドキュメントの数:"
                        min={1}
                        max={50}
                        defaultValue={retrieveCount.toString()}
                        onChange={onRetrieveCountChange}
                    />
                    <TextField className={styles.chatSettingsSeparator} label="除外するカテゴリ" onChange={onExcludeCategoryChanged} />
                    <Checkbox
                        className={styles.chatSettingsSeparator}
                        checked={useSemanticRanker}
                        label="セマンティックランカーを使用する"
                        onChange={onUseSemanticRankerChange}
                    />
                    <Checkbox
                        className={styles.chatSettingsSeparator}
                        checked={useSemanticCaptions}
                        label="ドキュメント全体ではなく、クエリのコンテキストに応じた要約を使用する"
                        onChange={onUseSemanticCaptionsChange}
                        disabled={!useSemanticRanker}
                    />
                </Panel>
            </div>
        </div>
    );
};

export default DocSearch;
