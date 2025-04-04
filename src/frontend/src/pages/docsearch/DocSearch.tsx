import { useRef, useState, useEffect, useCallback } from "react";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton } from "@fluentui/react";
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";
import { useOutletContext, useLocation } from 'react-router-dom';

import styles from "./DocSearch.module.css";
import { UserConversations } from '../../api/models';
import { searchdocApi, Approaches, AskResponse, ChatRequest, GptChatTurn, createJSTTimeStamp, getConversationsHistoryApi } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { HowToUseList } from "../../components/HowToUse";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { SettingsButton } from "../../components/SettingsButton";

const DocSearch = () => {
    const { conversationId, onClearChat, conversationContent, updateReupdateResult, userName, handleConversationClick, makeApiRequestForConversationContent } = useOutletContext<{
        conversationId: string | null,
        onClearChat: (clearFunc: () => void) => void,
        conversationContent: [user: string, response: AskResponse][],
        updateReupdateResult: (result: UserConversations) => void,
        userName: string,
        handleConversationClick: (id: string) => void;
        makeApiRequestForConversationContent: (conversation_id: string, approach: string) => void;
    }>();

    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

    const [gptModel, setGptModel] = useState<string>("gpt-4o");
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
    const [timestamp, setTimestamp] = useState<string | null>(null);
    // 途中の応答を保持
    const [streamResponse, setStreamResponse] = useState<string>("");

    const gpt_models: IDropdownOption[] = [
        { key: "gpt-3.5-turbo", text: "gpt-3.5-turbo" },
        { key: "gpt-3.5-turbo-16k", text: "gpt-3.5-turbo-16k" },
        { key: "gpt-4", text: "gpt-4" },
        { key: "gpt-4-32k", text: "gpt-4-32k" },
        { key: "gpt-4o-mini", text: "gpt-4o-mini" },
        { key: "gpt-4o", text: "gpt-4o" }
    ];

    // SideNavコンポーネントのnavigatから値を受け取る
    const location = useLocation();
    const clickedHistoryConversationId = location.state?.conversationId;
    const clickedHistoryApproach = location.state?.approach;

    useEffect(() => {
        if (clickedHistoryConversationId) {
            makeApiRequestForConversationContent(clickedHistoryConversationId, clickedHistoryApproach);  // ページ遷移後にAPIリクエスト
            lastQuestionRef.current = "kokoko"
        }
    }, [clickedHistoryConversationId]);

    const temperatures: IDropdownOption[] = Array.from({ length: 11 }, (_, i) => ({ key: (i / 10).toFixed(1), text: (i / 10).toFixed(1) }));

    // conversationIdが更新されたときにtimestampをリセット
    useEffect(() => {
        setTimestamp(null);
    }, [conversationId]);

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
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            setStreamResponse("");  // 新しいリクエストのためにリセット
            const history: GptChatTurn[] = answers.map(a => ({ user: a[0], assistant: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, assistant: undefined }],
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
                loginUser: userName,
            };
            // ストリーミングの途中の更新を受け取りつつ、最終結果も得る
            const result = await searchdocApi(request, handleStreamUpdate);
            // 最終的な応答をanswersに追加
            setAnswers(prevAnswers => [
                ...prevAnswers,
                [question, result] // 最終結果を利用
            ]);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
            const reupdate_result: UserConversations = await getConversationsHistoryApi(userName);
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

    // conversationContent が更新されたら answers にセット
    useEffect(() => {
        if (conversationContent) {
            setAnswers(conversationContent);
        }
    }, [conversationContent]);

    useEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" })
    }, [answers, isLoading, streamResponse]);

    useEffect(() => {
        onClearChat
        handleConversationClick("clearID")
    }, []);

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
                                        <AnswerLoading streamResponse={streamResponse} />
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
