import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useMsalAuth } from "../../auth/useMsalAuth";
import { useMsal } from "@azure/msal-react";
import { SideNav } from "../../components/SideNav";
import styles from "./Layout.module.css";
import { getConversationContentApi } from "../../api";
import { ChatResponse, UserConversations, AskResponse } from '../../api/models';
import { v4 as uuidv4 } from 'uuid';
import SignOutButton from "../../components/SignOutButton/SignOutButton"
import { SignOutRegular } from "@fluentui/react-icons";
import { Text } from "@fluentui/react";

const Layout = (): JSX.Element => {
    const botName = import.meta.env.VITE_A3B_FAQ_BOT_NAME;
    const loginUserInfo: Promise<{name: string, roles: string}> = useMsalAuth();
    const [userName, setUserName] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>("none");
    const navigate = useNavigate(); // useNavigate フックを取得
    const [conversationId, setConversationId] = useState<string | null>(null);  
    const [clearChatFunc, setClearChatFunc] = useState<() => void>(() => {});
    const [conversationContent, setConversationContent] = useState<[user: string, response: ChatResponse | AskResponse][]>([]);
    const [reupdateResult, setReupdateResult] = useState<UserConversations | null>(null);
    const { instance } = useMsal();
    const makeApiRequestForConversationContent = async (conversation_id: string, approach: string) => {
        try {
            const result = await getConversationContentApi(conversation_id, approach)
            const content: [user: string, response: ChatResponse | AskResponse][] = [];
            const messages = result.conversations
            // ユーザーとアシスタントの会話ペアを抽出
            for (let i = 0; i < messages.length; i += 2) {
                const userMessage = messages[i];
                const assistantMessage = messages[i + 1];
                // assistantの前はbotという名前で使用していたため、過去データが残っているためbotも残す仕様とする
                if (userMessage && assistantMessage && userMessage.role === 'user' && (assistantMessage.role === 'assistant' || assistantMessage.role === 'bot')) {
                    // contentにペアを追加
                    content.push([
                        userMessage.content,  // ユーザーのメッセージ内容
                        { answer: assistantMessage.content } // アシスタントの回答
                    ] as [user: string, response: ChatResponse | AskResponse]);
                }
            }
            setConversationContent(content);
            handleConversationClick(conversation_id);
            localStorage.setItem('selectedConversationId', conversation_id);  // ローカルストレージに保存
        } catch (error) {
            console.error('Error in makeApiRequestForDocSearchConversationContent:', error);
        }
    }

    useEffect(() => {
        const fetchLoginUser = async () => {
            const result = await loginUserInfo; // Promiseの結果を待つ
            if (result) {
                const name = result.name
                const roles = result.roles
                let role = "none"
                // 受講者ロールが含まれていたら
                if (roles.includes("Students")) {
                    role = "Students"
                // 講師ロールが含まれていたら
                } else if (roles.includes("Lecturer")) {
                    role = "Lecturer"
                // それ以外
                } else {
                    role = "none"
                }
                setUserName(name)
                setUserRole(role)
                 // `role` が "Students" の場合に /docsearch に遷移
                if (userRole === "Students" && location.pathname !== '/docsearch') {
                    navigate('/docsearch'); // リダイレクト処理);
                }
                const savedConversationId = localStorage.getItem('selectedConversationId');  
                if (savedConversationId) {  
                    setConversationId(savedConversationId);
                } else {
                    // 新しいIDを生成し、localStorageに保存
                    const newId = uuidv4();
                    localStorage.setItem(`selectedConversationId`, newId);
                    setConversationId(newId);
                }
            }
        }
        fetchLoginUser(); // 非同期処理を呼び出し
    }, [loginUserInfo,  location.pathname]);

    const handleConversationClick = (id: string) => {
        if (id == "clearID") {
            // IDを変更する
            const newId = uuidv4();
            localStorage.setItem('selectedConversationId', newId); // 新しいIDを保存
            setConversationId(newId); // 新しいIDで状態を更新
            setConversationContent([]);
        } else {
            setConversationId(id);
            localStorage.setItem('selectedConversationId', id);
        }
    };
    // clearChat を Chat から受け取り、state に保存する
    const handleSetClearChat = (clearFunc: () => void) => {
        setClearChatFunc(() => clearFunc);
    };

    const updateReupdateResult = (result: UserConversations) => {  
        setReupdateResult(result);  
    };

    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountmenuRef = useRef<HTMLDivElement>(null); // メニューの要素を参照するためのRef

    const toggleAccountMenu = () => {
        setIsAccountMenuOpen(!isAccountMenuOpen);
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // メニューが開いていて、かつクリックした場所がメニュー外なら閉じる
            if (isAccountMenuOpen && accountmenuRef.current && !accountmenuRef.current.contains(event.target as Node)) {
            setIsAccountMenuOpen(false);
            }
        };

        // クリックイベントを追加
        document.addEventListener("click", handleClickOutside);

        // クリーンアップ関数（コンポーネントがアンマウントされたらイベント削除）
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, [isAccountMenuOpen]); // isAccountMenuOpenが変わるたびにuseEffectを更新

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <div className={styles.headerTitleContainer}>
                        <h3 className={styles.headerTitleLeft}>{botName}</h3>
                    </div>
                    <nav>
                        <ul className={styles.headerNavList}>
                            {userRole == "Lecturer" && (
                                <li>
                                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        ChatGPT
                                    </NavLink>
                                </li>
                            )}
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/docsearch" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    研修テキスト内FAQ
                                </NavLink>
                            </li>
                        </ul>
                    </nav>
                    <div className={styles.headerTitleRightContainer} onClick={toggleAccountMenu} ref={accountmenuRef}>
                        <h3 className={styles.headerTitleRight}>{userName}
                            {isAccountMenuOpen && (
                                <div className={styles.accountMenu}>
                                    <div className={styles.signOutContainer} >
                                        <SignOutRegular />
                                        <SignOutButton />
                                    </div>
                                </div>
                            )}
                        </h3>
                    </div>
                </div>
            </header>

            <div className={styles.mainContainer}>
                <SideNav
                    conversationId={conversationId}
                    onClick={handleConversationClick}
                    clearChat={clearChatFunc}
                    reupdateResult={reupdateResult}
                    loginUser={userName}
                    UserRole={userRole}
                />
                <Outlet
                    context={{
                        conversationId,
                        onClearChat: handleSetClearChat,
                        conversationContent,
                        updateReupdateResult,
                        userName,
                        handleConversationClick,
                        makeApiRequestForConversationContent
                    }}
                />
            </div>
        </div>
    );
};

export default Layout;
